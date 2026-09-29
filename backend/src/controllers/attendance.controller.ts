import { Request, Response } from 'express';
import { z } from 'zod';
import { query, dbPool } from '../db/pool';
import { config } from '../config/env';
import { PunchType, PunchStatus, IncidentSeverity, IncidentStatus } from '@fitxai/shared';

const punchSchema = z.object({
  type: z.enum([PunchType.CHECK_IN, PunchType.CHECK_OUT]),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().min(0), // Precisión en metros
  altitude: z.number().optional(),
  deviceId: z.string().optional(),
  notes: z.string().max(500).optional(),
});

const incidentSchema = z.object({
  type: z.string().min(3, 'Tipo de incidencia requerido'),
  description: z.string().min(5, 'La descripción debe tener al menos 5 caracteres'),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
});

/**
 * Obtener o resolver el ID de empleado para el usuario autenticado
 */
async function resolveEmployeeId(userId: string, companyId: string, currentEmpId?: string): Promise<string | null> {
  if (currentEmpId) return currentEmpId;
  const rows = await query<any>(
    `SELECT id FROM employees WHERE user_id = $1 AND company_id = $2 LIMIT 1`,
    [userId, companyId]
  );
  return rows[0]?.id || null;
}

/**
 * POST /attendance/punch
 * Fichar Entrada o Salida con GPS puntual y verificación de precisión
 */
export async function registerPunch(req: Request, res: Response) {
  const client = await dbPool.connect();
  try {
    const parseResult = punchSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Datos de fichaje inválidos',
        details: parseResult.error.errors,
      });
    }

    const { type, latitude, longitude, accuracy, altitude, deviceId, notes } = parseResult.data;
    const user = req.user!;

    const employeeId = await resolveEmployeeId(user.userId, user.companyId, user.employeeId);
    if (!employeeId) {
      return res.status(400).json({
        success: false,
        error: 'El usuario no tiene una ficha de empleado asociada para poder fichar.',
      });
    }

    // Evaluación de precisión GPS
    const isAccuracyLow = accuracy > config.maxGpsAccuracyMeters;
    const punchStatus = isAccuracyLow ? PunchStatus.FLAGGED : PunchStatus.VERIFIED;

    await client.query('BEGIN');

    // 1. Insertar en attendance_records con timestamp exacto
    const attendanceRes = await client.query(
      `INSERT INTO attendance_records (employee_id, company_id, type, timestamp, status, device_id, notes)
       VALUES ($1, $2, $3, NOW(), $4, $5, $6)
       RETURNING id, type, timestamp, status`,
      [employeeId, user.companyId, type, punchStatus, deviceId || null, notes || null]
    );

    const attendanceRecord = attendanceRes.rows[0];

    // 2. Insertar en location_records (ASOCIADO 1:1 EXCLUSIVAMENTE AL FICHAJE PUNTUAL)
    const locationRes = await client.query(
      `INSERT INTO location_records (attendance_record_id, latitude, longitude, accuracy, altitude, provider, ip_address)
       VALUES ($1, $2, $3, $4, $5, 'gps_single_event', $6)
       RETURNING id, latitude, longitude, accuracy, captured_at`,
      [attendanceRecord.id, latitude, longitude, accuracy, altitude || null, req.ip]
    );

    const locationRecord = locationRes.rows[0];

    // 3. Registrar incidente si la precisión fue degradada
    if (isAccuracyLow) {
      await client.query(
        `INSERT INTO incidents (company_id, employee_id, attendance_record_id, type, severity, description, status)
         VALUES ($1, $2, $3, 'LOW_GPS_ACCURACY', $4, $5, $6)`,
        [
          user.companyId,
          employeeId,
          attendanceRecord.id,
          IncidentSeverity.LOW,
          `Fichaje registrado con precisión degradada (±${accuracy.toFixed(1)}m > umbral ${config.maxGpsAccuracyMeters}m)`,
          IncidentStatus.PENDING,
        ]
      );
    }

    // 4. Registrar en auditoría
    await client.query(
      `INSERT INTO audit_logs (company_id, user_id, action, entity_type, entity_id, ip_address, metadata)
       VALUES ($1, $2, $3, 'attendance_records', $4, $5, $6)`,
      [
        user.companyId,
        user.userId,
        type === PunchType.CHECK_IN ? 'PUNCH_CHECK_IN' : 'PUNCH_CHECK_OUT',
        attendanceRecord.id,
        req.ip,
        JSON.stringify({ accuracy, latitude, longitude }),
      ]
    );

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      message: type === PunchType.CHECK_IN ? 'Entrada registrada con éxito' : 'Salida registrada con éxito',
      record: {
        id: attendanceRecord.id,
        employeeId,
        companyId: user.companyId,
        type: attendanceRecord.type,
        timestamp: attendanceRecord.timestamp,
        status: attendanceRecord.status,
        location: {
          latitude: locationRecord.latitude,
          longitude: locationRecord.longitude,
          accuracy: locationRecord.accuracy,
          capturedAt: locationRecord.captured_at,
        },
      },
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error registering punch:', error);
    return res.status(500).json({ success: false, error: 'Error al registrar el fichaje' });
  } finally {
    client.release();
  }
}

/**
 * GET /attendance/my-status
 * Estado actual de la jornada de hoy del trabajador (NOT_STARTED, ACTIVE, FINISHED)
 */
export async function getMyAttendanceStatus(req: Request, res: Response) {
  try {
    const user = req.user!;
    const employeeId = await resolveEmployeeId(user.userId, user.companyId, user.employeeId);
    if (!employeeId) {
      return res.status(400).json({ success: false, error: 'Ficha de empleado no encontrada' });
    }

    // Obtener los fichajes del trabajador hoy ordenados cronológicamente
    const punchesToday = await query<any>(
      `SELECT ar.id, ar.type, ar.timestamp, lr.latitude, lr.longitude, lr.accuracy
       FROM attendance_records ar
       LEFT JOIN location_records lr ON lr.attendance_record_id = ar.id
       WHERE ar.employee_id = $1 AND ar.company_id = $2 AND ar.timestamp::date = CURRENT_DATE
       ORDER BY ar.timestamp ASC`,
      [employeeId, user.companyId]
    );

    if (punchesToday.length === 0) {
      // Estado 1: No ha fichado
      return res.json({
        success: true,
        data: {
          status: 'NOT_STARTED',
          statusText: 'NO HAS FICHADO',
          actionButton: 'FICHAR ENTRADA',
          nextType: 'CHECK_IN',
          checkInTime: null,
          checkOutTime: null,
          hoursWorked: null,
          punchesCount: 0,
        },
      });
    }

    const lastPunch = punchesToday[punchesToday.length - 1];
    const firstCheckIn = punchesToday.find((p) => p.type === 'CHECK_IN');

    if (lastPunch.type === 'CHECK_IN') {
      // Estado 2: Jornada Activa
      const checkInDate = new Date(lastPunch.timestamp);
      const formattedCheckIn = checkInDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

      return res.json({
        success: true,
        data: {
          status: 'ACTIVE',
          statusText: 'JORNADA ACTIVA',
          actionButton: 'FICHAR SALIDA',
          nextType: 'CHECK_OUT',
          checkInTime: formattedCheckIn,
          checkInTimestamp: lastPunch.timestamp,
          checkOutTime: null,
          hoursWorked: null,
          punchesCount: punchesToday.length,
          lastLocation: lastPunch.latitude ? {
            latitude: lastPunch.latitude,
            longitude: lastPunch.longitude,
            accuracy: lastPunch.accuracy,
          } : null,
        },
      });
    } else {
      // Estado 3: Jornada Finalizada
      const checkInDate = firstCheckIn ? new Date(firstCheckIn.timestamp) : new Date(lastPunch.timestamp);
      const checkOutDate = new Date(lastPunch.timestamp);

      const formattedCheckIn = checkInDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
      const formattedCheckOut = checkOutDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

      // Calcular diferencia en horas y minutos
      const diffMs = Math.max(0, checkOutDate.getTime() - checkInDate.getTime());
      const totalMinutes = Math.floor(diffMs / 60000);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      const formattedHours = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

      return res.json({
        success: true,
        data: {
          status: 'FINISHED',
          statusText: 'JORNADA FINALIZADA',
          actionButton: null, // Jornada terminada
          nextType: 'CHECK_IN', // Por si realiza un segundo turno
          checkInTime: formattedCheckIn,
          checkOutTime: formattedCheckOut,
          hoursWorked: formattedHours,
          punchesCount: punchesToday.length,
        },
      });
    }
  } catch (error: any) {
    console.error('Error fetching my attendance status:', error);
    return res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}

/**
 * GET /attendance/my-punches
 * Historial personal del trabajador (estricto aislamiento, sólo sus fichajes)
 */
export async function getMyAttendanceHistory(req: Request, res: Response) {
  try {
    const user = req.user!;
    const employeeId = await resolveEmployeeId(user.userId, user.companyId, user.employeeId);
    if (!employeeId) {
      return res.status(400).json({ success: false, error: 'Ficha de empleado no encontrada' });
    }

    const records = await query<any>(
      `SELECT 
        ar.id,
        ar.type,
        ar.timestamp,
        ar.status,
        ar.notes,
        lr.latitude,
        lr.longitude,
        lr.accuracy,
        lr.captured_at
      FROM attendance_records ar
      LEFT JOIN location_records lr ON lr.attendance_record_id = ar.id
      WHERE ar.employee_id = $1 AND ar.company_id = $2
      ORDER BY ar.timestamp DESC
      LIMIT 100`,
      [employeeId, user.companyId]
    );

    // Agrupación por días de trabajo
    const daysMap = new Map<string, any>();

    for (const r of records) {
      const dateKey = new Date(r.timestamp).toISOString().split('T')[0];
      if (!daysMap.has(dateKey)) {
        daysMap.set(dateKey, {
          date: dateKey,
          formattedDate: new Date(r.timestamp).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }),
          checkIn: null,
          checkOut: null,
          totalHours: '--:--',
          records: [],
        });
      }

      const day = daysMap.get(dateKey);
      day.records.push(r);

      const timeStr = new Date(r.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
      if (r.type === 'CHECK_IN' && !day.checkIn) {
        day.checkIn = {
          time: timeStr,
          timestamp: r.timestamp,
          latitude: r.latitude,
          longitude: r.longitude,
          accuracy: r.accuracy,
        };
      } else if (r.type === 'CHECK_OUT' && !day.checkOut) {
        day.checkOut = {
          time: timeStr,
          timestamp: r.timestamp,
          latitude: r.latitude,
          longitude: r.longitude,
          accuracy: r.accuracy,
        };
      }
    }

    // Calcular horas por día
    const groupedDays = Array.from(daysMap.values()).map((day) => {
      if (day.checkIn && day.checkOut) {
        const inMs = new Date(day.checkIn.timestamp).getTime();
        const outMs = new Date(day.checkOut.timestamp).getTime();
        const diffMs = Math.max(0, outMs - inMs);
        const mins = Math.floor(diffMs / 60000);
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        day.totalHours = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      }
      return day;
    });

    return res.json({
      success: true,
      rawPunches: records,
      days: groupedDays,
    });
  } catch (error: any) {
    console.error('Error fetching my attendance history:', error);
    return res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}

/**
 * POST /incidents
 * Registrar una incidencia creada por el trabajador
 */
export async function createWorkerIncident(req: Request, res: Response) {
  try {
    const parseResult = incidentSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Validación de incidencia fallida',
        details: parseResult.error.errors,
      });
    }

    const user = req.user!;
    const employeeId = await resolveEmployeeId(user.userId, user.companyId, user.employeeId);
    if (!employeeId) {
      return res.status(400).json({ success: false, error: 'Empleado no encontrado' });
    }

    const { type, description, severity } = parseResult.data;

    const incidentRes = await query<any>(
      `INSERT INTO incidents (company_id, employee_id, type, severity, description, status)
       VALUES ($1, $2, $3, $4, $5, 'PENDING')
       RETURNING id, type, severity, description, status, created_at`,
      [user.companyId, employeeId, type, severity, description]
    );

    return res.status(201).json({
      success: true,
      message: 'Incidencia reportada correctamente al administrador',
      data: incidentRes[0],
    });
  } catch (error: any) {
    console.error('Error creating worker incident:', error);
    return res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}

/**
 * GET /incidents/my-incidents
 * Consultar las incidencias del trabajador autenticado
 */
export async function getMyIncidents(req: Request, res: Response) {
  try {
    const user = req.user!;
    const employeeId = await resolveEmployeeId(user.userId, user.companyId, user.employeeId);
    if (!employeeId) {
      return res.status(400).json({ success: false, error: 'Empleado no encontrado' });
    }

    const rows = await query<any>(
      `SELECT id, type, severity, description, status, created_at, resolved_at
       FROM incidents
       WHERE employee_id = $1 AND company_id = $2
       ORDER BY created_at DESC`,
      [employeeId, user.companyId]
    );

    return res.json({
      success: true,
      data: rows,
    });
  } catch (error: any) {
    console.error('Error fetching my incidents:', error);
    return res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}

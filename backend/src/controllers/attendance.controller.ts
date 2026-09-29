import { Request, Response } from 'express';
import { z } from 'zod';
import { query, dbPool } from '../db/pool';
import { config } from '../config/env';
import { PunchType, PunchStatus, IncidentSeverity, IncidentStatus } from '@fitxai/shared';
import { realtimeService } from '../services/realtime.service';

const punchSchema = z.object({
  type: z.union([
    z.nativeEnum(PunchType),
    z.literal('ENTRADA'),
    z.literal('SALIDA'),
  ]),
  latitude: z.number().min(-90, 'Latitud debe estar entre -90 y 90').max(90, 'Latitud debe estar entre -90 y 90'),
  longitude: z.number().min(-180, 'Longitud debe estar entre -180 y 180').max(180, 'Longitud debe estar entre -180 y 180'),
  accuracy: z.number().min(0, 'La precisión no puede ser negativa'), // Precisión en metros
  altitude: z.number().optional(),
  deviceId: z.string().optional(),
  deviceInfo: z.string().optional(),
  isMocked: z.boolean().optional(),
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
 * Fichar Entrada o Salida con GPS puntual, verificación estricta de precisión,
 * prevención de duplicados, orden lógico y autoridad absoluta del servidor en fecha/hora.
 */
export async function registerPunch(req: Request, res: Response) {
  const client = await dbPool.connect();
  try {
    const parseResult = punchSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Datos de fichaje inválidos o coordenadas fuera de rango',
        details: parseResult.error.errors,
      });
    }

    const { type, latitude, longitude, accuracy, altitude, deviceId, deviceInfo, isMocked, notes } = parseResult.data;
    const user = req.user!;

    // 1. Normalizar tipo de fichaje: ENTRADA -> CHECK_IN, SALIDA -> CHECK_OUT
    const normalizedType: PunchType = 
      (type === 'ENTRADA' || type === PunchType.CHECK_IN) ? PunchType.CHECK_IN : PunchType.CHECK_OUT;

    // 2. Detección de ubicaciones falseadas (GPS Spoofing / Mocked)
    if (isMocked && !config.allowMockLocations) {
      return res.status(422).json({
        success: false,
        error: 'Ubicación simulada o falseada detectada. No está permitido el uso de aplicaciones de emulación o falseo GPS.',
        code: 'MOCK_LOCATION_DETECTED',
      });
    }

    // 3. Validación de coordenadas reales
    if (latitude === 0 && longitude === 0) {
      return res.status(400).json({
        success: false,
        error: 'Coordenadas GPS no válidas (0, 0). Espera a que el dispositivo obtenga fijación de satélites real.',
        code: 'INVALID_COORDINATES',
      });
    }

    const employeeId = await resolveEmployeeId(user.userId, user.companyId, user.employeeId);
    if (!employeeId) {
      return res.status(400).json({
        success: false,
        error: 'El usuario no tiene una ficha de empleado asociada para poder fichar.',
      });
    }

    // 4. Verificaciones de actividad del usuario, empresa y empleado con bloqueo de fila
    const userStatusCheck = await client.query(
      `SELECT 
        u.status as user_status, 
        c.is_active as company_active, 
        c.name as company_name,
        e.is_active as employee_active,
        e.first_name,
        e.last_name,
        e.document_id,
        e.employee_code,
        e.department,
        e.job_title
       FROM users u
       JOIN companies c ON c.id = u.company_id
       JOIN employees e ON e.id = $1 AND e.company_id = u.company_id
       WHERE u.id = $2 AND u.company_id = $3
       FOR UPDATE OF e`,
      [employeeId, user.userId, user.companyId]
    );

    if (userStatusCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'Usuario o empresa no encontrados en el sistema.',
      });
    }

    const empInfo = userStatusCheck.rows[0];
    const { user_status, company_active, employee_active } = empInfo;
    const user_active = user_status === 'ACTIVE';

    if (!company_active) {
      return res.status(403).json({
        success: false,
        error: 'La empresa se encuentra inactiva. No se pueden registrar fichajes.',
      });
    }

    if (!user_active) {
      return res.status(403).json({
        success: false,
        error: 'Tu cuenta de usuario se encuentra desactivada.',
      });
    }

    if (!employee_active) {
      return res.status(403).json({
        success: false,
        error: 'Tu ficha de trabajador se encuentra desactivada.',
      });
    }

    // 5. Consulta del último fichaje registrado para comprobaciones de duplicado y orden lógico
    const lastPunchCheck = await client.query(
      `SELECT id, type, timestamp, 
              EXTRACT(EPOCH FROM (NOW() - timestamp)) as seconds_ago
       FROM attendance_records
       WHERE employee_id = $1 AND company_id = $2
       ORDER BY timestamp DESC
       LIMIT 1`,
      [employeeId, user.companyId]
    );

    const lastPunch = lastPunchCheck.rows[0];
    const isRapidDuplicate = lastPunch && lastPunch.type === normalizedType && (lastPunch.seconds_ago !== null && parseFloat(lastPunch.seconds_ago) < 30);

    // 6. Prevención de fichajes duplicados (por ejemplo, doble pulsación accidental)
    if (isRapidDuplicate) {
      return res.status(409).json({
        success: false,
        error: `Fichaje duplicado detectado: Ya has registrado una ${normalizedType === PunchType.CHECK_IN ? 'entrada' : 'salida'} hace menos de 30 segundos.`,
        code: 'DUPLICATE_PUNCH',
        duplicate: true,
      });
    }

    // 7. Validación de orden lógico:
    // - No se puede fichar dos entradas seguidas
    // - No se puede fichar dos salidas seguidas
    // - No se puede fichar salida sin haber entrado previamente
    if (normalizedType === PunchType.CHECK_IN) {
      if (lastPunch && lastPunch.type === PunchType.CHECK_IN) {
        return res.status(409).json({
          success: false,
          error: 'Secuencia lógica inválida: no se puede fichar dos entradas seguidas. Ya dispones de una jornada activa abierta.',
          code: 'CONSECUTIVE_CHECK_IN',
        });
      }
    } else if (normalizedType === PunchType.CHECK_OUT) {
      if (!lastPunch || lastPunch.type === PunchType.CHECK_OUT) {
        return res.status(409).json({
          success: false,
          error: 'Secuencia lógica inválida: no se puede fichar salida sin haber registrado una entrada previa.',
          code: 'CHECK_OUT_WITHOUT_CHECK_IN',
        });
      }
    }

    // 7. Validación de precisión GPS
    // Consultar configuración personalizada de empresa para precisión GPS máxima admisible
    const settingRes = await client.query(
      `SELECT value FROM settings WHERE company_id = $1 AND key = 'gps_accuracy_threshold_meters' LIMIT 1`,
      [user.companyId]
    );
    const companyThreshold = settingRes.rows[0]?.value 
      ? parseFloat(settingRes.rows[0].value) 
      : config.maxGpsAccuracyMeters;

    // Si la precisión es completamente inaceptable (> 250 metros), se rechaza solicitando reintento
    if (accuracy > 250) {
      return res.status(422).json({
        success: false,
        error: `Precisión GPS insuficiente (±${accuracy.toFixed(0)}m > 250m). Para garantizar la validez legal del registro, sitúate en un espacio con mejor cobertura GPS y pulsa Reintentar.`,
        code: 'GPS_ACCURACY_TOO_LOW',
        accuracy,
        threshold: 250,
        canRetry: true,
      });
    }

    // Si la precisión supera el umbral normal pero está en rango de aceptación (150m-250m), se acepta pero se marca FLAGGED y genera incidencia
    const isAccuracyLow = accuracy > companyThreshold;
    const punchStatus = isAccuracyLow ? PunchStatus.FLAGGED : PunchStatus.VERIFIED;

    // Dispositivo o User-Agent
    const userAgent = (req.headers['user-agent'] as string) || 'Dispositivo Móvil FITXAI';
    const finalDeviceInfo = deviceInfo || (deviceId ? `Dispositivo ID: ${deviceId}` : userAgent.slice(0, 200));

    await client.query('BEGIN');

    // 8. Insertar en attendance_records con TIMESTAMP OFICIAL DETERMINADO EXCLUSIVAMENTE POR EL SERVIDOR
    const attendanceRes = await client.query(
      `INSERT INTO attendance_records (
         employee_id, company_id, type, timestamp, status, device_id, notes,
         latitude, longitude, accuracy, ip_address, device_info
       )
       VALUES ($1, $2, $3, NOW(), $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING 
         id, employee_id, company_id, type, timestamp, status, notes,
         latitude, longitude, accuracy, ip_address, device_info,
         to_char(timestamp, 'YYYY-MM-DD') as fecha,
         to_char(timestamp, 'HH24:MI:SS') as hora`,
      [
        employeeId,
        user.companyId,
        normalizedType,
        punchStatus,
        deviceId || null,
        notes || null,
        latitude,
        longitude,
        accuracy,
        req.ip,
        finalDeviceInfo,
      ]
    );

    const attendanceRecord = attendanceRes.rows[0];

    // 9. Insertar en location_records (ASOCIADO 1:1 EXCLUSIVAMENTE AL FICHAJE PUNTUAL)
    const locationRes = await client.query(
      `INSERT INTO location_records (attendance_record_id, latitude, longitude, accuracy, altitude, provider, is_mocked, ip_address)
       VALUES ($1, $2, $3, $4, $5, 'gps_single_event', $6, $7)
       RETURNING id, latitude, longitude, accuracy, captured_at`,
      [attendanceRecord.id, latitude, longitude, accuracy, altitude || null, !!isMocked, req.ip]
    );

    const locationRecord = locationRes.rows[0];

    // 10. Registrar incidente si la precisión fue degradada
    if (isAccuracyLow) {
      await client.query(
        `INSERT INTO incidents (company_id, employee_id, attendance_record_id, type, severity, description, status)
         VALUES ($1, $2, $3, 'LOW_GPS_ACCURACY', $4, $5, $6)`,
        [
          user.companyId,
          employeeId,
          attendanceRecord.id,
          IncidentSeverity.LOW,
          `Fichaje registrado con precisión degradada (±${accuracy.toFixed(1)}m > umbral ${companyThreshold}m)`,
          IncidentStatus.PENDING,
        ]
      );
    }

    // 11. Registrar en auditoría
    await client.query(
      `INSERT INTO audit_logs (company_id, user_id, action, entity_type, entity_id, ip_address, metadata)
       VALUES ($1, $2, $3, 'attendance_records', $4, $5, $6)`,
      [
        user.companyId,
        user.userId,
        normalizedType === PunchType.CHECK_IN ? 'PUNCH_CHECK_IN' : 'PUNCH_CHECK_OUT',
        attendanceRecord.id,
        req.ip,
        JSON.stringify({ accuracy, latitude, longitude, ip: req.ip, device: finalDeviceInfo }),
      ]
    );

    await client.query('COMMIT');

    // 12. Emitir evento EN TIEMPO REAL exclusivamente a los administradores de la empresa correspondiente
    try {
      realtimeService.emitPunchEvent(user.companyId, {
        type: 'NEW_PUNCH',
        companyId: user.companyId,
        timestamp: attendanceRecord.timestamp,
        record: {
          id: attendanceRecord.id,
          employee_id: employeeId,
          first_name: empInfo.first_name,
          last_name: empInfo.last_name,
          document_id: empInfo.document_id,
          employee_code: empInfo.employee_code,
          department: empInfo.department,
          job_title: empInfo.job_title,
          company_id: user.companyId,
          company_name: empInfo.company_name,
          type: attendanceRecord.type,
          tipo: attendanceRecord.type === PunchType.CHECK_IN ? 'ENTRADA' : 'SALIDA',
          timestamp: attendanceRecord.timestamp,
          fecha: attendanceRecord.fecha,
          hora: attendanceRecord.hora,
          status: attendanceRecord.status,
          latitude: attendanceRecord.latitude,
          longitude: attendanceRecord.longitude,
          accuracy: attendanceRecord.accuracy,
          ip_origen: attendanceRecord.ip_address,
          dispositivo: attendanceRecord.device_info,
        },
        notification: {
          title: 'Nou fitxatge',
          workerName: `${empInfo.first_name} ${empInfo.last_name}`,
          punchType: attendanceRecord.type === PunchType.CHECK_IN ? 'Entrada' : 'Salida',
          time: attendanceRecord.hora ? attendanceRecord.hora.substring(0, 5) : '--:--',
          locationStatus: attendanceRecord.latitude && attendanceRecord.longitude ? 'Ubicació registrada' : 'Sense ubicació',
        },
      });
    } catch (realtimeErr) {
      console.warn('[REALTIME] Advertencia al emitir evento de fichaje:', realtimeErr);
    }

    return res.status(201).json({
      success: true,
      message: normalizedType === PunchType.CHECK_IN ? 'Entrada registrada con éxito' : 'Salida registrada con éxito',
      record: {
        id: attendanceRecord.id,
        employeeId,
        companyId: user.companyId,
        type: attendanceRecord.type,
        tipo: attendanceRecord.type === PunchType.CHECK_IN ? 'ENTRADA' : 'SALIDA',
        fecha: attendanceRecord.fecha,
        hora: attendanceRecord.hora,
        timestamp: attendanceRecord.timestamp,
        status: attendanceRecord.status,
        latitude: attendanceRecord.latitude,
        longitude: attendanceRecord.longitude,
        accuracy: attendanceRecord.accuracy,
        ipAddress: attendanceRecord.ip_address,
        deviceInfo: attendanceRecord.device_info,
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

/**
 * GET /attendance/:id
 * Inspección detallada de un fichaje con verificación de punto GPS exacto (sin rutas)
 */
export async function getAttendanceById(req: Request, res: Response) {
  try {
    const user = req.user!;
    const { id } = req.params;

    const rows = await query<any>(
      `SELECT 
        ar.id,
        ar.employee_id,
        ar.company_id,
        ar.type,
        ar.timestamp,
        ar.status,
        ar.notes,
        to_char(ar.timestamp, 'YYYY-MM-DD') as fecha,
        to_char(ar.timestamp, 'HH24:MI:SS') as hora,
        COALESCE(ar.latitude, lr.latitude) as latitude,
        COALESCE(ar.longitude, lr.longitude) as longitude,
        COALESCE(ar.accuracy, lr.accuracy) as accuracy,
        COALESCE(ar.ip_address, lr.ip_address) as ip_origen,
        COALESCE(ar.device_info, 'Dispositivo móvil registrado') as dispositivo,
        ar.created_at,
        e.first_name,
        e.last_name,
        e.document_id,
        e.employee_code,
        e.department,
        e.job_title,
        c.name as company_name,
        c.cif as company_cif
      FROM attendance_records ar
      JOIN employees e ON e.id = ar.employee_id
      JOIN companies c ON c.id = ar.company_id
      LEFT JOIN location_records lr ON lr.attendance_record_id = ar.id
      WHERE ar.id = $1 AND ar.company_id = $2
      LIMIT 1`,
      [id, user.companyId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Fichaje no encontrado' });
    }

    const r = rows[0];

    // Si es un empleado normal, verificar que es su propio fichaje
    if (user.role === 'EMPLOYEE' && user.employeeId && r.employee_id !== user.employeeId) {
      return res.status(403).json({ success: false, error: 'No tienes permiso para consultar fichajes de otros trabajadores' });
    }

    const tipoLabel = r.type === 'CHECK_IN' ? 'ENTRADA' : 'SALIDA';
    const statusLabel = r.status === 'VERIFIED' ? 'Verificado' : r.status === 'FLAGGED' ? 'Revisión Pendiente' : 'Rechazado';

    return res.json({
      success: true,
      data: {
        id: r.id,
        trabajador_id: r.employee_id,
        trabajador: {
          id: r.employee_id,
          nombre: `${r.first_name} ${r.last_name}`,
          first_name: r.first_name,
          last_name: r.last_name,
          documento: r.document_id,
          codigo: r.employee_code,
          departamento: r.department,
          puesto: r.job_title,
        },
        empresa_id: r.company_id,
        empresa_nombre: r.company_name,
        empresa_cif: r.company_cif,
        tipo: r.type,
        tipo_label: tipoLabel,
        fecha: r.fecha,
        hora: r.hora,
        timestamp: r.timestamp,
        latitud: r.latitude,
        longitud: r.longitude,
        precision: r.accuracy,
        ip_origen: r.ip_origen,
        dispositivo: r.dispositivo,
        status: r.status,
        status_label: statusLabel,
        notas: r.notes,
        creado_en: r.created_at,
        map_point: r.latitude && r.longitude ? {
          latitude: r.latitude,
          longitude: r.longitude,
          accuracy: r.accuracy,
          is_single_point: true,
          tracks_allowed: false,
          osm_url: `https://www.openstreetmap.org/?mlat=${r.latitude}&mlon=${r.longitude}#map=18/${r.latitude}/${r.longitude}`,
          osm_embed_url: `https://www.openstreetmap.org/export/embed.html?bbox=${r.longitude - 0.005}%2C${r.latitude - 0.003}%2C${r.longitude + 0.005}%2C${r.latitude + 0.003}&layer=mapnik&marker=${r.latitude}%2C${r.longitude}`,
        } : null,
      },
    });
  } catch (error: any) {
    console.error('Error fetching attendance by id:', error);
    return res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}

/**
 * PUT /attendance/:id/correct
 * Corrección de un fichaje por parte del administrador con registro inmutable de auditoría
 */
export async function correctAttendanceRecord(req: Request, res: Response) {
  try {
    const user = req.user!;
    const { id } = req.params;
    const { timestamp, type, status, reason, notes } = req.body;

    if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
      return res.status(400).json({
        success: false,
        error: 'Es obligatorio indicar un motivo justificativo detallado (mínimo 5 caracteres) para corregir un fichaje.',
      });
    }

    // 1. Verificar existencia y pertenencia a la empresa
    const existing = await query<any>(
      `SELECT * FROM attendance_records WHERE id = $1 AND company_id = $2`,
      [id, user.companyId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Fichaje no encontrado en tu empresa' });
    }

    const current = existing[0];

    // 2. Construir campos a actualizar
    const newTimestamp = timestamp ? new Date(timestamp) : current.timestamp;
    const newType = type || current.type;
    const newStatus = status || current.status;
    const newNotes = notes !== undefined ? notes : current.notes;
    const fullNotes = `${newNotes ? newNotes + ' | ' : ''}Corregido por admin: ${reason.trim()}`;

    const updateRes = await query<any>(
      `UPDATE attendance_records
       SET timestamp = $1, type = $2, status = $3, notes = $4, updated_at = NOW()
       WHERE id = $5 AND company_id = $6
       RETURNING *`,
      [newTimestamp, newType, newStatus, fullNotes, id, user.companyId]
    );

    const updated = updateRes[0];

    // 3. Registro inmutable de auditoría
    await query(
      `INSERT INTO audit_logs (company_id, user_id, action, entity_type, entity_id, ip_address, metadata)
       VALUES ($1, $2, 'PUNCH_CORRECTED', 'attendance_records', $3, $4, $5)`,
      [
        user.companyId,
        user.userId,
        id,
        req.ip,
        JSON.stringify({
          before: {
            timestamp: current.timestamp,
            type: current.type,
            status: current.status,
            notes: current.notes,
          },
          after: {
            timestamp: updated.timestamp,
            type: updated.type,
            status: updated.status,
            notes: updated.notes,
          },
          reason: reason.trim(),
        }),
      ]
    );

    return res.json({
      success: true,
      message: 'Fichaje corregido exitosamente y registrado en auditoría',
      data: updated,
    });
  } catch (error: any) {
    console.error('Error correcting attendance record:', error);
    return res.status(500).json({ success: false, error: 'Error al corregir el fichaje' });
  }
}



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

export async function registerPunch(req: Request, res: Response) {
  const client = await dbPool.connect();
  try {
    const parseResult = punchSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed for punch payload',
        details: parseResult.error.errors,
      });
    }

    const { type, latitude, longitude, accuracy, altitude, deviceId, notes } = parseResult.data;
    const user = req.user!;

    // Obtener el ID del empleado asociado al usuario
    let employeeId = user.employeeId;
    if (!employeeId) {
      const empRows = await client.query(
        `SELECT id FROM employees WHERE user_id = $1 AND company_id = $2 LIMIT 1`,
        [user.userId, user.companyId]
      );
      if (empRows.rows.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Current user has no associated employee profile',
        });
      }
      employeeId = empRows.rows[0].id;
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

    // 3. Si la precisión es anormalmente baja, registrar incidente automático para el administrador
    if (isAccuracyLow) {
      await client.query(
        `INSERT INTO incidents (company_id, employee_id, attendance_record_id, type, severity, description, status)
         VALUES ($1, $2, $3, 'LOW_GPS_ACCURACY', $4, $5, $6)`,
        [
          user.companyId,
          employeeId,
          attendanceRecord.id,
          IncidentSeverity.LOW,
          `Fichaje registrado con precisión GPS degradada (${accuracy.toFixed(1)} metros > umbral de ${config.maxGpsAccuracyMeters}m)`,
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
    return res.status(500).json({
      success: false,
      error: 'Error al registrar fichaje',
    });
  } finally {
    client.release();
  }
}

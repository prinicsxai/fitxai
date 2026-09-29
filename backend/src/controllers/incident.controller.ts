import { Request, Response } from 'express';
import { z } from 'zod';
import { query, dbPool } from '../db/pool';
import { IncidentStatus, IncidentSeverity, PunchType } from '@fitxai/shared';

const incidentCreateSchema = z.object({
  type: z.string().min(2, 'Tipo de incidencia requerido'),
  description: z.string().min(3, 'La descripción debe tener al menos 3 caracteres'),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
  requestedTime: z.string().datetime().optional(),
  requestedPunchType: z.enum(['CHECK_IN', 'CHECK_OUT', 'ENTRADA', 'SALIDA']).optional(),
  attendanceRecordId: z.string().uuid().optional(),
});

const incidentActionSchema = z.object({
  adminComment: z.string().max(1000).optional(),
  createMissingPunch: z.boolean().default(true),
});

/**
 * Resolver employee_id para usuario autenticado
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
 * GET /incidents
 * Listar incidencias con filtros y permisos según rol
 */
export async function getIncidents(req: Request, res: Response) {
  try {
    const user = req.user!;
    const status = req.query.status as string | undefined;
    const employeeId = req.query.employeeId as string | undefined;
    const type = req.query.type as string | undefined;

    const conditions = ['i.company_id = $1'];
    const params: any[] = [user.companyId];
    let paramIndex = 2;

    // Si es trabajador, solo puede ver sus propias incidencias
    if (user.role === 'EMPLOYEE') {
      const empId = await resolveEmployeeId(user.userId, user.companyId, user.employeeId);
      if (!empId) {
        return res.status(403).json({ success: false, error: 'Trabajador no vinculado' });
      }
      conditions.push(`i.employee_id = $${paramIndex}`);
      params.push(empId);
      paramIndex++;
    } else if (employeeId) {
      conditions.push(`i.employee_id = $${paramIndex}`);
      params.push(employeeId);
      paramIndex++;
    }

    if (status && status !== 'ALL') {
      conditions.push(`i.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    if (type && type !== 'ALL') {
      conditions.push(`i.type = $${paramIndex}`);
      params.push(type);
      paramIndex++;
    }

    const rows = await query<any>(
      `SELECT 
        i.id,
        i.company_id,
        i.employee_id,
        i.attendance_record_id,
        i.type,
        i.severity,
        i.description,
        i.status,
        i.admin_comment,
        i.requested_time,
        i.requested_punch_type,
        i.resolved_by_id,
        i.resolved_at,
        i.created_at,
        i.updated_at,
        e.first_name,
        e.last_name,
        e.document_id,
        e.employee_code,
        e.department,
        resolver.first_name as resolver_first_name,
        resolver.last_name as resolver_last_name
       FROM incidents i
       JOIN employees e ON e.id = i.employee_id
       LEFT JOIN users resolver ON resolver.id = i.resolved_by_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY i.created_at DESC`,
      params
    );

    return res.json({
      success: true,
      data: rows,
    });
  } catch (error: any) {
    console.error('Error fetching incidents:', error);
    return res.status(500).json({ success: false, error: 'Error al obtener incidencias' });
  }
}

/**
 * POST /incidents
 * Crear una incidencia (Trabajador o Administrador)
 * Tipos soportados:
 * - FORGOT_PUNCH ("He olvidado fichar")
 * - PUNCH_ERROR ("Error en el fichaje")
 * - GPS_ISSUE ("Problema con GPS")
 * - CONNECTION_ISSUE ("Problema de conexión")
 * - OTHER ("Otro")
 */
export async function createIncident(req: Request, res: Response) {
  try {
    const user = req.user!;
    const parseResult = incidentCreateSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Datos de incidencia inválidos',
        details: parseResult.error.errors,
      });
    }

    const { type, description, severity, requestedTime, requestedPunchType, attendanceRecordId } = parseResult.data;

    let employeeId = await resolveEmployeeId(user.userId, user.companyId, user.employeeId);
    if (!employeeId) {
      // Si un administrador crea una incidencia sobre un empleado específico
      if (req.body.employeeId) {
        employeeId = req.body.employeeId;
      } else {
        return res.status(400).json({ success: false, error: 'Ficha de trabajador requerida' });
      }
    }

    const normPunchType = requestedPunchType 
      ? ((requestedPunchType === 'ENTRADA' || requestedPunchType === 'CHECK_IN') ? 'CHECK_IN' : 'CHECK_OUT')
      : null;

    const insertRes = await query<any>(
      `INSERT INTO incidents (
        company_id, employee_id, attendance_record_id, type, severity, description,
        status, requested_time, requested_punch_type
       )
       VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', $7, $8)
       RETURNING *`,
      [
        user.companyId,
        employeeId,
        attendanceRecordId || null,
        type,
        severity,
        description,
        requestedTime ? new Date(requestedTime) : null,
        normPunchType,
      ]
    );

    const created = insertRes[0];

    // Auditoría
    await query(
      `INSERT INTO audit_logs (company_id, user_id, action, entity_type, entity_id, ip_address, metadata)
       VALUES ($1, $2, 'INCIDENT_REPORTED', 'incidents', $3, $4, $5)`,
      [user.companyId, user.userId, created.id, req.ip, JSON.stringify({ type, severity, description })]
    );

    return res.status(201).json({
      success: true,
      message: 'Incidencia registrada correctamente para revisión',
      data: created,
    });
  } catch (error: any) {
    console.error('Error creating incident:', error);
    return res.status(500).json({ success: false, error: 'Error al registrar la incidencia' });
  }
}

/**
 * POST /incidents/:id/review
 * El administrador marca la incidencia en revisión y añade comentario
 */
export async function reviewIncident(req: Request, res: Response) {
  try {
    const user = req.user!;
    const { id } = req.params;
    const { adminComment } = req.body;

    const existing = await query<any>(
      `SELECT * FROM incidents WHERE id = $1 AND company_id = $2`,
      [id, user.companyId]
    );
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Incidencia no encontrada' });
    }

    const updated = await query<any>(
      `UPDATE incidents 
       SET status = 'REVIEWED', admin_comment = COALESCE($1, admin_comment),
           resolved_by_id = $2, updated_at = NOW()
       WHERE id = $3 AND company_id = $4
       RETURNING *`,
      [adminComment || null, user.userId, id, user.companyId]
    );

    // Auditoría
    await query(
      `INSERT INTO audit_logs (company_id, user_id, action, entity_type, entity_id, ip_address, metadata)
       VALUES ($1, $2, 'INCIDENT_REVIEWED', 'incidents', $3, $4, $5)`,
      [user.companyId, user.userId, id, req.ip, JSON.stringify({ comment: adminComment })]
    );

    return res.json({
      success: true,
      message: 'Incidencia marcada en revisión',
      data: updated[0],
    });
  } catch (error: any) {
    console.error('Error reviewing incident:', error);
    return res.status(500).json({ success: false, error: 'Error al revisar la incidencia' });
  }
}

/**
 * POST /incidents/:id/approve
 * El administrador aprueba la incidencia, añade comentario y opcionalmente regulariza el fichaje
 */
export async function approveIncident(req: Request, res: Response) {
  const client = await dbPool.connect();
  try {
    const user = req.user!;
    const { id } = req.params;
    const { adminComment, createMissingPunch = true } = req.body;

    await client.query('BEGIN');

    const incRes = await client.query(
      `SELECT * FROM incidents WHERE id = $1 AND company_id = $2 FOR UPDATE`,
      [id, user.companyId]
    );

    if (incRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Incidencia no encontrada' });
    }

    const incident = incRes.rows[0];

    let createdAttendanceId: string | null = null;

    // Si la incidencia solicita un fichaje olvidado ('FORGOT_PUNCH') y se autoriza la regularización
    if (createMissingPunch && incident.requested_time && incident.requested_punch_type) {
      const punchType = incident.requested_punch_type as PunchType;
      const punchTime = incident.requested_time;

      const attRes = await client.query(
        `INSERT INTO attendance_records (
          employee_id, company_id, type, timestamp, status, notes
         )
         VALUES ($1, $2, $3, $4, 'VERIFIED', $5)
         RETURNING id`,
        [
          incident.employee_id,
          user.companyId,
          punchType,
          punchTime,
          `Fichaje regularizado automáticamente tras aprobación de incidencia #${incident.id.slice(0, 8)}`,
        ]
      );

      createdAttendanceId = attRes.rows[0].id;

      // Ubicación auditada como regularización manual autorizada
      await client.query(
        `INSERT INTO location_records (
          attendance_record_id, latitude, longitude, accuracy, provider, is_mocked, ip_address
         )
         VALUES ($1, 0, 0, 0, 'incident_approval', false, $2)`,
        [createdAttendanceId, req.ip]
      );
    }

    // Actualizar incidencia a RESOLVED
    const updatedInc = await client.query(
      `UPDATE incidents 
       SET status = 'RESOLVED',
           admin_comment = COALESCE($1, admin_comment),
           attendance_record_id = COALESCE($2, attendance_record_id),
           resolved_by_id = $3,
           resolved_at = NOW(),
           updated_at = NOW()
       WHERE id = $4 AND company_id = $5
       RETURNING *`,
      [adminComment || null, createdAttendanceId, user.userId, id, user.companyId]
    );

    // Registro inmutable de auditoría
    await client.query(
      `INSERT INTO audit_logs (company_id, user_id, action, entity_type, entity_id, ip_address, metadata)
       VALUES ($1, $2, 'INCIDENT_APPROVED', 'incidents', $3, $4, $5)`,
      [
        user.companyId,
        user.userId,
        id,
        req.ip,
        JSON.stringify({
          comment: adminComment,
          regularizedAttendanceId: createdAttendanceId,
          requestedTime: incident.requested_time,
        }),
      ]
    );

    await client.query('COMMIT');

    return res.json({
      success: true,
      message: 'Incidencia aprobada con éxito y registrada en auditoría',
      data: updatedInc.rows[0],
      regularizedAttendanceId: createdAttendanceId,
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error approving incident:', error);
    return res.status(500).json({ success: false, error: 'Error al aprobar la incidencia' });
  } finally {
    client.release();
  }
}

/**
 * POST /incidents/:id/reject
 * El administrador rechaza la incidencia indicando el motivo en comentario
 */
export async function rejectIncident(req: Request, res: Response) {
  try {
    const user = req.user!;
    const { id } = req.params;
    const { adminComment } = req.body;

    const existing = await query<any>(
      `SELECT * FROM incidents WHERE id = $1 AND company_id = $2`,
      [id, user.companyId]
    );
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Incidencia no encontrada' });
    }

    const updated = await query<any>(
      `UPDATE incidents 
       SET status = 'DISMISSED',
           admin_comment = COALESCE($1, admin_comment),
           resolved_by_id = $2,
           resolved_at = NOW(),
           updated_at = NOW()
       WHERE id = $3 AND company_id = $4
       RETURNING *`,
      [adminComment || 'Rechazada por la administración', user.userId, id, user.companyId]
    );

    // Auditoría
    await query(
      `INSERT INTO audit_logs (company_id, user_id, action, entity_type, entity_id, ip_address, metadata)
       VALUES ($1, $2, 'INCIDENT_REJECTED', 'incidents', $3, $4, $5)`,
      [user.companyId, user.userId, id, req.ip, JSON.stringify({ comment: adminComment })]
    );

    return res.json({
      success: true,
      message: 'Incidencia rechazada y documentada en auditoría',
      data: updated[0],
    });
  } catch (error: any) {
    console.error('Error rejecting incident:', error);
    return res.status(500).json({ success: false, error: 'Error al rechazar la incidencia' });
  }
}

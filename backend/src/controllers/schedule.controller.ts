import { Request, Response } from 'express';
import { z } from 'zod';
import { query } from '../db/pool';

const scheduleSchema = z.object({
  name: z.string().min(2, 'El nombre del horario debe tener al menos 2 caracteres'),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Hora de entrada debe ser formato HH:mm (ej. 08:00)'),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Hora de salida debe ser formato HH:mm (ej. 16:30)'),
  workDays: z.string().min(1, 'Días laborales requeridos'),
  breakMinutes: z.number().min(0).max(240).default(30),
  breakStart: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional().or(z.literal('')),
  breakEnd: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional().or(z.literal('')),
  employeeId: z.string().uuid().optional().nullable().or(z.literal('')),
  isActive: z.boolean().default(true),
});

/**
 * GET /schedules
 * Listar horarios configurados de la empresa
 */
export async function getSchedules(req: Request, res: Response) {
  try {
    const user = req.user!;
    const employeeId = req.query.employeeId as string | undefined;

    const conditions = ['ws.company_id = $1'];
    const params: any[] = [user.companyId];

    if (employeeId) {
      conditions.push('(ws.employee_id = $2 OR ws.employee_id IS NULL)');
      params.push(employeeId);
    }

    const rows = await query<any>(
      `SELECT 
        ws.id,
        ws.company_id,
        ws.employee_id,
        ws.name,
        ws.start_time,
        ws.end_time,
        ws.work_days,
        ws.break_minutes,
        ws.break_start,
        ws.break_end,
        ws.is_active,
        ws.created_at,
        ws.updated_at,
        e.first_name,
        e.last_name,
        e.employee_code,
        e.department
       FROM work_schedules ws
       LEFT JOIN employees e ON e.id = ws.employee_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY ws.created_at DESC`,
      params
    );

    return res.json({
      success: true,
      data: rows,
    });
  } catch (error: any) {
    console.error('Error fetching schedules:', error);
    return res.status(500).json({ success: false, error: 'Error al obtener los horarios' });
  }
}

/**
 * POST /schedules
 * Crear un nuevo horario laboral o plantilla
 */
export async function createSchedule(req: Request, res: Response) {
  try {
    const user = req.user!;
    const parseResult = scheduleSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Datos de horario inválidos',
        details: parseResult.error.errors,
      });
    }

    const {
      name,
      startTime,
      endTime,
      workDays,
      breakMinutes,
      breakStart,
      breakEnd,
      employeeId,
      isActive,
    } = parseResult.data;

    const cleanEmpId = employeeId && employeeId.trim() ? employeeId : null;

    // Si se asigna a un empleado, verificar que pertenece a la empresa
    if (cleanEmpId) {
      const empRows = await query(`SELECT id FROM employees WHERE id = $1 AND company_id = $2`, [
        cleanEmpId,
        user.companyId,
      ]);
      if (empRows.length === 0) {
        return res.status(404).json({ success: false, error: 'Trabajador no encontrado en la empresa' });
      }
    }

    const insertRes = await query<any>(
      `INSERT INTO work_schedules (
        company_id, employee_id, name, start_time, end_time, work_days,
        break_minutes, break_start, break_end, is_active
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        user.companyId,
        cleanEmpId,
        name,
        startTime,
        endTime,
        workDays,
        breakMinutes,
        breakStart || null,
        breakEnd || null,
        isActive,
      ]
    );

    const created = insertRes[0];

    // Actualizar campo de texto en employee si aplica
    if (cleanEmpId) {
      await query(
        `UPDATE employees SET schedule = $1, updated_at = NOW() WHERE id = $2 AND company_id = $3`,
        [`${workDays}: ${startTime} - ${endTime} (Descanso ${breakMinutes}m)`, cleanEmpId, user.companyId]
      );
    }

    // Registrar en auditoría
    await query(
      `INSERT INTO audit_logs (company_id, user_id, action, entity_type, entity_id, ip_address, metadata)
       VALUES ($1, $2, 'SCHEDULE_CREATED', 'work_schedules', $3, $4, $5)`,
      [user.companyId, user.userId, created.id, req.ip, JSON.stringify({ name, startTime, endTime, workDays })]
    );

    return res.status(201).json({
      success: true,
      message: 'Horario creado exitosamente',
      data: created,
    });
  } catch (error: any) {
    console.error('Error creating schedule:', error);
    return res.status(500).json({ success: false, error: 'Error al crear el horario' });
  }
}

/**
 * PUT /schedules/:id
 * Modificar un horario existente
 */
export async function updateSchedule(req: Request, res: Response) {
  try {
    const user = req.user!;
    const { id } = req.params;

    const parseResult = scheduleSchema.partial().safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Datos de horario inválidos',
        details: parseResult.error.errors,
      });
    }

    // Verificar existencia y pertenencia
    const existing = await query<any>(
      `SELECT * FROM work_schedules WHERE id = $1 AND company_id = $2`,
      [id, user.companyId]
    );
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Horario no encontrado' });
    }

    const current = existing[0];
    const data = parseResult.data;

    const name = data.name ?? current.name;
    const startTime = data.startTime ?? current.start_time;
    const endTime = data.endTime ?? current.end_time;
    const workDays = data.workDays ?? current.work_days;
    const breakMinutes = data.breakMinutes ?? current.break_minutes;
    const breakStart = data.breakStart !== undefined ? (data.breakStart || null) : current.break_start;
    const breakEnd = data.breakEnd !== undefined ? (data.breakEnd || null) : current.break_end;
    const employeeId = data.employeeId !== undefined ? (data.employeeId || null) : current.employee_id;
    const isActive = data.isActive ?? current.is_active;

    const updateRes = await query<any>(
      `UPDATE work_schedules
       SET name = $1, start_time = $2, end_time = $3, work_days = $4,
           break_minutes = $5, break_start = $6, break_end = $7,
           employee_id = $8, is_active = $9, updated_at = NOW()
       WHERE id = $10 AND company_id = $11
       RETURNING *`,
      [
        name,
        startTime,
        endTime,
        workDays,
        breakMinutes,
        breakStart,
        breakEnd,
        employeeId,
        isActive,
        id,
        user.companyId,
      ]
    );

    // Auditoría
    await query(
      `INSERT INTO audit_logs (company_id, user_id, action, entity_type, entity_id, ip_address, metadata)
       VALUES ($1, $2, 'SCHEDULE_UPDATED', 'work_schedules', $3, $4, $5)`,
      [user.companyId, user.userId, id, req.ip, JSON.stringify({ before: current, after: updateRes[0] })]
    );

    return res.json({
      success: true,
      message: 'Horario actualizado exitosamente',
      data: updateRes[0],
    });
  } catch (error: any) {
    console.error('Error updating schedule:', error);
    return res.status(500).json({ success: false, error: 'Error al actualizar el horario' });
  }
}

/**
 * DELETE /schedules/:id
 * Eliminar un horario
 */
export async function deleteSchedule(req: Request, res: Response) {
  try {
    const user = req.user!;
    const { id } = req.params;

    const check = await query(
      `SELECT id, name FROM work_schedules WHERE id = $1 AND company_id = $2`,
      [id, user.companyId]
    );
    if (check.length === 0) {
      return res.status(404).json({ success: false, error: 'Horario no encontrado' });
    }

    await query(`DELETE FROM work_schedules WHERE id = $1 AND company_id = $2`, [id, user.companyId]);

    // Auditoría
    await query(
      `INSERT INTO audit_logs (company_id, user_id, action, entity_type, entity_id, ip_address, metadata)
       VALUES ($1, $2, 'SCHEDULE_DELETED', 'work_schedules', $3, $4, $5)`,
      [user.companyId, user.userId, id, req.ip, JSON.stringify({ name: check[0].name })]
    );

    return res.json({
      success: true,
      message: 'Horario eliminado exitosamente',
    });
  } catch (error: any) {
    console.error('Error deleting schedule:', error);
    return res.status(500).json({ success: false, error: 'Error al eliminar el horario' });
  }
}

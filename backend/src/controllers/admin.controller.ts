import { Request, Response } from 'express';
import { query } from '../db/pool';

/**
 * Obtener listado de fichajes para el panel de administración con filtros avanzados
 */
export async function getAdminAttendance(req: Request, res: Response) {
  try {
    const user = req.user!;
    const limit = Math.min(parseInt((req.query.limit as string) || '100', 10), 200);
    const offset = parseInt((req.query.offset as string) || '0', 10);
    
    // Filtros
    const employeeId = req.query.employeeId as string | undefined;
    const type = req.query.type as string | undefined;
    const date = req.query.date as string | undefined;
    const department = req.query.department as string | undefined;
    const search = req.query.search as string | undefined;

    const conditions: string[] = ['ar.company_id = $1'];
    const params: any[] = [user.companyId];
    let paramIndex = 2;

    if (employeeId) {
      conditions.push(`ar.employee_id = $${paramIndex}`);
      params.push(employeeId);
      paramIndex++;
    }

    if (type && (type === 'CHECK_IN' || type === 'CHECK_OUT')) {
      conditions.push(`ar.type = $${paramIndex}`);
      params.push(type);
      paramIndex++;
    }

    if (date) {
      conditions.push(`ar.timestamp::date = $${paramIndex}::date`);
      params.push(date);
      paramIndex++;
    }

    if (department) {
      conditions.push(`LOWER(e.department) = LOWER($${paramIndex})`);
      params.push(department);
      paramIndex++;
    }

    if (search) {
      conditions.push(`(
        LOWER(e.first_name) LIKE LOWER($${paramIndex}) OR
        LOWER(e.last_name) LIKE LOWER($${paramIndex}) OR
        LOWER(e.document_id) LIKE LOWER($${paramIndex}) OR
        LOWER(COALESCE(e.employee_code, '')) LIKE LOWER($${paramIndex})
      )`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    const records = await query(
      `SELECT 
        ar.id,
        ar.type,
        ar.timestamp,
        ar.status,
        ar.notes,
        e.id as employee_id,
        e.first_name,
        e.last_name,
        e.document_id,
        e.employee_code,
        e.department,
        e.job_title,
        c.name as company_name,
        lr.id as location_id,
        lr.latitude,
        lr.longitude,
        lr.accuracy,
        lr.captured_at as location_captured_at
      FROM attendance_records ar
      JOIN employees e ON e.id = ar.employee_id
      JOIN companies c ON c.id = ar.company_id
      LEFT JOIN location_records lr ON lr.attendance_record_id = ar.id
      WHERE ${whereClause}
      ORDER BY ar.timestamp DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    const countRes = await query<{ count: string }>(
      `SELECT COUNT(*) as count 
       FROM attendance_records ar
       JOIN employees e ON e.id = ar.employee_id
       WHERE ${whereClause}`,
      params
    );

    return res.json({
      success: true,
      total: parseInt(countRes[0]?.count || '0', 10),
      limit,
      offset,
      data: records,
    });
  } catch (error: any) {
    console.error('Error fetching admin attendance:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

/**
 * Métricas consolidadas para el Dashboard del Administrador
 */
export async function getAdminDashboardStats(req: Request, res: Response) {
  try {
    const user = req.user!;

    // 1. Total de trabajadores y activos
    const empStats = await query<{ total: string; active: string }>(
      `SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_active = true) as active
       FROM employees 
       WHERE company_id = $1`,
      [user.companyId]
    );

    // 2. Fichajes de hoy desglose: total, entradas, salidas
    const punchesStats = await query<{ total: string; check_ins: string; check_outs: string }>(
      `SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE type = 'CHECK_IN') as check_ins,
        COUNT(*) FILTER (WHERE type = 'CHECK_OUT') as check_outs
       FROM attendance_records 
       WHERE company_id = $1 AND timestamp::date = CURRENT_DATE`,
      [user.companyId]
    );

    // 3. Estimación de horas trabajadas hoy:
    // Calculamos la suma de diferencias de tiempo entre CHECK_IN y el siguiente CHECK_OUT por empleado hoy
    const hoursWorkedRes = await query<{ hours: string }>(
      `WITH pairs AS (
        SELECT 
          employee_id,
          type,
          timestamp,
          LEAD(type) OVER (PARTITION BY employee_id ORDER BY timestamp) as next_type,
          LEAD(timestamp) OVER (PARTITION BY employee_id ORDER BY timestamp) as next_ts
        FROM attendance_records
        WHERE company_id = $1 AND timestamp::date = CURRENT_DATE
      )
      SELECT 
        COALESCE(SUM(EXTRACT(EPOCH FROM (next_ts - timestamp)) / 3600), 0) as hours
      FROM pairs
      WHERE type = 'CHECK_IN' AND next_type = 'CHECK_OUT'`,
      [user.companyId]
    );

    // 4. Incidentes pendientes
    const pendingIncidents = await query<{ count: string }>(
      `SELECT COUNT(*) as count 
       FROM incidents 
       WHERE company_id = $1 AND status = 'PENDING'`,
      [user.companyId]
    );

    const hoursNum = parseFloat(hoursWorkedRes[0]?.hours || '0');

    return res.json({
      success: true,
      data: {
        totalEmployees: parseInt(empStats[0]?.total || '0', 10),
        activeEmployees: parseInt(empStats[0]?.active || '0', 10),
        todayPunches: parseInt(punchesStats[0]?.total || '0', 10),
        todayCheckIns: parseInt(punchesStats[0]?.check_ins || '0', 10),
        todayCheckOuts: parseInt(punchesStats[0]?.check_outs || '0', 10),
        todayHoursWorked: Math.round(hoursNum * 10) / 10,
        pendingIncidents: parseInt(pendingIncidents[0]?.count || '0', 10),
      },
    });
  } catch (error: any) {
    console.error('Error fetching dashboard stats:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

/**
 * Obtener historial de fichajes de un empleado específico
 */
export async function getEmployeeAttendanceHistory(req: Request, res: Response) {
  try {
    const user = req.user!;
    const { id } = req.params;

    // Verificar que el empleado pertenece a la empresa
    const empRows = await query(
      `SELECT id, first_name, last_name FROM employees WHERE id = $1 AND company_id = $2 LIMIT 1`,
      [id, user.companyId]
    );

    if (empRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Empleado no encontrado' });
    }

    const records = await query(
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
      [id, user.companyId]
    );

    return res.json({
      success: true,
      employee: empRows[0],
      data: records,
    });
  } catch (error: any) {
    console.error('Error fetching employee attendance history:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

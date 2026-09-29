import { Request, Response } from 'express';
import { query } from '../db/pool';

/**
 * Obtener listado de fichajes para el panel de administración
 */
export async function getAdminAttendance(req: Request, res: Response) {
  try {
    const user = req.user!;
    const limit = Math.min(parseInt((req.query.limit as string) || '50', 10), 100);
    const offset = parseInt((req.query.offset as string) || '0', 10);

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
        c.name as company_name,
        lr.latitude,
        lr.longitude,
        lr.accuracy,
        lr.captured_at as location_captured_at
      FROM attendance_records ar
      JOIN employees e ON e.id = ar.employee_id
      JOIN companies c ON c.id = ar.company_id
      LEFT JOIN location_records lr ON lr.attendance_record_id = ar.id
      WHERE ar.company_id = $1
      ORDER BY ar.timestamp DESC
      LIMIT $2 OFFSET $3`,
      [user.companyId, limit, offset]
    );

    const countRes = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM attendance_records WHERE company_id = $1`,
      [user.companyId]
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
 * Métricas generales para el dashboard de administración
 */
export async function getAdminDashboardStats(req: Request, res: Response) {
  try {
    const user = req.user!;

    // Fichajes de hoy
    const todayPunches = await query<{ count: string }>(
      `SELECT COUNT(*) as count 
       FROM attendance_records 
       WHERE company_id = $1 AND timestamp::date = CURRENT_DATE`,
      [user.companyId]
    );

    // Total de empleados activos
    const activeEmployees = await query<{ count: string }>(
      `SELECT COUNT(*) as count 
       FROM employees 
       WHERE company_id = $1 AND is_active = true`,
      [user.companyId]
    );

    // Incidentes pendientes
    const pendingIncidents = await query<{ count: string }>(
      `SELECT COUNT(*) as count 
       FROM incidents 
       WHERE company_id = $1 AND status = 'PENDING'`,
      [user.companyId]
    );

    return res.json({
      success: true,
      data: {
        todayPunches: parseInt(todayPunches[0]?.count || '0', 10),
        activeEmployees: parseInt(activeEmployees[0]?.count || '0', 10),
        pendingIncidents: parseInt(pendingIncidents[0]?.count || '0', 10),
      },
    });
  } catch (error: any) {
    console.error('Error fetching dashboard stats:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

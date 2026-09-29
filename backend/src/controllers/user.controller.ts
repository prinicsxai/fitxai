import { Request, Response } from 'express';
import { query } from '../db/pool';

/**
 * GET /users/me
 * Obtiene el perfil completo del usuario autenticado y su información de empleado si aplica
 */
export async function getMe(req: Request, res: Response) {
  try {
    const user = req.user!;

    const userRows = await query<any>(
      `SELECT 
        u.id, 
        u.company_id, 
        u.email, 
        u.first_name, 
        u.last_name, 
        u.phone, 
        u.role, 
        u.status, 
        u.created_at, 
        u.last_login_at,
        c.name as company_name, 
        c.cif as company_cif,
        c.timezone as company_timezone,
        e.id as employee_id, 
        e.document_id,
        e.employee_code, 
        e.department, 
        e.job_title, 
        e.schedule, 
        e.hire_date, 
        e.is_active as employee_is_active
      FROM users u
      JOIN companies c ON c.id = u.company_id
      LEFT JOIN employees e ON e.user_id = u.id
      WHERE u.id = $1
      LIMIT 1`,
      [user.userId]
    );

    if (userRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }

    const row = userRows[0];

    return res.json({
      success: true,
      data: {
        id: row.id,
        email: row.email,
        firstName: row.first_name,
        lastName: row.last_name,
        phone: row.phone,
        role: row.role,
        status: row.status,
        company: {
          id: row.company_id,
          name: row.company_name,
          cif: row.company_cif,
          timezone: row.company_timezone,
        },
        createdAt: row.created_at,
        lastLoginAt: row.last_login_at,
        employeeProfile: row.employee_id
          ? {
              id: row.employee_id,
              documentId: row.document_id,
              employeeCode: row.employee_code,
              department: row.department,
              jobTitle: row.job_title,
              schedule: row.schedule,
              hireDate: row.hire_date,
              isActive: row.employee_is_active,
            }
          : null,
      },
    });
  } catch (error: any) {
    console.error('Error fetching current user:', error);
    return res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}

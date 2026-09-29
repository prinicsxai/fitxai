import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { query, dbPool } from '../db/pool';
import { UserRole, UserStatus } from '@fitxai/shared';

const createEmployeeSchema = z.object({
  firstName: z.string().min(2, 'El nombre es obligatorio'),
  lastName: z.string().min(2, 'Los apellidos son obligatorios'),
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').optional(),
  phone: z.string().optional(),
  documentId: z.string().min(5, 'Documento de identidad requerido'),
  employeeCode: z.string().optional(),
  department: z.string().optional(),
  jobTitle: z.string().optional(),
  schedule: z.string().optional(),
  hireDate: z.string().optional(),
});

const updateEmployeeSchema = z.object({
  firstName: z.string().min(2).optional(),
  lastName: z.string().min(2).optional(),
  phone: z.string().optional(),
  department: z.string().optional(),
  jobTitle: z.string().optional(),
  schedule: z.string().optional(),
  isActive: z.boolean().optional(),
});

/**
 * GET /employees
 * Listar todos los trabajadores de la empresa del usuario autenticado (ADMIN)
 */
export async function getEmployees(req: Request, res: Response) {
  try {
    const user = req.user!;

    // Aislamiento Multi-Tenant: Filtro estricto por company_id
    const employees = await query<any>(
      `SELECT 
        e.id,
        e.user_id,
        e.company_id,
        e.first_name,
        e.last_name,
        e.document_id,
        e.employee_code,
        e.department,
        e.job_title,
        e.schedule,
        e.hire_date,
        e.is_active,
        e.created_at,
        u.email,
        u.phone,
        u.status as user_status,
        u.last_login_at
      FROM employees e
      JOIN users u ON u.id = e.user_id
      WHERE e.company_id = $1
      ORDER BY e.created_at DESC`,
      [user.companyId]
    );

    return res.json({
      success: true,
      total: employees.length,
      data: employees,
    });
  } catch (error: any) {
    console.error('Error fetching employees:', error);
    return res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}

/**
 * GET /employees/:id
 * Consultar un trabajador por su ID con control estricto de permisos y aislamiento
 */
export async function getEmployeeById(req: Request, res: Response) {
  try {
    const user = req.user!;
    const { id } = req.params;

    // Regla de permisos: Si es TRABAJADOR, solo puede acceder a su propio ID
    if (user.role === UserRole.EMPLOYEE && user.employeeId !== id) {
      return res.status(403).json({
        success: false,
        error: 'Acceso denegado: Un trabajador solo puede acceder a su propia información.',
      });
    }

    const rows = await query<any>(
      `SELECT 
        e.id,
        e.user_id,
        e.company_id,
        e.first_name,
        e.last_name,
        e.document_id,
        e.employee_code,
        e.department,
        e.job_title,
        e.schedule,
        e.hire_date,
        e.is_active,
        e.created_at,
        u.email,
        u.phone,
        u.status as user_status,
        u.last_login_at
      FROM employees e
      JOIN users u ON u.id = e.user_id
      WHERE e.id = $1 AND e.company_id = $2
      LIMIT 1`,
      [id, user.companyId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Trabajador no encontrado o no pertenece a tu empresa.',
      });
    }

    return res.json({
      success: true,
      data: rows[0],
    });
  } catch (error: any) {
    console.error('Error fetching employee by id:', error);
    return res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}

/**
 * POST /employees
 * Crear un nuevo trabajador en la empresa del administrador autenticado
 */
export async function createEmployee(req: Request, res: Response) {
  const client = await dbPool.connect();
  try {
    const parseResult = createEmployeeSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Validación de datos de trabajador fallida',
        details: parseResult.error.errors,
      });
    }

    const user = req.user!;
    const {
      firstName,
      lastName,
      email,
      password = 'TemporalPass123!', // Contraseña inicial si no se provee
      phone,
      documentId,
      employeeCode,
      department,
      jobTitle,
      schedule = 'Lunes a Viernes: 08:00 - 16:30',
      hireDate,
    } = parseResult.data;

    // 1. Comprobar si el email ya existe
    const existingEmail = await client.query(
      `SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
      [email]
    );

    if (existingEmail.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: `Ya existe un usuario registrado con el email ${email}`,
      });
    }

    // 2. Comprobar si el documentId ya existe en la misma empresa
    const existingDoc = await client.query(
      `SELECT id FROM employees WHERE company_id = $1 AND document_id = $2 LIMIT 1`,
      [user.companyId, documentId]
    );

    if (existingDoc.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: `Ya existe un empleado con el documento ${documentId} en esta empresa`,
      });
    }

    await client.query('BEGIN');

    // 3. Crear usuario con rol EMPLOYEE y hash seguro
    const passwordHash = await bcrypt.hash(password, 10);
    const userRes = await client.query(
      `INSERT INTO users (company_id, email, password_hash, first_name, last_name, phone, role, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, company_id, email, first_name, last_name, phone, role, status, created_at`,
      [user.companyId, email.toLowerCase(), passwordHash, firstName, lastName, phone || null, UserRole.EMPLOYEE, UserStatus.ACTIVE]
    );

    const newUser = userRes.rows[0];

    // 4. Crear ficha de empleado
    const employeeRes = await client.query(
      `INSERT INTO employees (user_id, company_id, first_name, last_name, document_id, employee_code, department, job_title, schedule, hire_date, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10::timestamp with time zone, NOW()), true)
       RETURNING id, document_id, employee_code, department, job_title, schedule, hire_date, is_active, created_at`,
      [
        newUser.id,
        user.companyId,
        firstName,
        lastName,
        documentId,
        employeeCode || `EMP-${Date.now().toString().slice(-4)}`,
        department || null,
        jobTitle || null,
        schedule,
        hireDate || null,
      ]
    );

    const newEmployee = employeeRes.rows[0];

    // 5. Registrar en auditoría
    await client.query(
      `INSERT INTO audit_logs (company_id, user_id, action, entity_type, entity_id, ip_address, metadata)
       VALUES ($1, $2, 'EMPLOYEE_CREATED', 'employees', $3, $4, $5)`,
      [user.companyId, user.userId, newEmployee.id, req.ip, JSON.stringify({ email, documentId })]
    );

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      message: 'Trabajador creado exitosamente',
      data: {
        id: newEmployee.id,
        userId: newUser.id,
        companyId: user.companyId,
        firstName: newUser.first_name,
        lastName: newUser.last_name,
        email: newUser.email,
        phone: newUser.phone,
        documentId: newEmployee.document_id,
        employeeCode: newEmployee.employee_code,
        department: newEmployee.department,
        jobTitle: newEmployee.job_title,
        schedule: newEmployee.schedule,
        hireDate: newEmployee.hire_date,
        isActive: newEmployee.is_active,
        createdAt: newEmployee.created_at,
      },
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error creating employee:', error);
    return res.status(500).json({ success: false, error: 'Error interno del servidor' });
  } finally {
    client.release();
  }
}

/**
 * PUT /employees/:id
 * Editar datos de un trabajador (solo ADMIN de la misma empresa)
 */
export async function updateEmployee(req: Request, res: Response) {
  const client = await dbPool.connect();
  try {
    const parseResult = updateEmployeeSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Validación de actualización fallida',
        details: parseResult.error.errors,
      });
    }

    const user = req.user!;
    const { id } = req.params;
    const { firstName, lastName, phone, department, jobTitle, schedule, isActive } = parseResult.data;

    // Verificar que el empleado existe y pertenece a la empresa del admin
    const empRows = await client.query(
      `SELECT id, user_id, company_id FROM employees WHERE id = $1 AND company_id = $2 LIMIT 1`,
      [id, user.companyId]
    );

    if (empRows.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Trabajador no encontrado o no pertenece a tu empresa.',
      });
    }

    const emp = empRows.rows[0];

    await client.query('BEGIN');

    // Actualizar datos en users si se proporcionaron
    if (firstName || lastName || phone !== undefined || isActive !== undefined) {
      await client.query(
        `UPDATE users
         SET 
           first_name = COALESCE($1, first_name),
           last_name = COALESCE($2, last_name),
           phone = COALESCE($3, phone),
           status = CASE WHEN $4::boolean = false THEN 'INACTIVE' WHEN $4::boolean = true THEN 'ACTIVE' ELSE status END,
           updated_at = NOW()
         WHERE id = $5`,
        [firstName || null, lastName || null, phone || null, isActive ?? null, emp.user_id]
      );
    }

    // Actualizar datos en employees
    const updatedEmp = await client.query(
      `UPDATE employees
       SET
         first_name = COALESCE($1, first_name),
         last_name = COALESCE($2, last_name),
         department = COALESCE($3, department),
         job_title = COALESCE($4, job_title),
         schedule = COALESCE($5, schedule),
         is_active = COALESCE($6, is_active),
         updated_at = NOW()
       WHERE id = $7 AND company_id = $8
       RETURNING *`,
      [firstName || null, lastName || null, department || null, jobTitle || null, schedule || null, isActive ?? null, id, user.companyId]
    );

    // Auditoría
    await client.query(
      `INSERT INTO audit_logs (company_id, user_id, action, entity_type, entity_id, ip_address)
       VALUES ($1, $2, 'EMPLOYEE_UPDATED', 'employees', $3, $4)`,
      [user.companyId, user.userId, id, req.ip]
    );

    await client.query('COMMIT');

    return res.json({
      success: true,
      message: 'Trabajador actualizado exitosamente',
      data: updatedEmp.rows[0],
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error updating employee:', error);
    return res.status(500).json({ success: false, error: 'Error interno del servidor' });
  } finally {
    client.release();
  }
}

/**
 * DELETE /employees/:id
 * Desactivar un trabajador (ADMIN de la misma empresa)
 */
export async function deleteEmployee(req: Request, res: Response) {
  const client = await dbPool.connect();
  try {
    const user = req.user!;
    const { id } = req.params;

    // Verificar pertenencia a la empresa
    const empRows = await client.query(
      `SELECT id, user_id FROM employees WHERE id = $1 AND company_id = $2 LIMIT 1`,
      [id, user.companyId]
    );

    if (empRows.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Trabajador no encontrado o no pertenece a tu empresa.',
      });
    }

    const emp = empRows.rows[0];

    await client.query('BEGIN');

    // Desactivar en employees
    await client.query(
      `UPDATE employees SET is_active = false, updated_at = NOW() WHERE id = $1`,
      [id]
    );

    // Desactivar en users
    await client.query(
      `UPDATE users SET status = 'INACTIVE', updated_at = NOW() WHERE id = $1`,
      [emp.user_id]
    );

    // Revocar todas sus sesiones activas de inmediato
    await client.query(
      `UPDATE sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`,
      [emp.user_id]
    );

    // Registrar en auditoría
    await client.query(
      `INSERT INTO audit_logs (company_id, user_id, action, entity_type, entity_id, ip_address)
       VALUES ($1, $2, 'EMPLOYEE_DEACTIVATED', 'employees', $3, $4)`,
      [user.companyId, user.userId, id, req.ip]
    );

    await client.query('COMMIT');

    return res.json({
      success: true,
      message: 'Trabajador desactivado y sus sesiones revocadas con éxito.',
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error deleting employee:', error);
    return res.status(500).json({ success: false, error: 'Error interno del servidor' });
  } finally {
    client.release();
  }
}

import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { z } from 'zod';
import { query } from '../db/pool';
import { config } from '../config/env';
import { hashToken } from '../middlewares/auth.middleware';
import { UserRole, UserStatus } from '@fitxai/shared';

// Esquemas de validación Zod
const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  deviceFingerprint: z.string().optional(),
  platform: z.enum(['android', 'ios', 'web']).optional(),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Email inválido'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(10, 'Token de recuperación inválido'),
  newPassword: z.string()
    .min(8, 'La nueva contraseña debe tener al menos 8 caracteres')
    .regex(/[A-Z]/, 'Debe incluir al menos una letra mayúscula')
    .regex(/[0-9]/, 'Debe incluir al menos un número'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Contraseña actual requerida'),
  newPassword: z.string()
    .min(8, 'La nueva contraseña debe tener al menos 8 caracteres')
    .regex(/[A-Z]/, 'Debe incluir al menos una letra mayúscula')
    .regex(/[0-9]/, 'Debe incluir al menos un número'),
});

/**
 * POST /auth/login
 */
export async function login(req: Request, res: Response) {
  try {
    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Validación de entrada fallida',
        details: parseResult.error.errors,
      });
    }

    const { email, password, deviceFingerprint, platform } = parseResult.data;

    // Consulta parametrizada segura con datos de usuario y empresa
    const users = await query<any>(
      `SELECT u.id, u.company_id, u.email, u.password_hash, u.role, u.status,
              u.first_name, u.last_name, u.phone,
              c.name as company_name, c.is_active as company_active,
              e.id as employee_id, e.employee_code, e.department, e.job_title, e.schedule
       FROM users u
       JOIN companies c ON c.id = u.company_id
       LEFT JOIN employees e ON e.user_id = u.id
       WHERE LOWER(u.email) = LOWER($1)
       LIMIT 1`,
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({ success: false, error: 'Credenciales inválidas' });
    }

    const user = users[0];

    // Verificar si la empresa está activa
    if (!user.company_active) {
      return res.status(403).json({ success: false, error: 'La empresa se encuentra inactiva' });
    }

    // Verificar estado del usuario
    if (user.status !== UserStatus.ACTIVE) {
      return res.status(403).json({ success: false, error: 'La cuenta de usuario no está activa' });
    }

    // Verificar hash de contraseña
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ success: false, error: 'Credenciales inválidas' });
    }

    // Actualizar último login
    await query(`UPDATE users SET last_login_at = NOW() WHERE id = $1`, [user.id]);

    // Generar token JWT con identificador único de sesión
    const payload = {
      jti: crypto.randomUUID(),
      userId: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      companyId: user.company_id,
      employeeId: user.employee_id || undefined,
    };

    const token = jwt.sign(payload, config.jwtSecret, {
      expiresIn: config.jwtExpiration as any,
    });

    const tokenHash = hashToken(token);

    // Calcular expiración de la sesión (8 horas por defecto)
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);

    // Registrar sesión en base de datos
    await query(
      `INSERT INTO sessions (user_id, token_hash, ip_address, user_agent, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [user.id, tokenHash, req.ip, req.headers['user-agent'] || 'unknown', expiresAt]
    );

    // Registrar en auditoría
    await query(
      `INSERT INTO audit_logs (company_id, user_id, action, entity_type, entity_id, ip_address, metadata)
       VALUES ($1, $2, 'USER_LOGIN', 'users', $2, $3, $4)`,
      [user.company_id, user.id, req.ip, JSON.stringify({ platform, deviceFingerprint })]
    );

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        role: user.role,
        companyId: user.company_id,
        companyName: user.company_name,
        employeeProfile: user.employee_id
          ? {
              id: user.employee_id,
              firstName: user.first_name,
              lastName: user.last_name,
              employeeCode: user.employee_code,
              department: user.department,
              jobTitle: user.job_title,
              schedule: user.schedule,
            }
          : null,
      },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}

/**
 * POST /auth/logout
 */
export async function logout(req: Request, res: Response) {
  try {
    const user = req.user!;
    if (user.tokenHash) {
      // Revocar sesión actual
      await query(
        `UPDATE sessions SET revoked_at = NOW() WHERE token_hash = $1`,
        [user.tokenHash]
      );
    }

    // Registrar en auditoría
    await query(
      `INSERT INTO audit_logs (company_id, user_id, action, entity_type, entity_id, ip_address)
       VALUES ($1, $2, 'USER_LOGOUT', 'users', $2, $3)`,
      [user.companyId, user.userId, req.ip]
    );

    return res.json({
      success: true,
      message: 'Sesión cerrada correctamente y token revocado',
    });
  } catch (error: any) {
    console.error('Logout error:', error);
    return res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}

/**
 * POST /auth/forgot-password
 */
export async function forgotPassword(req: Request, res: Response) {
  try {
    const parseResult = forgotPasswordSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Email inválido',
        details: parseResult.error.errors,
      });
    }

    const { email } = parseResult.data;

    const users = await query<any>(
      `SELECT id, email, company_id, first_name FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
      [email]
    );

    // Por seguridad, si el usuario no existe respondemos con éxito genérico para no filtrar existencia de correos
    if (users.length === 0) {
      return res.json({
        success: true,
        message: 'Si el correo existe en el sistema, se ha generado el enlace de recuperación.',
      });
    }

    const user = users[0];
    // Generar token criptográficamente seguro
    const rawResetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawResetToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora de validez

    await query(
      `UPDATE users 
       SET reset_password_token = $1, reset_password_expires = $2 
       WHERE id = $3`,
      [tokenHash, expiresAt, user.id]
    );

    await query(
      `INSERT INTO audit_logs (company_id, user_id, action, entity_type, entity_id, ip_address)
       VALUES ($1, $2, 'PASSWORD_RESET_REQUESTED', 'users', $2, $3)`,
      [user.company_id, user.id, req.ip]
    );

    return res.json({
      success: true,
      message: 'Si el correo existe en el sistema, se ha generado el enlace de recuperación.',
      // Incluimos el token en desarrollo/test para que sea inmediatamente accionable
      resetToken: config.env !== 'production' ? rawResetToken : undefined,
    });
  } catch (error: any) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}

/**
 * POST /auth/reset-password
 */
export async function resetPassword(req: Request, res: Response) {
  try {
    const parseResult = resetPasswordSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Datos de restablecimiento inválidos',
        details: parseResult.error.errors,
      });
    }

    const { token, newPassword } = parseResult.data;
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const users = await query<any>(
      `SELECT id, company_id, email, reset_password_expires 
       FROM users 
       WHERE reset_password_token = $1 AND reset_password_expires > NOW()
       LIMIT 1`,
      [tokenHash]
    );

    if (users.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'El token de recuperación es inválido o ha expirado',
      });
    }

    const user = users[0];
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Actualizar contraseña y limpiar token
    await query(
      `UPDATE users 
       SET password_hash = $1, reset_password_token = NULL, reset_password_expires = NULL, updated_at = NOW()
       WHERE id = $2`,
      [newPasswordHash, user.id]
    );

    // Revocar todas las sesiones previas por seguridad
    await query(
      `UPDATE sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`,
      [user.id]
    );

    await query(
      `INSERT INTO audit_logs (company_id, user_id, action, entity_type, entity_id, ip_address)
       VALUES ($1, $2, 'PASSWORD_RESET_COMPLETED', 'users', $2, $3)`,
      [user.company_id, user.id, req.ip]
    );

    return res.json({
      success: true,
      message: 'Contraseña restablecida con éxito. Puedes iniciar sesión con tus nuevas credenciales.',
    });
  } catch (error: any) {
    console.error('Reset password error:', error);
    return res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}

/**
 * POST /auth/change-password
 */
export async function changePassword(req: Request, res: Response) {
  try {
    const parseResult = changePasswordSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Validación de contraseña fallida',
        details: parseResult.error.errors,
      });
    }

    const user = req.user!;
    const { currentPassword, newPassword } = parseResult.data;

    const userRows = await query<any>(
      `SELECT password_hash FROM users WHERE id = $1 LIMIT 1`,
      [user.userId]
    );

    if (userRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }

    const match = await bcrypt.compare(currentPassword, userRows[0].password_hash);
    if (!match) {
      return res.status(400).json({
        success: false,
        error: 'La contraseña actual no coincide',
      });
    }

    const newHash = await bcrypt.hash(newPassword, 10);

    await query(
      `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
      [newHash, user.userId]
    );

    // Revocar otras sesiones
    if (user.tokenHash) {
      await query(
        `UPDATE sessions SET revoked_at = NOW() WHERE user_id = $1 AND token_hash != $2`,
        [user.userId, user.tokenHash]
      );
    }

    await query(
      `INSERT INTO audit_logs (company_id, user_id, action, entity_type, entity_id, ip_address)
       VALUES ($1, $2, 'PASSWORD_CHANGED', 'users', $2, $3)`,
      [user.companyId, user.userId, req.ip]
    );

    return res.json({
      success: true,
      message: 'Contraseña actualizada correctamente.',
    });
  } catch (error: any) {
    console.error('Change password error:', error);
    return res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}

const registerCompanySchema = z.object({
  companyName: z.string().min(2, 'El nombre de la empresa es obligatorio'),
  cif: z.string().min(4, 'El CIF es obligatorio'),
  adminFirstName: z.string().min(2, 'El nombre del administrador es obligatorio'),
  adminLastName: z.string().min(2, 'Los apellidos son obligatorios'),
  adminEmail: z.string().email('Email inválido'),
  adminPassword: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  adminPhone: z.string().optional(),
});

/**
 * POST /auth/register-company
 * Registro de nueva empresa y su administrador inicial (onboarding producción)
 */
export async function registerCompany(req: Request, res: Response) {
  try {
    const parseResult = registerCompanySchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: parseResult.error.errors[0]?.message || 'Datos incompletos',
      });
    }

    const { companyName, cif, adminFirstName, adminLastName, adminEmail, adminPassword, adminPhone } = parseResult.data;

    // Verificar si el CIF ya existe
    const existingCompany = await query<any>(
      `SELECT id FROM companies WHERE LOWER(cif) = LOWER($1) LIMIT 1`,
      [cif]
    );
    if (existingCompany.length > 0) {
      return res.status(409).json({ success: false, error: 'Ya existe una empresa registrada con ese CIF' });
    }

    // Verificar si el email ya existe
    const existingUser = await query<any>(
      `SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
      [adminEmail]
    );
    if (existingUser.length > 0) {
      return res.status(409).json({ success: false, error: 'Ya existe un usuario con este correo electrónico' });
    }

    // Crear empresa
    const companyRes = await query<any>(
      `INSERT INTO companies (name, cif, contact_email, contact_phone, is_active)
       VALUES ($1, $2, $3, $4, true)
       RETURNING id, name, cif`,
      [companyName, cif, adminEmail, adminPhone || null]
    );
    const newCompany = companyRes[0];

    // Crear configuración por defecto
    await query(
      `INSERT INTO settings (company_id, key, value, description)
       VALUES ($1, 'gps_accuracy_threshold', '150', 'Tolerancia estándar GPS')`,
      [newCompany.id]
    );

    // Crear admin con hash bcrypt
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    const userRes = await query<any>(
      `INSERT INTO users (company_id, email, password_hash, first_name, last_name, phone, role, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'ADMIN', 'ACTIVE')
       RETURNING id, email, first_name, last_name, phone, role, status, created_at`,
      [newCompany.id, adminEmail.toLowerCase().trim(), passwordHash, adminFirstName, adminLastName, adminPhone || null]
    );
    const newUser = userRes[0];

    // Generar Token JWT
    const token = jwt.sign(
      {
        userId: newUser.id,
        companyId: newCompany.id,
        role: newUser.role,
        email: newUser.email,
      },
      config.jwtSecret,
      { expiresIn: (config.jwtExpiration || '7d') as any }
    );

    const tokenHashStr = hashToken(token);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Registrar sesión
    await query(
      `INSERT INTO sessions (user_id, company_id, token_hash, ip_address, user_agent, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [newUser.id, newCompany.id, tokenHashStr, req.ip, req.headers['user-agent'] || 'Web Browser', expiresAt]
    );

    // Auditoría
    await query(
      `INSERT INTO audit_logs (company_id, user_id, action, entity_type, entity_id, ip_address)
       VALUES ($1, $2, 'COMPANY_REGISTERED', 'companies', $1, $3)`,
      [newCompany.id, newUser.id, req.ip]
    );

    return res.status(201).json({
      success: true,
      message: 'Empresa y administrador registrados con éxito',
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        firstName: newUser.first_name,
        lastName: newUser.last_name,
        phone: newUser.phone,
        role: newUser.role,
        companyId: newCompany.id,
        companyName: newCompany.name,
      },
    });
  } catch (error: any) {
    console.error('Error registrando empresa:', error);
    return res.status(500).json({ success: false, error: 'Error interno del servidor al registrar la empresa' });
  }
}

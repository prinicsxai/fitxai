import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { query } from '../db/pool';
import { config } from '../config/env';
import { UserRole, UserStatus } from '@fitxai/shared';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  deviceFingerprint: z.string().optional(),
  platform: z.enum(['android', 'ios', 'web']).optional(),
});

export async function login(req: Request, res: Response) {
  try {
    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: parseResult.error.errors,
      });
    }

    const { email, password, deviceFingerprint, platform } = parseResult.data;

    // Consulta parametrizada segura
    const users = await query<any>(
      `SELECT u.id, u.company_id, u.email, u.password_hash, u.role, u.status,
              e.id as employee_id, e.first_name, e.last_name, e.employee_code
       FROM users u
       LEFT JOIN employees e ON e.user_id = u.id
       WHERE LOWER(u.email) = LOWER($1)
       LIMIT 1`,
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const user = users[0];

    if (user.status !== UserStatus.ACTIVE) {
      return res.status(403).json({ success: false, error: 'User account is not active' });
    }

    // Verificar hash de contraseña
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    // Actualizar último login
    await query(`UPDATE users SET last_login_at = NOW() WHERE id = $1`, [user.id]);

    // Registrar en auditoría
    await query(
      `INSERT INTO audit_logs (company_id, user_id, action, entity_type, entity_id, ip_address)
       VALUES ($1, $2, 'USER_LOGIN', 'users', $2, $3)`,
      [user.company_id, user.id, req.ip]
    );

    // Generar token JWT
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      companyId: user.company_id,
      employeeId: user.employee_id || undefined,
    };

    const token = jwt.sign(payload, config.jwtSecret, {
      expiresIn: config.jwtExpiration as any,
    });

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        companyId: user.company_id,
        employeeProfile: user.employee_id
          ? {
              id: user.employee_id,
              firstName: user.first_name,
              lastName: user.last_name,
              employeeCode: user.employee_code,
            }
          : null,
      },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

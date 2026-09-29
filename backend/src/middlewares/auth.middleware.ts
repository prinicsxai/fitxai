import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config/env';
import { query } from '../db/pool';
import { UserRole, UserStatus } from '@fitxai/shared';

export interface AuthenticatedUser {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  companyId: string;
  employeeId?: string;
  tokenHash?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Función utilitaria para calcular hash de tokens
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Middleware para requerir autenticación JWT válida y sesión activa no revocada
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Authorization token missing or malformed',
    });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as AuthenticatedUser;
    const tokenHash = hashToken(token);

    // Comprobar estado de la sesión en base de datos
    const sessionRows = await query<any>(
      `SELECT id, revoked_at, expires_at 
       FROM sessions 
       WHERE token_hash = $1 
       LIMIT 1`,
      [tokenHash]
    );

    // Si la sesión existe y fue revocada o ya expiró
    if (sessionRows.length > 0) {
      const session = sessionRows[0];
      if (session.revoked_at || new Date(session.expires_at) < new Date()) {
        return res.status(401).json({
          success: false,
          error: 'Session has been revoked or expired. Please login again.',
        });
      }
    }

    // Comprobar que el usuario continúe existiendo y activo
    const userRows = await query<any>(
      `SELECT id, status, company_id, role, first_name, last_name 
       FROM users 
       WHERE id = $1 
       LIMIT 1`,
      [decoded.userId]
    );

    if (userRows.length === 0 || userRows[0].status !== UserStatus.ACTIVE) {
      return res.status(403).json({
        success: false,
        error: 'User account is not active or no longer exists',
      });
    }

    req.user = {
      ...decoded,
      tokenHash,
      companyId: userRows[0].company_id,
      role: userRows[0].role,
      firstName: userRows[0].first_name,
      lastName: userRows[0].last_name,
    };

    next();
  } catch (err: any) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired token',
    });
  }
}

/**
 * Middleware para exigir roles específicos (ADMIN, EMPLOYEE, etc.)
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Acceso denegado: Se requiere uno de los roles [${allowedRoles.join(', ')}]`,
      });
    }

    next();
  };
}

/**
 * Middleware para garantizar el aislamiento multi-tenant por empresa
 */
export function requireSameCompany(paramName: string = 'companyId') {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const requestedCompanyId = req.params[paramName] || req.body[paramName] || req.query[paramName];
    if (requestedCompanyId && requestedCompanyId !== req.user.companyId) {
      return res.status(403).json({
        success: false,
        error: 'Aislamiento multi-tenant: No tienes permiso para acceder a los datos de otra empresa.',
      });
    }

    next();
  };
}

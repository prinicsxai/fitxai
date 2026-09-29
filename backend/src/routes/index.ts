import { Router } from 'express';
import { getHealthStatus } from '../controllers/health.controller';
import { login } from '../controllers/auth.controller';
import { registerPunch } from '../controllers/attendance.controller';
import { getAdminAttendance, getAdminDashboardStats } from '../controllers/admin.controller';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';
import { authRateLimiter } from '../middlewares/security.middleware';
import { UserRole } from '@fitxai/shared';

export const apiRouter = Router();

// Endpoint público de salud del sistema
apiRouter.get('/health', getHealthStatus);

// Autenticación
apiRouter.post('/auth/login', authRateLimiter, login);

// Fichajes (Trabajador)
apiRouter.post('/attendance/punch', requireAuth, registerPunch);

// Panel de Administración (Admin / Jefe)
apiRouter.get('/admin/attendance', requireAuth, requireRole(UserRole.ADMIN, UserRole.MANAGER), getAdminAttendance);
apiRouter.get('/admin/stats', requireAuth, requireRole(UserRole.ADMIN, UserRole.MANAGER), getAdminDashboardStats);

import { Router } from 'express';
import { getHealthStatus } from '../controllers/health.controller';
import { 
  login, 
  logout, 
  forgotPassword, 
  resetPassword, 
  changePassword 
} from '../controllers/auth.controller';
import { getMe } from '../controllers/user.controller';
import { createCompany, getCompanies } from '../controllers/company.controller';
import { 
  getEmployees, 
  getEmployeeById, 
  createEmployee, 
  updateEmployee, 
  deleteEmployee 
} from '../controllers/employee.controller';
import { registerPunch } from '../controllers/attendance.controller';
import { getAdminAttendance, getAdminDashboardStats } from '../controllers/admin.controller';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';
import { authRateLimiter } from '../middlewares/security.middleware';
import { UserRole } from '@fitxai/shared';

export const apiRouter = Router();

// ==========================================
// 1. SALUD DEL SISTEMA
// ==========================================
apiRouter.get('/health', getHealthStatus);

// ==========================================
// 2. AUTENTICACIÓN
// ==========================================
apiRouter.post('/auth/login', authRateLimiter, login);
apiRouter.post('/auth/logout', requireAuth, logout);
apiRouter.post('/auth/forgot-password', authRateLimiter, forgotPassword);
apiRouter.post('/auth/reset-password', authRateLimiter, resetPassword);
apiRouter.post('/auth/change-password', requireAuth, changePassword);

// ==========================================
// 3. USUARIOS
// ==========================================
apiRouter.get('/users/me', requireAuth, getMe);

// ==========================================
// 4. EMPRESAS (MULTI-TENANT)
// ==========================================
apiRouter.post('/companies', createCompany);
apiRouter.get('/companies', requireAuth, requireRole(UserRole.ADMIN, UserRole.MANAGER), getCompanies);

// ==========================================
// 5. TRABAJADORES (EMPLOYEES)
// ==========================================
apiRouter.get('/employees', requireAuth, requireRole(UserRole.ADMIN, UserRole.MANAGER), getEmployees);
apiRouter.get('/employees/:id', requireAuth, getEmployeeById);
apiRouter.post('/employees', requireAuth, requireRole(UserRole.ADMIN), createEmployee);
apiRouter.put('/employees/:id', requireAuth, requireRole(UserRole.ADMIN), updateEmployee);
apiRouter.delete('/employees/:id', requireAuth, requireRole(UserRole.ADMIN), deleteEmployee);

// ==========================================
// 6. FICHAJES (TRABAJADOR)
// ==========================================
apiRouter.post('/attendance/punch', requireAuth, registerPunch);

// ==========================================
// 7. PANEL ADMINISTRADOR
// ==========================================
apiRouter.get('/admin/attendance', requireAuth, requireRole(UserRole.ADMIN, UserRole.MANAGER), getAdminAttendance);
apiRouter.get('/admin/stats', requireAuth, requireRole(UserRole.ADMIN, UserRole.MANAGER), getAdminDashboardStats);

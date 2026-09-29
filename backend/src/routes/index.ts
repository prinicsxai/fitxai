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
import { 
  createCompany, 
  getCompanies, 
  getCompanySettings, 
  updateCompanySettings 
} from '../controllers/company.controller';
import { 
  getEmployees, 
  getEmployeeById, 
  createEmployee, 
  updateEmployee, 
  deleteEmployee 
} from '../controllers/employee.controller';
import { 
  registerPunch, 
  getMyAttendanceStatus, 
  getMyAttendanceHistory, 
  getAttendanceById,
  getMyIncidents,
  correctAttendanceRecord 
} from '../controllers/attendance.controller';
import { 
  getAdminAttendance, 
  getAdminDashboardStats, 
  getEmployeeAttendanceHistory 
} from '../controllers/admin.controller';
import { streamRealtimeEvents } from '../controllers/realtime.controller';
import { 
  getSchedules, 
  createSchedule, 
  updateSchedule, 
  deleteSchedule 
} from '../controllers/schedule.controller';
import { 
  getIncidents, 
  createIncident, 
  reviewIncident, 
  approveIncident, 
  rejectIncident 
} from '../controllers/incident.controller';
import { 
  getDetailedReport, 
  exportReportCsv, 
  exportReportExcel, 
  exportReportPdf 
} from '../controllers/report.controller';
import { getAuditLogs } from '../controllers/audit.controller';
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
// 4. EMPRESAS Y CONFIGURACIÓN (MULTI-TENANT)
// ==========================================
apiRouter.post('/companies', createCompany);
apiRouter.get('/companies', requireAuth, requireRole(UserRole.ADMIN, UserRole.MANAGER), getCompanies);
apiRouter.get('/companies/settings', requireAuth, requireRole(UserRole.ADMIN, UserRole.MANAGER), getCompanySettings);
apiRouter.put('/companies/settings', requireAuth, requireRole(UserRole.ADMIN), updateCompanySettings);

// ==========================================
// 5. TRABAJADORES (EMPLOYEES)
// ==========================================
apiRouter.get('/employees', requireAuth, requireRole(UserRole.ADMIN, UserRole.MANAGER), getEmployees);
apiRouter.get('/employees/:id', requireAuth, getEmployeeById);
apiRouter.get('/employees/:id/attendance', requireAuth, requireRole(UserRole.ADMIN, UserRole.MANAGER), getEmployeeAttendanceHistory);
apiRouter.post('/employees', requireAuth, requireRole(UserRole.ADMIN), createEmployee);
apiRouter.put('/employees/:id', requireAuth, requireRole(UserRole.ADMIN), updateEmployee);
apiRouter.delete('/employees/:id', requireAuth, requireRole(UserRole.ADMIN), deleteEmployee);

// ==========================================
// 6. FICHAJES (TRABAJADOR Y AUDITORÍA)
// ==========================================
apiRouter.post('/attendance/punch', requireAuth, registerPunch);
apiRouter.get('/attendance/my-status', requireAuth, getMyAttendanceStatus);
apiRouter.get('/attendance/my-punches', requireAuth, getMyAttendanceHistory);
apiRouter.get('/attendance/:id', requireAuth, getAttendanceById);
apiRouter.put('/attendance/:id/correct', requireAuth, requireRole(UserRole.ADMIN), correctAttendanceRecord);

// ==========================================
// 7. HORARIOS DE TRABAJO (SCHEDULES)
// ==========================================
apiRouter.get('/schedules', requireAuth, requireRole(UserRole.ADMIN, UserRole.MANAGER), getSchedules);
apiRouter.post('/schedules', requireAuth, requireRole(UserRole.ADMIN), createSchedule);
apiRouter.put('/schedules/:id', requireAuth, requireRole(UserRole.ADMIN), updateSchedule);
apiRouter.delete('/schedules/:id', requireAuth, requireRole(UserRole.ADMIN), deleteSchedule);

// ==========================================
// 8. GESTIÓN INTEGRAL DE INCIDENCIAS
// ==========================================
apiRouter.get('/incidents', requireAuth, getIncidents);
apiRouter.get('/incidents/my-incidents', requireAuth, getMyIncidents);
apiRouter.post('/incidents', requireAuth, createIncident);
apiRouter.post('/incidents/:id/review', requireAuth, requireRole(UserRole.ADMIN, UserRole.MANAGER), reviewIncident);
apiRouter.post('/incidents/:id/approve', requireAuth, requireRole(UserRole.ADMIN), approveIncident);
apiRouter.post('/incidents/:id/reject', requireAuth, requireRole(UserRole.ADMIN), rejectIncident);

// ==========================================
// 9. INFORMES Y EXPORTACIONES EMPRESARIALES
// ==========================================
apiRouter.get('/reports', requireAuth, requireRole(UserRole.ADMIN, UserRole.MANAGER), getDetailedReport);
apiRouter.get('/reports/export/csv', requireAuth, requireRole(UserRole.ADMIN, UserRole.MANAGER), exportReportCsv);
apiRouter.get('/reports/export/excel', requireAuth, requireRole(UserRole.ADMIN, UserRole.MANAGER), exportReportExcel);
apiRouter.get('/reports/export/pdf', requireAuth, requireRole(UserRole.ADMIN, UserRole.MANAGER), exportReportPdf);

// ==========================================
// 10. AUDITORÍA INMUTABLE DEL SISTEMA
// ==========================================
apiRouter.get('/audit/logs', requireAuth, requireRole(UserRole.ADMIN, UserRole.MANAGER), getAuditLogs);

// ==========================================
// 11. PANEL ADMINISTRADOR (DASHBOARD & STATS)
// ==========================================
apiRouter.get('/admin/attendance', requireAuth, requireRole(UserRole.ADMIN, UserRole.MANAGER), getAdminAttendance);
apiRouter.get('/admin/stats', requireAuth, requireRole(UserRole.ADMIN, UserRole.MANAGER), getAdminDashboardStats);

// ==========================================
// 12. EVENTOS EN TIEMPO REAL (SSE)
// ==========================================
apiRouter.get('/realtime/stream', streamRealtimeEvents);

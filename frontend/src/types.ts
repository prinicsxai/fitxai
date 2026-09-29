export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: 'ADMIN' | 'EMPLOYEE' | 'MANAGER';
  companyId: string;
  companyName: string;
}

export interface DashboardStats {
  totalEmployees: number;
  activeEmployees: number;
  todayPunches: number;
  todayCheckIns: number;
  todayCheckOuts: number;
  todayHoursWorked: number;
  pendingIncidents: number;
}

export interface EmployeeItem {
  id: string;
  user_id: string;
  company_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  document_id: string;
  employee_code?: string;
  department?: string;
  job_title?: string;
  schedule?: string;
  hire_date: string;
  is_active: boolean;
  user_status?: string;
  created_at: string;
}

export interface AttendanceRecordItem {
  id: string;
  type: 'CHECK_IN' | 'CHECK_OUT';
  tipo?: string;
  fecha?: string;
  hora?: string;
  timestamp: string;
  status: string;
  notes?: string;
  employee_id: string;
  first_name: string;
  last_name: string;
  document_id: string;
  employee_code?: string;
  department?: string;
  job_title?: string;
  company_id?: string;
  company_name: string;
  location_id?: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  ip_origen?: string;
  dispositivo?: string;
  creado_en?: string;
  location_captured_at?: string;
}

export type SidebarSection = 
  | 'dashboard'
  | 'employees'
  | 'attendance'
  | 'map'
  | 'schedules'
  | 'reports'
  | 'incidents'
  | 'audit'
  | 'settings'
  | 'account';

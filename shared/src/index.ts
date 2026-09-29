/**
 * FITXAI Shared Types and Interfaces
 * Definiciones comunes entre backend, frontend web y mobile.
 */

// ==========================================
// ENUMS & CONSTANTES
// ==========================================

export enum UserRole {
  ADMIN = 'ADMIN',
  EMPLOYEE = 'EMPLOYEE',
  MANAGER = 'MANAGER',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
}

export enum PunchType {
  CHECK_IN = 'CHECK_IN',   // Entrada
  CHECK_OUT = 'CHECK_OUT', // Salida
}

export enum PunchStatus {
  VERIFIED = 'VERIFIED',
  FLAGGED = 'FLAGGED',
  REJECTED = 'REJECTED',
}

export enum IncidentStatus {
  PENDING = 'PENDING',
  REVIEWED = 'REVIEWED',
  RESOLVED = 'RESOLVED',
  DISMISSED = 'DISMISSED',
}

export enum IncidentSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

export enum NotificationType {
  INFO = 'INFO',
  WARNING = 'WARNING',
  ALERT = 'ALERT',
}

// ==========================================
// ENTIDADES DE BASE DE DATOS
// ==========================================

export interface Company {
  id: string;
  name: string;
  cif: string; // Identificador fiscal
  address?: string;
  contactEmail: string;
  contactPhone?: string;
  timezone: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  companyId: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Employee {
  id: string;
  userId: string;
  companyId: string;
  firstName: string;
  lastName: string;
  documentId: string; // DNI / NIE / Pasaporte
  employeeCode?: string;
  department?: string;
  jobTitle?: string;
  hireDate: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Fichaje puntual (Attendance Record)
 */
export interface AttendanceRecord {
  id: string;
  employeeId: string;
  companyId: string;
  type: PunchType;
  timestamp: string; // ISO-8601 con hora exacta
  status: PunchStatus;
  deviceId?: string;
  locationId?: string; // Relación 1:1 directa con location_record
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Registro de ubicación PUNTUAL.
 * 
 * POLÍTICA ESTRICTA:
 * Cada location_record está asociado a un fichaje concreto.
 * Prohibido el tracking continuo, rutas periódicas o tracking en segundo plano.
 * El GPS se adquiere exclusivamente al momento de presionar "Fichar" y se apaga de inmediato.
 */
export interface LocationRecord {
  id: string;
  attendanceRecordId: string;
  latitude: number;
  longitude: number;
  accuracy: number; // Precisión en metros (GPS accuracy)
  altitude?: number;
  capturedAt: string; // Momento exacto de lectura del sensor
  provider?: string; // 'gps' | 'network' | 'fused'
  isMocked?: boolean; // Detección de fake GPS / simuladores
  ipAddress?: string;
  createdAt: string;
}

export interface Device {
  id: string;
  userId: string;
  deviceFingerprint: string;
  platform: 'android' | 'ios' | 'web';
  osVersion?: string;
  appVersion?: string;
  deviceName?: string;
  isTrusted: boolean;
  lastUsedAt: string;
  createdAt: string;
}

export interface Session {
  id: string;
  userId: string;
  deviceId?: string;
  tokenHash: string;
  ipAddress?: string;
  userAgent?: string;
  expiresAt: string;
  createdAt: string;
  revokedAt?: string;
}

export interface Incident {
  id: string;
  companyId: string;
  employeeId: string;
  attendanceRecordId?: string;
  type: string; // e.g., 'LOCATION_ACCURACY_LOW', 'OUT_OF_GEOFENCE', 'MANUAL_EDIT'
  severity: IncidentSeverity;
  description: string;
  status: IncidentStatus;
  resolvedById?: string;
  resolvedAt?: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  companyId?: string;
  userId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  ipAddress?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface Setting {
  id: string;
  companyId?: string; // Null para ajustes globales del sistema
  key: string;
  value: string; // JSON serializado o string
  description?: string;
  updatedAt: string;
}

// ==========================================
// DTOs Y CONTRATOS DE API
// ==========================================

export interface PunchRequest {
  type: PunchType;
  latitude: number;
  longitude: number;
  accuracy: number; // Precisión GPS en metros
  altitude?: number;
  deviceId?: string;
  notes?: string;
}

export interface PunchResponse {
  success: boolean;
  message: string;
  record: {
    id: string;
    employeeId: string;
    companyId: string;
    type: PunchType;
    timestamp: string;
    location: {
      latitude: number;
      longitude: number;
      accuracy: number;
      capturedAt: string;
    };
  };
}

export interface AuthLoginRequest {
  email: string;
  password?: string;
  deviceFingerprint?: string;
  platform?: 'android' | 'ios' | 'web';
}

export interface AuthResponse {
  success: boolean;
  token: string;
  user: {
    id: string;
    email: string;
    role: UserRole;
    companyId: string;
    employeeProfile?: {
      id: string;
      firstName: string;
      lastName: string;
      employeeCode?: string;
    };
  };
}

export interface HealthCheckResponse {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  services: {
    database: {
      status: 'connected' | 'disconnected' | 'error';
      latencyMs?: number;
    };
    server: {
      uptimeSeconds: number;
      environment: string;
      version: string;
    };
  };
}

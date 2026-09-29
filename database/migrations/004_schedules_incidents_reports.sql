-- ========================================================
-- FITXAI - Migration 004: Work Schedules, Incidents & Reports
-- Soporte completo para gestión de horarios empresariales,
-- enriquecimiento de incidencias con comentarios de auditoría
-- y cómputo avanzado de horas y anomalías.
-- ========================================================

-- 1. Crear tabla de horarios de trabajo (WORK_SCHEDULES)
CREATE TABLE IF NOT EXISTS work_schedules (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    company_id VARCHAR(36) NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    employee_id VARCHAR(36) REFERENCES employees(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    start_time VARCHAR(5) NOT NULL DEFAULT '08:00',
    end_time VARCHAR(5) NOT NULL DEFAULT '16:30',
    work_days VARCHAR(100) NOT NULL DEFAULT 'L,M,X,J,V',
    break_minutes INTEGER NOT NULL DEFAULT 30,
    break_start VARCHAR(5) DEFAULT '13:00',
    break_end VARCHAR(5) DEFAULT '13:30',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_work_schedules_company ON work_schedules(company_id);
CREATE INDEX IF NOT EXISTS idx_work_schedules_employee ON work_schedules(employee_id);

-- 2. Ampliar tabla incidents con comentarios administrativos y horas solicitadas
ALTER TABLE incidents
    ADD COLUMN IF NOT EXISTS admin_comment TEXT,
    ADD COLUMN IF NOT EXISTS requested_time TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS requested_punch_type VARCHAR(20),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- 3. Semilla básica de horarios predeterminados para empresas existentes
INSERT INTO work_schedules (company_id, name, start_time, end_time, work_days, break_minutes)
SELECT id, 'Jornada Continua General', '08:00', '16:30', 'L,M,X,J,V', 30
FROM companies
WHERE NOT EXISTS (
    SELECT 1 FROM work_schedules WHERE work_schedules.company_id = companies.id
);

-- ========================================================
-- FITXAI - Migration 002: Multi-tenant and User Profiles Update
-- Añadir datos de usuario (nombre, apellidos, teléfono, reset password)
-- y datos ampliados de trabajador (horario)
-- ========================================================

-- Actualizar tabla users con campos requeridos por usuario
ALTER TABLE users 
    ADD COLUMN IF NOT EXISTS first_name VARCHAR(100),
    ADD COLUMN IF NOT EXISTS last_name VARCHAR(100),
    ADD COLUMN IF NOT EXISTS phone VARCHAR(50),
    ADD COLUMN IF NOT EXISTS reset_password_token VARCHAR(255),
    ADD COLUMN IF NOT EXISTS reset_password_expires TIMESTAMP WITH TIME ZONE;

-- Actualizar tabla employees con campo de horario
ALTER TABLE employees 
    ADD COLUMN IF NOT EXISTS schedule VARCHAR(255) DEFAULT 'Lunes a Viernes: 08:00 - 16:30';

-- Migrar nombres existentes de employees a users si ya existían
UPDATE users u
SET 
    first_name = COALESCE(u.first_name, e.first_name, 'Admin'),
    last_name = COALESCE(u.last_name, e.last_name, 'Sistema'),
    phone = COALESCE(u.phone, '+34 600 000 000')
FROM employees e
WHERE e.user_id = u.id;

-- Para usuarios admin que no tengan employee asociado
UPDATE users 
SET 
    first_name = COALESCE(first_name, 'Administrador'),
    last_name = COALESCE(last_name, 'Principal'),
    phone = COALESCE(phone, '+34 600 000 000')
WHERE first_name IS NULL;

-- Índices adicionales para rendimiento y seguridad multi-tenant
CREATE INDEX IF NOT EXISTS idx_users_email_company ON users(email, company_id);
CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_password_token) WHERE reset_password_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_employees_company_active ON employees(company_id, is_active);
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);

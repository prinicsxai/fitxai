-- ========================================================
-- FITXAI - Seed Data Initial
-- Entorno inicial con Empresa Demo, Admin y Trabajador
-- ========================================================

-- Empresa Demo
INSERT INTO companies (id, name, cif, address, contact_email, contact_phone, timezone)
VALUES (
    'c1111111-1111-1111-1111-111111111111',
    'Tech Logistics Iberia S.L.',
    'B-12345678',
    'Paseo de la Castellana 100, Madrid',
    'admin@techlogistics.es',
    '+34 910 000 000',
    'Europe/Madrid'
) ON CONFLICT (cif) DO NOTHING;

-- Usuario Admin (contraseña hash de ejemplo: "Admin1234!")
-- bcrypt hash de "Admin1234!": $2b$10$wE4H5dE3h3fU89NqM..RquP8oQe89c6B1y2bA3p7yC2vRz3yV3o1e
INSERT INTO users (id, company_id, email, password_hash, role, status)
VALUES (
    'u1111111-1111-1111-1111-111111111111',
    'c1111111-1111-1111-1111-111111111111',
    'admin@techlogistics.es',
    '$2a$10$NmtOFnIlSy0xEvXgkRqZ8eVPfBjgoB1grl4Fi/v6U4x84IZBnCHUS',
    'ADMIN',
    'ACTIVE'
) ON CONFLICT (email) DO NOTHING;

-- Usuario Trabajador
INSERT INTO users (id, company_id, email, password_hash, role, status)
VALUES (
    'u2222222-2222-2222-2222-222222222222',
    'c1111111-1111-1111-1111-111111111111',
    'carlos.garcia@techlogistics.es',
    '$2a$10$NmtOFnIlSy0xEvXgkRqZ8eVPfBjgoB1grl4Fi/v6U4x84IZBnCHUS',
    'EMPLOYEE',
    'ACTIVE'
) ON CONFLICT (email) DO NOTHING;

-- Perfil de Empleado para Trabajador
INSERT INTO employees (id, user_id, company_id, first_name, last_name, document_id, employee_code, department, job_title)
VALUES (
    'e2222222-2222-2222-2222-222222222222',
    'u2222222-2222-2222-2222-222222222222',
    'c1111111-1111-1111-1111-111111111111',
    'Carlos',
    'García Moreno',
    '48765432X',
    'EMP-0042',
    'Operaciones',
    'Técnico de Campo'
) ON CONFLICT (user_id) DO NOTHING;

-- Ajustes iniciales de la empresa
INSERT INTO settings (id, company_id, key, value, description)
VALUES 
(
    's1111111-1111-1111-1111-111111111111',
    'c1111111-1111-1111-1111-111111111111',
    'gps_accuracy_threshold_meters',
    '150',
    'Precisión máxima tolerada para aceptar el fichaje sin alerta'
),
(
    's2222222-2222-2222-2222-222222222222',
    'c1111111-1111-1111-1111-111111111111',
    'require_gps_on_punch',
    'true',
    'Si se requiere ubicación GPS de forma obligatoria en cada fichaje'
)
ON CONFLICT (company_id, key) DO NOTHING;

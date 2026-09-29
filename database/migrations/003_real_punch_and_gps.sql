-- ========================================================
-- FITXAI - Migration 003: Real Punch and GPS Precision
-- Añadir campos directos de coordenadas, precisión e IP
-- a attendance_records para consulta de alto rendimiento
-- garantizando la autoridad del servidor y unicidad puntual.
-- ========================================================

ALTER TABLE attendance_records 
    ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS accuracy DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45),
    ADD COLUMN IF NOT EXISTS device_info VARCHAR(255);

-- Sincronizar datos históricos existentes desde location_records
UPDATE attendance_records ar
SET 
    latitude = lr.latitude,
    longitude = lr.longitude,
    accuracy = lr.accuracy,
    ip_address = lr.ip_address
FROM location_records lr
WHERE lr.attendance_record_id = ar.id
  AND ar.latitude IS NULL;

-- Índice para optimizar comprobación de duplicados y secuencias lógicas
CREATE INDEX IF NOT EXISTS idx_attendance_emp_company_recent 
    ON attendance_records(company_id, employee_id, timestamp DESC);

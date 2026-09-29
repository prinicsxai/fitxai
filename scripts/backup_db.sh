#!/usr/bin/env bash
# ========================================================
# FITXAI - Script Profesional de Copias de Seguridad (Backup)
# Realiza un volcado completo comprimido de la base de datos PostgreSQL
# con checksum criptográfico SHA-256 y política de retención de 30 días.
# ========================================================

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DATABASE_NAME="${PGDATABASE:-fitxai_dev}"
OUTPUT_FILE="${BACKUP_DIR}/${DATABASE_NAME}_backup_${TIMESTAMP}.sql.gz"
CHECKSUM_FILE="${OUTPUT_FILE}.sha256"

echo "========================================================"
echo " FITXAI - Respaldo de Base de Datos PostgreSQL"
echo " Fecha: $(date)"
echo " Base de datos objetivo: ${DATABASE_NAME}"
echo " Destino: ${OUTPUT_FILE}"
echo "========================================================"

mkdir -p "${BACKUP_DIR}"

# 1. Comprobar disponibilidad de pg_dump
if ! command -v pg_dump &> /dev/null; then
    echo "ERROR: 'pg_dump' no está instalado o no se encuentra en el PATH."
    exit 1
fi

echo "[1/3] Ejecutando volcado y compresión gzip en streaming..."
# Realiza el volcado estructurado con transaccionalidad garantizada
if [ -n "${DATABASE_URL:-}" ]; then
    pg_dump --dbname="${DATABASE_URL}" --clean --if-exists --no-owner --no-privileges | gzip -9 > "${OUTPUT_FILE}"
else
    pg_dump -d "${DATABASE_NAME}" --clean --if-exists --no-owner --no-privileges | gzip -9 > "${OUTPUT_FILE}"
fi

# 2. Generar huella criptográfica SHA-256 para verificar integridad
echo "[2/3] Generando checksum SHA-256 de verificación..."
if command -v shasum &> /dev/null; then
    shasum -a 256 "${OUTPUT_FILE}" > "${CHECKSUM_FILE}"
else
    sha256sum "${OUTPUT_FILE}" > "${CHECKSUM_FILE}"
fi

FILE_SIZE=$(ls -lh "${OUTPUT_FILE}" | awk '{print $5}')
echo "✓ Copia creada exitosamente: ${OUTPUT_FILE} (Tamaño: ${FILE_SIZE})"
cat "${CHECKSUM_FILE}"

# 3. Aplicar política de retención (purgar copias de más de 30 días)
echo "[3/3] Aplicando política de retención (eliminando respaldos > 30 días)..."
find "${BACKUP_DIR}" -name "*_backup_*.sql.gz*" -type f -mtime +30 -exec rm -f {} + 2>/dev/null || true

echo "========================================================"
echo " Respaldo completado satisfactoriamente."
echo "========================================================"

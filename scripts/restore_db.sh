#!/usr/bin/env bash
# ========================================================
# FITXAI - Script de Restauración de Base de Datos
# Restaura un volcado comprimido .sql.gz en PostgreSQL
# ========================================================

set -euo pipefail

if [ $# -lt 1 ]; then
    echo "Uso: $0 <ruta_al_archivo_backup.sql.gz> [nombre_base_datos]"
    echo "Ejemplo: $0 ./backups/fitxai_dev_backup_20260929_120000.sql.gz fitxai_dev"
    exit 1
fi

BACKUP_FILE="$1"
DATABASE_NAME="${2:-${PGDATABASE:-fitxai_dev}}"

if [ ! -f "${BACKUP_FILE}" ]; then
    echo "ERROR: El archivo de copia de seguridad no existe: ${BACKUP_FILE}"
    exit 1
fi

echo "========================================================"
echo " ADVERTENCIA: RESTAURACIÓN DE BASE DE DATOS"
echo " Archivo fuente: ${BACKUP_FILE}"
echo " Base de datos destino: ${DATABASE_NAME}"
echo "========================================================"

# Verificar suma de verificación si existe el archivo .sha256
CHECKSUM_FILE="${BACKUP_FILE}.sha256"
if [ -f "${CHECKSUM_FILE}" ]; then
    echo "[1/2] Verificando integridad del archivo con SHA-256..."
    if command -v shasum &> /dev/null; then
        shasum -a 256 -c "${CHECKSUM_FILE}"
    else
        sha256sum -c "${CHECKSUM_FILE}"
    fi
    echo "✓ Verificación de integridad completada sin errores."
else
    echo "[!] No se encontró archivo .sha256 para verificar integridad."
fi

echo "[2/2] Restaurando contenido en la base de datos ${DATABASE_NAME}..."
if [ -n "${DATABASE_URL:-}" ]; then
    gunzip -c "${BACKUP_FILE}" | psql "${DATABASE_URL}"
else
    gunzip -c "${BACKUP_FILE}" | psql -d "${DATABASE_NAME}"
fi

echo "========================================================"
echo "✓ Restauración completada con éxito."
echo "========================================================"

import fs from 'fs';
import path from 'path';
import { dbPool } from '../backend/src/db/pool';

/**
 * Script de migraciones automatizadas e idempotentes de FITXAI
 * Ejecuta los scripts .sql de la carpeta /database/migrations/ en orden ascendente
 * registrando las ejecuciones previas en la tabla schema_migrations.
 */
async function runMigrations() {
  console.log('[MIGRATION_RUNNER] Comprobando estado de base de datos...');
  const client = await dbPool.connect();

  try {
    // 1. Crear tabla de control de migraciones si no existe
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        execution_time_ms INTEGER NOT NULL
      );
    `);

    // 2. Obtener migraciones ya aplicadas
    const appliedRows = await client.query<{ version: string }>(
      `SELECT version FROM schema_migrations ORDER BY version ASC`
    );
    const appliedSet = new Set(appliedRows.rows.map(r => r.version));

    // 3. Leer archivos en database/migrations
    const migrationsDir = path.resolve(__dirname, '../database/migrations');
    if (!fs.existsSync(migrationsDir)) {
      throw new Error(`Directorio de migraciones no encontrado: ${migrationsDir}`);
    }

    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    console.log(`[MIGRATION_RUNNER] Encontrados ${files.length} archivos de migración.`);

    let pendingCount = 0;

    for (const file of files) {
      if (appliedSet.has(file)) {
        console.log(`[ALREADY_APPLIED] ✓ ${file}`);
        continue;
      }

      pendingCount++;
      const filePath = path.join(migrationsDir, file);
      const sqlContent = fs.readFileSync(filePath, 'utf8');

      console.log(`[APPLYING] Iniciando ejecución de ${file}...`);
      const startMs = Date.now();

      await client.query('BEGIN');
      try {
        await client.query(sqlContent);
        const durationMs = Date.now() - startMs;

        await client.query(
          `INSERT INTO schema_migrations (version, execution_time_ms) VALUES ($1, $2)`,
          [file, durationMs]
        );

        await client.query('COMMIT');
        console.log(`[SUCCESS] ✓ ${file} aplicada con éxito en ${durationMs}ms.`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[ERROR] Fallo crítico al aplicar ${file}:`, err);
        throw err;
      }
    }

    if (pendingCount === 0) {
      console.log('[MIGRATION_RUNNER] Todas las migraciones están al día. La base de datos se encuentra actualizada.');
    } else {
      console.log(`[MIGRATION_RUNNER] Éxito: Se aplicaron ${pendingCount} migraciones correctamente.`);
    }
  } finally {
    client.release();
    await dbPool.end();
  }
}

runMigrations().catch(err => {
  console.error('[FATAL] Proceso de migración abortado:', err);
  process.exit(1);
});

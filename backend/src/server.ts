import fs from 'fs';
import path from 'path';
import { app } from './app';
import { config } from './config/env';
import { checkDatabaseConnection, query, dbPool } from './db/pool';

async function ensureSchema() {
  try {
    const res = await query<any>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'companies'`
    );
    if (res.length === 0) {
      console.log('[BOOT] Tablas no detectadas. Aplicando esquema inicial DDL automáticamente...');
      const candidates = [
        path.resolve(__dirname, '../../database/migrations/001_initial_schema.sql'),
        path.resolve(process.cwd(), 'database/migrations/001_initial_schema.sql'),
      ];
      for (const p of candidates) {
        if (fs.existsSync(p)) {
          const sql = fs.readFileSync(p, 'utf8');
          await dbPool.query(sql);
          console.log('[BOOT] Esquema inicial creado exitosamente.');
          break;
        }
      }
    }
  } catch (err) {
    console.warn('[BOOT] Aviso al verificar esquema inicial:', err);
  }
}

async function startServer() {
  console.log(`[BOOT] Inicializando FITXAI Backend en modo: ${config.env}...`);

  // Comprobar conexión con PostgreSQL antes de aceptar tráfico
  const dbHealth = await checkDatabaseConnection();
  if (dbHealth.connected) {
    console.log(`[DATABASE] Conexión establecida exitosamente con PostgreSQL (${dbHealth.latencyMs}ms).`);
    await ensureSchema();
  } else {
    console.error(`[DATABASE] ATENCIÓN: No se pudo conectar a la base de datos: ${dbHealth.error}`);
    if (config.env === 'production') {
      process.exit(1);
    }
  }

  const server = app.listen(config.port, config.host, () => {
    console.log(`[SERVER] FITXAI Backend escuchando en http://${config.host}:${config.port}`);
    console.log(`[HEALTH] Health check disponible en http://${config.host}:${config.port}${config.apiPrefix}/health`);
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log('\n[SHUTDOWN] Cerrando servidor HTTP y conexiones de base de datos...');
    server.close(() => {
      console.log('[SHUTDOWN] Servidor cerrado correctamente.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startServer().catch((err) => {
  console.error('[FATAL] Fallo al iniciar el servidor:', err);
  process.exit(1);
});

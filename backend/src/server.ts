import { app } from './app';
import { config } from './config/env';
import { checkDatabaseConnection } from './db/pool';

async function startServer() {
  console.log(`[BOOT] Inicializando FITXAI Backend en modo: ${config.env}...`);

  // Comprobar conexión con PostgreSQL antes de aceptar tráfico
  const dbHealth = await checkDatabaseConnection();
  if (dbHealth.connected) {
    console.log(`[DATABASE] Conexión establecida exitosamente con PostgreSQL (${dbHealth.latencyMs}ms).`);
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

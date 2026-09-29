import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Solo cargar archivo .env si DATABASE_URL no viene inyectada directamente por el entorno cloud
if (!process.env.DATABASE_URL) {
  const envFile = process.env.NODE_ENV === 'staging'
    ? path.resolve(__dirname, '../../../config/staging.env')
    : path.resolve(__dirname, '../../../.env');
  if (fs.existsSync(envFile)) {
    dotenv.config({ path: envFile });
  }
}

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),
  host: process.env.HOST || '0.0.0.0',
  appName: process.env.APP_NAME || 'FITXAI',
  apiPrefix: process.env.API_PREFIX || '/api/v1',
  
  // Seguridad
  jwtSecret: process.env.JWT_SECRET || 'dev-insecure-secret-key-must-be-changed',
  jwtExpiration: process.env.JWT_EXPIRATION || '7d',
  corsOrigins: (process.env.CORS_ORIGIN || '*')
    .split(',')
    .map(s => s.trim()),

  // Base de datos
  databaseUrl: process.env.DATABASE_URL || 'postgresql://dpeixotoc@localhost:5432/fitxai_dev?schema=public',

  // Rate Limiting
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '500', 10),

  // Reglas de GPS
  maxGpsAccuracyMeters: parseFloat(process.env.MAX_GPS_ACCURACY_METERS || '150'),
  allowMockLocations: process.env.ALLOW_MOCK_LOCATIONS === 'true',
  requireExactLocation: process.env.REQUIRE_EXACT_LOCATION !== 'false',
};

import { Pool, PoolConfig } from 'pg';
import { config } from '../config/env';

const poolConfig: PoolConfig = {
  connectionString: config.databaseUrl,
  max: 20, // Conexiones concurrentes máximas
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
};

// En producción exigir SSL si no es localhost
if (config.env === 'production' && !config.databaseUrl.includes('localhost')) {
  poolConfig.ssl = { rejectUnauthorized: true };
}

export const dbPool = new Pool(poolConfig);

// Verificación de conexión
export async function checkDatabaseConnection(): Promise<{ connected: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  try {
    const res = await dbPool.query('SELECT 1 as alive');
    const latencyMs = Date.now() - start;
    return {
      connected: res.rows?.[0]?.alive === 1,
      latencyMs,
    };
  } catch (error: any) {
    return {
      connected: false,
      latencyMs: Date.now() - start,
      error: error.message || 'Database connection failed',
    };
  }
}

/**
 * Ejecutor parametrizado seguro de consultas SQL.
 * Todas las entradas van como parámetros $1, $2, etc., previniendo SQL Injection.
 */
export async function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const client = await dbPool.connect();
  try {
    const result = await client.query(sql, params);
    return result.rows as T[];
  } finally {
    client.release();
  }
}

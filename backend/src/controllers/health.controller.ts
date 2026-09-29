import { Request, Response } from 'express';
import { checkDatabaseConnection } from '../db/pool';
import { config } from '../config/env';
import { HealthCheckResponse } from '@fitxai/shared';

export async function getHealthStatus(req: Request, res: Response) {
  const dbStatus = await checkDatabaseConnection();

  const response: HealthCheckResponse = {
    status: dbStatus.connected ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    services: {
      database: {
        status: dbStatus.connected ? 'connected' : 'error',
        latencyMs: dbStatus.latencyMs,
      },
      server: {
        uptimeSeconds: Math.floor(process.uptime()),
        environment: config.env,
        version: '1.0.0',
      },
    },
  };

  const statusCode = dbStatus.connected ? 200 : 503;
  return res.status(statusCode).json(response);
}

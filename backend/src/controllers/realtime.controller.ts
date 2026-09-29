import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config/env';
import { query } from '../db/pool';
import { realtimeService } from '../services/realtime.service';
import { UserRole, UserStatus } from '@fitxai/shared';

/**
 * GET /realtime/stream
 * Canal de eventos en tiempo real (Server-Sent Events) para administradores y supervisores.
 * Autenticación vía query (?token=...) o header (Authorization: Bearer ...).
 */
export async function streamRealtimeEvents(req: Request, res: Response) {
  try {
    // 1. Extraer token de autenticación
    let token = req.query.token as string | undefined;
    if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Token de autenticación requerido para la conexión en tiempo real.',
      });
    }

    // 2. Verificar y decodificar JWT
    let decoded: any;
    try {
      decoded = jwt.verify(token, config.jwtSecret);
    } catch (err: any) {
      return res.status(401).json({
        success: false,
        error: 'Token inválido o expirado.',
      });
    }

    const { userId, companyId, role } = decoded;

    // 3. Verificar en base de datos estado activo del usuario y de la empresa
    const userRows = await query<any>(
      `SELECT u.id, u.status, c.is_active as company_active
       FROM users u
       JOIN companies c ON c.id = u.company_id
       WHERE u.id = $1 AND u.company_id = $2
       LIMIT 1`,
      [userId, companyId]
    );

    if (userRows.length === 0) {
      return res.status(401).json({ success: false, error: 'Usuario o empresa no encontrados.' });
    }

    const { status, company_active } = userRows[0];

    if (!company_active) {
      return res.status(403).json({ success: false, error: 'La empresa se encuentra inactiva.' });
    }

    if (status !== UserStatus.ACTIVE) {
      return res.status(403).json({ success: false, error: 'Cuenta de usuario inactiva.' });
    }

    // Solo roles administrativos y de supervisión reciben el flujo global de fichajes de su empresa
    if (role !== UserRole.ADMIN && role !== UserRole.MANAGER) {
      return res.status(403).json({
        success: false,
        error: 'Solo administradores y supervisores tienen acceso al canal en vivo de la empresa.',
      });
    }

    // 4. Configurar cabeceras obligatorias para Server-Sent Events (SSE)
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Evita buffering en proxies Nginx
      'Access-Control-Allow-Origin': '*', // Configurado para streaming
    });

    res.flushHeaders();

    const clientId = crypto.randomUUID();

    // 5. Registrar el cliente en el servicio de tiempo real
    realtimeService.registerClient({
      id: clientId,
      userId,
      companyId,
      role,
      res,
      connectedAt: new Date(),
      lastPingAt: Date.now(),
    });

    // 6. Gestionar la desconexión del cliente
    req.on('close', () => {
      realtimeService.removeClient(companyId, clientId);
    });

    req.on('error', (err) => {
      console.warn(`[REALTIME] Error en socket del cliente ${clientId}:`, err);
      realtimeService.removeClient(companyId, clientId);
    });
  } catch (error: any) {
    console.error('[REALTIME] Error al inicializar stream SSE:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: 'Error interno al inicializar conexión en tiempo real.' });
    }
  }
}

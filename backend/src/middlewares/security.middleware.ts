import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';
import { config } from '../config/env';

/**
 * Helmet para cabeceras HTTP de alta seguridad
 */
export const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", ...config.corsOrigins],
    },
  },
  crossOriginResourcePolicy: { policy: 'cross-origin' },
});

/**
 * CORS estricto con lista blanca configurable
 */
export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Permitir requests sin origin (como apps móviles nativas o herramientas de monitoreo internas)
    if (!origin) return callback(null, true);
    
    if (config.corsOrigins.includes('*') || config.corsOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Device-Id'],
  credentials: true,
  maxAge: 86400, // 24 horas preflight cache
});

/**
 * Rate Limiter Global
 */
export const globalRateLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMax,
  skip: () => config.env === 'test' || process.env.NODE_ENV === 'test',
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests, please try again later.',
  },
});

/**
 * Cooldown de autenticación eliminado según requerimiento
 */
export const authRateLimiter = (req: Request, res: Response, next: NextFunction) => next();

/**
 * Sanitización de entrada contra ataques de inyección y XSS
 */
export function sanitizeInputMiddleware(req: Request, res: Response, next: NextFunction) {
  // Evitar strings que contengan etiquetas de script maliciosas
  if (req.body && typeof req.body === 'object') {
    sanitizeObject(req.body);
  }
  next();
}

function sanitizeObject(obj: any) {
  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === 'string') {
      // Elimina tags html potencialmente peligrosos en entradas de texto plano
      obj[key] = obj[key].replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      sanitizeObject(obj[key]);
    }
  }
}

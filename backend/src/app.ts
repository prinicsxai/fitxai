import express from 'express';
import { helmetMiddleware, corsMiddleware, globalRateLimiter, sanitizeInputMiddleware } from './middlewares/security.middleware';
import { apiRouter } from './routes';
import { config } from './config/env';

export const app = express();

// Confianza en reverse proxies para obtención segura de IPs detrás de Nginx/Cloudflare
app.set('trust proxy', 1);

// Middlewares de Seguridad
app.use(helmetMiddleware);
app.use(corsMiddleware);
app.use(globalRateLimiter);

// Parsers
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Sanitización contra XSS
app.use(sanitizeInputMiddleware);

// Rutas Principales
app.use(config.apiPrefix, apiRouter);

// Ruta raíz informativa
app.get('/', (req, res) => {
  res.json({
    name: 'FITXAI API Backend',
    version: '1.0.0',
    status: 'online',
    health: `${config.apiPrefix}/health`,
    docs: '/docs',
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Endpoint not found: ${req.method} ${req.path}`,
  });
});

// Error Handler Global
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[UNHANDLED_ERROR]', err);
  res.status(err.status || 500).json({
    success: false,
    error: config.env === 'production' ? 'Internal server error' : err.message || 'Unknown error',
  });
});

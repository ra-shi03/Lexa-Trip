import express from 'express';
import path from 'node:path';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import mongoose from 'mongoose';
import { globalLimiter, writeLimiter, flattenQuery, noStore } from './middlewares/security.js';
import { env } from './config/env.js';
import { mongoSanitize } from './middlewares/sanitize.js';
import { notFound, errorHandler } from './middlewares/error.js';
import authRoutes from './routes/auth.routes.js';
import publicRoutes from './routes/public.routes.js';
import userRoutes from './routes/user.routes.js';
import vendorRoutes from './routes/vendor.routes.js';
import adminRoutes from './routes/admin.routes.js';
import ssrRoutes from './routes/ssr.routes.js';
import { webhook as paymentWebhook } from './controllers/user/payment.controller.js';
import { channelManager } from './services/channelManager/index.js';
import { UPLOAD_DIR } from './services/storage.service.js';
import { formatDateTime } from './utils/clock.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();
  app.set('trust proxy', env.trustProxy);
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));
  app.locals.formatDateTime = formatDateTime; // SEO templates show dates in the platform timezone
  app.disable('x-powered-by');

  app.use(
    helmet({
      // Strict CSP in production (dev uses Vite which needs inline/HMR scripts)
      contentSecurityPolicy: env.isProd
        ? {
            useDefaults: true,
            directives: {
              'default-src': ["'self'"],
              'script-src': ["'self'", 'https://checkout.razorpay.com'],
              'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
              'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
              'img-src': ["'self'", 'data:', 'blob:', 'https:'],
              'frame-src': ["'self'", 'https://www.openstreetmap.org', 'https://api.razorpay.com', 'https://checkout.razorpay.com'],
              'connect-src': ["'self'", 'https://firebaseinstallations.googleapis.com', 'https://fcmregistrations.googleapis.com', 'https://api.razorpay.com', 'https://lumberjack.razorpay.com'],
              'object-src': ["'none'"],
              'base-uri': ["'self'"],
              'frame-ancestors': ["'self'"],
            },
          }
        : false,
      hsts: env.isProd ? { maxAge: 15552000, includeSubDomains: true } : false,
      crossOriginResourcePolicy: { policy: 'cross-origin' }, // uploads are embedded by the SEO pages / SPA
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );
  app.use(cors({ origin: (origin, cb) => cb(null, !origin || env.clientOrigins.includes(origin)), credentials: true }));
  // Correlation id: echoed to the client (X-Request-Id) and included in 5xx logs
  app.use((req, res, next) => {
    const incoming = String(req.get('x-request-id') || '').replace(/[^\w-]/g, '').slice(0, 64);
    req.id = incoming || crypto.randomUUID();
    res.set('X-Request-Id', req.id);
    next();
  });
  app.use(compression());
  if (!env.isProd) app.use(morgan('dev'));
  app.use(express.json({ limit: '2mb', verify: (req, _res, buf) => { req.rawBody = buf.toString(); } }));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));
  app.use(flattenQuery);
  app.use(mongoSanitize);

  // Static: uploads + SEO page assets
  app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '30d' }));
  app.use('/seo-assets', express.static(path.join(__dirname, '..', 'public', 'seo'), { maxAge: '7d' }));

  // Health
  // Liveness/readiness for load balancers: 503 while the DB is not connected so traffic is routed elsewhere
  app.get('/api/health', (_req, res) => {
    const dbUp = mongoose.connection.readyState === 1;
    res.status(dbUp ? 200 : 503).json({ success: dbUp, status: dbUp ? 'ok' : 'db_unavailable', pid: process.pid, uptime: Math.round(process.uptime()), time: new Date().toISOString() });
  });

  // REST API v1 (shared by website + mobile app)
  const api = express.Router();
  api.use(noStore, globalLimiter, writeLimiter);
  api.use('/auth', authRoutes);
  api.use('/public', publicRoutes);
  api.use('/me', userRoutes);
  api.use('/vendor', vendorRoutes);
  api.use('/admin', adminRoutes);
  api.post('/webhooks/razorpay', paymentWebhook);
  api.post('/webhooks/channel/:provider', async (req, res) => {
    const secret = process.env.CHANNEL_WEBHOOK_SECRET;
    if (secret && req.get('x-channel-secret') !== secret) return res.status(401).json({ success: false });
    res.json({ success: true, data: await channelManager.handleWebhook(req.params.provider, req.body, req.headers) });
  });
  api.use(notFound);
  app.use('/api/v1', api);

  // Public SEO pages (server-rendered, crawlable)
  app.use(ssrRoutes);

  // Optional: serve the built React app from the same process (monolith deploy)
  const dist = path.resolve(__dirname, '..', '..', 'frontend', 'dist');
  if (env.serveFrontend && fs.existsSync(dist)) {
    app.use(express.static(dist, { maxAge: '1h', index: false }));
    app.get('/{*splat}', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

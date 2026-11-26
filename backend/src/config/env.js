import 'dotenv/config';

const num = (k, d) => { const v = Number(process.env[k]); return Number.isFinite(v) && v > 0 ? v : d; };
const list = (v, d = '') => (v || d).split(',').map((s) => s.trim()).filter(Boolean);

const jwtSecret = process.env.JWT_SECRET || 'dev-only-secret-change-me';
if (process.env.NODE_ENV === 'production' && (jwtSecret.length < 32 || jwtSecret.startsWith('dev-only') || jwtSecret.startsWith('change-me'))) {
  throw new Error('JWT_SECRET must be a random string of at least 32 characters in production');
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT || 5001),
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/lexatrip',
  jwtSecret,
  /** Number of proxies in front of Node (Nginx/LB = 1). Needed for correct client IPs in rate limiting. */
  trustProxy: Number(process.env.TRUST_PROXY ?? 1),
  clusterWorkers: Number(process.env.CLUSTER_WORKERS || 0), // 0 = single process, -1 = one per CPU
  /** Rate limiting — every number is tunable from .env (see .env.example) */
  rateLimit: {
    enabled: process.env.RATE_LIMIT_ENABLED !== 'false',
    windowSec: num('RATE_LIMIT_WINDOW_SEC', 60),
    global: num('RATE_LIMIT_GLOBAL', 300), // all API calls / window / IP
    write: num('RATE_LIMIT_WRITE', 90), // POST/PUT/PATCH/DELETE / window / IP
    loginMax: num('RATE_LIMIT_LOGIN_MAX', 10), // failed logins per login window, per IP + account
    loginWindowMin: num('RATE_LIMIT_LOGIN_WINDOW_MIN', 15),
    otpMax: num('RATE_LIMIT_OTP_MAX', 6), // OTP requests per otp window, per IP + phone
    otpIpMax: num('RATE_LIMIT_OTP_IP_MAX', 30), // OTP requests per hour per IP
    otpWindowMin: num('RATE_LIMIT_OTP_WINDOW_MIN', 15),
    uploadMax: num('RATE_LIMIT_UPLOAD_MAX', 60), // uploads per 10 min
    aiMax: num('RATE_LIMIT_AI_MAX', 20), // AI calls per window
    refreshMax: num('RATE_LIMIT_REFRESH_MAX', 60), // token refreshes per 15 min per IP
    liveMax: num('RATE_LIMIT_LIVE_MAX', 30), // live-update stream (re)connections per window per IP
  },
  /** MongoDB connection pool & index behaviour */
  db: {
    maxPoolSize: num('MONGO_MAX_POOL', 20),
    minPoolSize: num('MONGO_MIN_POOL', 2),
    // Build indexes on boot in dev; in production run `npm run indexes` during deploys instead
    autoIndex: process.env.MONGO_AUTO_INDEX ? process.env.MONGO_AUTO_INDEX === 'true' : process.env.NODE_ENV !== 'production',
  },
  /** Access tokens are short-lived JWTs; refresh tokens are opaque, stored hashed, rotated on every use. */
  auth: {
    accessTtl: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshDays: { user: num('REFRESH_TTL_DAYS_USER', 30), vendor: num('REFRESH_TTL_DAYS_VENDOR', 30), admin: num('REFRESH_TTL_DAYS_ADMIN', 1) },
  },
  siteUrl: (process.env.SITE_URL || 'http://localhost:5173').replace(/\/$/, ''),
  clientOrigins: list(process.env.CLIENT_ORIGINS, 'http://localhost:5173'),
  serveFrontend: process.env.SERVE_FRONTEND === 'true',

  devOtp: process.env.DEV_OTP || '123456',
  otpProvider: process.env.OTP_PROVIDER || 'console',

  smtp: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.MAIL_FROM || 'LexaTrip <no-reply@lexatrip.com>',
  },

  payment: {
    provider: process.env.PAYMENT_PROVIDER || 'mock',
    razorpayKeyId: process.env.RAZORPAY_KEY_ID,
    razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET,
    razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
  },

  ai: {
    provider: process.env.AI_PROVIDER || 'gemini',
    geminiKey: process.env.GEMINI_API_KEY,
    geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  },

  busProvider: process.env.BUS_PROVIDER || 'mock',
  flightProvider: process.env.FLIGHT_PROVIDER || 'mock',
  channelManagerProvider: process.env.CHANNEL_MANAGER_PROVIDER || 'mock',

  gsc: {
    serviceAccountFile: process.env.GSC_SERVICE_ACCOUNT_FILE,
    siteUrl: process.env.GSC_SITE_URL,
  },

  seed: {
    adminEmail: process.env.SEED_ADMIN_EMAIL || 'admin@lexatrip.com',
    adminPassword: process.env.SEED_ADMIN_PASSWORD || 'Admin@123',
  },
};

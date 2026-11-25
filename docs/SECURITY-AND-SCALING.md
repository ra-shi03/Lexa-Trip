# Security & scaling

## Authentication
- Guests: mobile + OTP (hashed OTP, 5-min expiry, 5 attempts, 30 s resend gap). Vendors/admins: email + bcrypt password.
- JWT per audience: `iss=lexatrip`, `aud=user|vendor|admin`, HS256 pinned. A guest token can never be used on vendor/admin APIs (verified by test); `alg=none` and tampered tokens are rejected. Admin sessions last 12 h, others `JWT_EXPIRES_IN` (7 d).
- The account is re-loaded from the DB on every request, so suspending/blocking a user takes effect immediately.
- Passwords: 8–72 chars with a letter and a number (vendor register, change-password, sub-admin create).
- Production refuses to start with a weak/default `JWT_SECRET` (< 32 chars).

## Authorization
- Role + permission checks: `requireUser/Vendor/Admin` → `can(permission)` / `masterOnly`.
- Vendors are always scoped to their own `vendor` id in queries; guests to their own `user` id.
- Sub-admins never reach revenue routes and revenue fields are stripped from their responses (see `ROLES-AND-PERMISSIONS.md`).
- Uploaded images are compressed (browser: browser-image-compression; server: sharp → WebP, max 2000px, EXIF stripped).
- Generic CRUD strips `_id`, `createdAt`, `usedCount`… from bodies (mass-assignment guard).

## Validation & input hygiene
- zod schemas on auth, bookings, profile, traveller, AI, support endpoints; unknown fields are stripped.
- Every `:id`-style route param on private routers must be a valid 24-char ObjectId (400 otherwise).
- NoSQL-operator keys (`$…`, `a.b`) removed from body/query/params; array/object query values flattened (parameter pollution); JSON body ≤ 2 MB, form body ≤ 100 KB.
- CMS HTML sanitised server-side; uploads limited by MIME type and size.

## Rate limiting — fully configurable from `backend/.env`
Restart the backend after changing a value. Defaults:

| Variable | Default | Meaning |
|---|---|---|
| `RATE_LIMIT_ENABLED` | true | master switch (never `false` in production) |
| `RATE_LIMIT_WINDOW_SEC` | 60 | window for the global / write / AI limits |
| `RATE_LIMIT_GLOBAL` | 300 | all API calls per window per IP |
| `RATE_LIMIT_WRITE` | 90 | POST/PUT/PATCH/DELETE per window per IP |
| `RATE_LIMIT_LOGIN_MAX` / `_WINDOW_MIN` | 10 / 15 | failed logins per **IP + account**; successful logins don't count |
| `RATE_LIMIT_OTP_MAX` / `_WINDOW_MIN` | 6 / 15 | OTP requests per IP + phone |
| `RATE_LIMIT_OTP_IP_MAX` | 30 | OTP requests per hour per IP |
| `RATE_LIMIT_UPLOAD_MAX` | 60 | uploads per 10 minutes |
| `RATE_LIMIT_AI_MAX` | 20 | Lexa AI calls per window |

Limits are per process (memory). With several instances use a Redis store (below).

## Database
- Indexes are declared on the schemas and are **query-driven** (equality → sort → range). 150+ indexes; redundant single-field indexes that are a prefix of a compound one were removed. Verified with `explain()` — guest search, "my trips", vendor lists, scheduler jobs, notifications, reviews, SEO listings all use `IXSCAN`.
- `MONGO_AUTO_INDEX` (default true in dev, false in production). In production run **`npm run indexes`** during each deploy (idempotent; also drops indexes no longer declared).
- Connection pool `MONGO_MAX_POOL` (20) / `MONGO_MIN_POOL` (2) per Node process — with N workers the cluster uses up to N × max connections; mind your Atlas tier limit.
- Fast-fail connection (10 s server selection), 45 s socket timeout, TTL index for OTPs, atomic conditional updates for inventory.

## Transport & headers
Helmet (nosniff, frame-ancestors, referrer-policy); in production also HSTS and a strict Content-Security-Policy (Razorpay + OpenStreetMap + Google Fonts allowed). CORS allow-list from `CLIENT_ORIGINS`. All `/api` responses are `Cache-Control: no-store`. Payment webhooks verify HMAC signatures.

## Scaling / load balancing
The API is stateless (JWT, data in MongoDB), so it scales horizontally.
1. **One machine, all cores:** `npm run start:cluster` (= `CLUSTER_WORKERS=-1`). Workers share the port; crashed workers are restarted; scheduled jobs run on exactly one worker.
2. **Several machines behind Nginx / a cloud load balancer:**
```nginx
upstream lexatrip_api { least_conn; server 10.0.0.11:5001 max_fails=3 fail_timeout=10s; server 10.0.0.12:5001 max_fails=3 fail_timeout=10s; keepalive 32; }
location ~ ^/(api|uploads|hotels|blog|sitemaps|seo-assets)/ { proxy_pass http://lexatrip_api; proxy_http_version 1.1; proxy_set_header Connection ""; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto $scheme; }
```
   Set `TRUST_PROXY=1`. Point the balancer health check at `GET /api/health` (returns 503 while MongoDB is unreachable). Run the scheduler on one instance only (`WORKER_NO=1` / dedicated worker) or move jobs to a queue.
3. **Before running more than one instance you must:**
   - move uploads to shared storage (S3/Cloudinary) — local disk is per server;
   - use a **shared rate-limit store** (Redis, e.g. `rate-limit-redis`) — in-memory counters are per process, so limits are multiplied by the number of instances;
   - serve `/assets`, `/uploads` and SEO pages through a CDN (SEO pages send `Cache-Control: public, max-age=300`).
4. Graceful shutdown: SIGTERM stops accepting new connections, finishes in-flight requests (15 s cap), closes MongoDB. Keep-alive is 65 s (> typical LB idle timeout) to avoid spurious 502s.

## Still recommended before launch
Refresh tokens + logout-everywhere, 2FA for admins, Redis rate-limit store, malware scanning for uploads, WAF/CDN (Cloudflare), automated dependency audits (`npm audit` in CI), centralised logging/alerts, pen-test.

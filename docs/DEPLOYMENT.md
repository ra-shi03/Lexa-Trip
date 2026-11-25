# Deployment

## Option A — single server (simplest)
```bash
cd frontend && npm ci && npm run build          # → frontend/dist
cd ../backend && npm ci --omit=dev
NODE_ENV=production SERVE_FRONTEND=true SITE_URL=https://lexatrip.com node server.js   # use pm2 / systemd
```
Express serves the API, SEO pages, sitemaps and the built SPA from one process.

## Option B — Nginx in front (recommended)
```nginx
server {
  server_name lexatrip.com;
  root /var/www/lexatrip/frontend/dist;

  # Express owns these
  location ~ ^/(api|uploads|hotels|blog|sitemaps|seo-assets)/ { proxy_pass http://127.0.0.1:5001; proxy_set_header Host $host; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto $scheme; }
  location = /sitemap.xml { proxy_pass http://127.0.0.1:5001; }
  location = /robots.txt  { proxy_pass http://127.0.0.1:5001; }

  # SPA
  location / { try_files $uri /index.html; }
  location /assets/ { expires 1y; add_header Cache-Control "public, immutable"; }
}
```
Add TLS (Let’s Encrypt), gzip/brotli, and a CDN (Cloudflare) for `/assets`, `/uploads`, `/hotels`, `/blog`.

## Production checklist
- `NODE_ENV=production`, strong `JWT_SECRET`, `SITE_URL=https://lexatrip.com`, `CLIENT_ORIGINS`.
- MongoDB Atlas / replica set with daily backups + point-in-time restore; enable auth.
- Providers: `PAYMENT_PROVIDER=razorpay` + keys + webhook secret; OTP provider; SMTP/SES; `GEMINI_API_KEY`; GSC service account.
- Move uploads to S3/Cloudinary; add image resizing/WebP.
- Run one instance of the scheduler (or move jobs to a worker) when scaling horizontally.
- Monitoring: uptime, error tracking (Sentry), log shipping; Search Console coverage.
- Never run `npm run seed` against production (it refuses when `NODE_ENV=production`).

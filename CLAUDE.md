# CLAUDE.md — LexaTrip

Guidance for Claude (and humans) working in this repository.

## What this is
LexaTrip ("Book. Explore. Repeat.") — a travel booking platform for India: hotels/villas/resorts/hostels/homestays,
bus and flight booking (provider-API based), vendor panel, master admin + sub-admins, and an **Advanced SEO CMS**
(India → State → City → Hotel category → Hotels → Itineraries + Articles) that publishes server-rendered, crawlable pages.
Guest-facing AI ("Lexa AI", Gemini) for chat, natural-language search, trip planning and review summaries.

Requirements sources: the Appzeto SOW PDF + client SEO-CMS brief + theme brief. Every requirement is mapped in
`docs/REQUIREMENTS-TRACEABILITY.md` — **update that file whenever you add/close a requirement.**

## Layout (two projects)
```
Lexa-Trip/
├── backend/   Express 5 + Mongoose 9, ESM, MVC monolith, EJS views for SEO pages
└── frontend/  Website + vendor panel + admin panel + customer mobile app (`src/app/`) — React 19, Vite 8, Tailwind v4 + vanilla CSS, React Router 7
```

### Backend (`backend/src`)
- `config/` env + db · `constants/` enums, permissions, default settings
- `models/` Mongoose schemas (`models/seo/*` = CMS entities, `SeoMeta.js` = shared seo/content/workflow sub-schemas)
- `controllers/` thin HTTP handlers grouped by audience: `public/`, `user/`, `vendor/`, `admin/`, `seo/`, `shared/propertyManager.js`
  (one implementation for vendor + admin property/room/inventory/booking ops, scoped by mode), `ssr.controller.js` (public SEO pages)
- `services/` all business logic: pricing, inventory (atomic reservations), booking lifecycle, search, AI, payment gateway,
  bus/flight provider adapters, channel manager adapter, SEO (urls, schema, sitemap, GSC, content workflow, import)
- `routes/` route → middleware → controller wiring · `middlewares/` auth, permission (`can()`, revenue stripping), upload, validate (zod), errors
- `views/` EJS templates for SEO pages · `public/seo/seo.css` their stylesheet · `jobs/scheduler.js` in-process jobs · `seed/seed.js`

### Frontend (`frontend/src`)
- `components/ui/` design-system primitives (Button, Input, Modal, DataTable, Tabs…) — **reuse these, don't restyle ad hoc**
- `components/{layout,search,stay,ai,travel,panel,editor}` feature components
- `pages/user|vendor|admin` screens; admin & vendor are lazy-loaded chunks
- `context/` Settings (dynamic theme/features), Auth (3 independent sessions: user/vendor/admin), Toast
- `lib/api.js` single axios client (picks token by URL prefix), `lib/format.js`, `lib/seoScore.js`
- `styles/index.css` Tailwind v4 `@theme inline` tokens → CSS variables; `styles/components.css` vanilla component classes

## Commands
```bash
# backend
cd backend && cp .env.example .env   # set MONGO_URI (with credentials if your Mongo has auth) + JWT_SECRET
npm install && npm run seed && npm run dev        # http://localhost:5001
# frontend
cd frontend && npm install && npm run dev         # http://localhost:5173 (proxies /api, /hotels, /blog, /sitemap*, /robots.txt, /uploads)
npm run build
```
Seed logins: admin@lexatrip.com / Admin@123 · subadmin@lexatrip.com / Subadmin@123 · vendor@lexatrip.com / Vendor@123 ·
guest: any mobile + OTP 123456 (dev). Payment = sandbox (`PAYMENT_PROVIDER=mock`).

## Conventions & rules
- **API envelope** is always `{ success, data, meta?, message? }` / `{ success:false, message, details? }` — the Flutter app depends on it.
  Version prefix `/api/v1`. Send `X-Client: app` from mobile.
- **Never trust client prices.** Hotel totals are recomputed by `services/pricing.service.js#quoteHotel`; bus/flight fares come from the provider.
- **Inventory changes go through `services/inventory.service.js`** (`reserve`/`release`/`bulkUpdate`). Reservation is an atomic conditional
  `$inc` per night — do not write `Inventory.booked` directly elsewhere.
- **Sub-admins must never receive revenue data.** Guard routes with `can('finance'|'payouts'|'commission'|'revenue_reports')`; the
  `stripRevenueForSubadmin` middleware additionally removes `commission`, `vendorPayoutAmount`, `payout` fields. Revenue permissions are
  filtered in the Admin model, the sub-admin controller and `can()`. Keep all three.
- **SEO content writes go through `services/seo/content.service.js#saveEntity`** (sanitises HTML, prevents slug collisions, bumps version,
  writes a Revision, creates 301s on URL change, invalidates the sitemap). Don't `Model.updateOne` CMS entities directly.
- Public SEO URLs are built only in `services/seo/url.service.js` (trailing slash, lowercase).
- SEO pages are server-rendered (EJS); Google and users get identical HTML. Don't add client-only content to them, and don't link
  them from the SPA's main navigation (client requirement).
- Settings are a single `Setting{key:'global'}` doc deep-merged with `constants/defaultSettings.js`. Add new theme tokens/feature flags
  there first. **API keys live in `.env`, never in the DB or client.**
- Frontend styling: Tailwind utilities mapped to theme tokens (`bg-primary`, `text-ink`, `border-line`, `rounded-brand`) + classes in
  `components.css` (`.btn`, `.card`, `.input`, `.search-bar`…). Don't hard-code brand hex values in components.
- Guest app screens must stay mobile-first and "app-like" (bottom tab bar, sheets) — they are the blueprint for the Flutter app.
- Express 5: async errors propagate automatically (no asyncHandler). `req.query` is read-only — mutate in place only.
- Mongoose 9: hooks are `async function` without `next`.

## Security / data / client conventions (added)
- Rate limits live in `middlewares/security.js` and read `env.rateLimit` (.env `RATE_LIMIT_*`). Add new limiters there, never inline.
- When you add a query pattern (new filter + sort), add a matching compound index in the model file (ESR order) and run `npm run indexes`.
  Do not add a single-field index that is a prefix of an existing compound one.
- Private routers call `validateObjectIdParams(r)`; new `:param` names holding ids must be added to `ID_PARAMS`.
- Frontend: all HTTP goes through `lib/api.js` (interceptors: auth token by audience, GET retry/back-off, 401 → session cleared, 429/5xx/offline → global toast).
  `err.silent === true` means the interceptor already showed it — don't toast again. Route access goes through `components/auth/Protected.jsx`
  (`<Protected role perm master>`, `<GuestOnly>`); the server still enforces every rule.
- Uploads go through `middlewares/upload.js` (sharp → WebP ≤ 2000px); the browser also pre-compresses via `lib/compressImage.js`.
- macOS reserves port 5000 (AirPlay) → backend uses **5001**.

## Mobile app conventions
- The app lives in `frontend/src/app/` (shell, splash, onboarding, home, profile hub, app.css). Booking/account screens are shared with the website (`pages/user`). Use the `@/` alias for imports. Run it with `npm run dev:app` or open `/app`. See docs/MOBILE-APP.md.
- Branding (logo, favicon, name, colours, splash, onboarding) must come from settings (`useSettings()`), never be hard-coded; icons/manifest are generated by `services/brand.service.js`.
- Shared screens must work at phone width (app disables Tailwind `sm:`…`2xl:` breakpoints). Don't rely on desktop-only layouts for guest screens.
- New settings sections must be added in `defaultSettings.js`, `Setting.js`, `settings.service.js` (SECTIONS + public), `SECTION_PERMISSION`, and an admin editor page.

## Not done yet / integration stubs
Real provider adapters (Razorpay is implemented; MSG91/Twilio OTP, STAAH/AxisRooms, bus & flight aggregators are sandbox/mock
until credentials + docs arrive), push notifications (FCM), S3 media storage, image optimisation, refresh tokens, automated tests.
See `docs/REQUIREMENTS-TRACEABILITY.md` → "Pending / needs client input".

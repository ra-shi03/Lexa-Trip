# Architecture

```
                ┌──────────────────────── Browser / Flutter app ────────────────────────┐
                │  React SPA (guest app, vendor panel, admin panel)   SEO pages (HTML)  │
                └───────────────┬───────────────────────────────────────────┬──────────┘
                     /api/v1/*  │ JSON {success,data,meta}      /hotels/* /blog/* /sitemap*.xml /robots.txt
                ┌───────────────▼───────────────────────────────────────────▼──────────┐
                │ Express 5 monolith (MVC)                                              │
                │ routes → middlewares (auth, can(), zod, sanitize) → controllers       │
                │      → services (pricing, inventory, booking, search, ai, seo, …)     │
                │      → models (Mongoose)            views (EJS, SEO pages)            │
                │ jobs/scheduler: hold expiry · scheduled publish · stay auto-complete  │
                └───────┬───────────────┬──────────────┬─────────────┬─────────────────┘
                        │               │              │             │
                    MongoDB      Payment gateway   Gemini API   Bus/Flight/Channel-manager adapters
```

## Domains & key models
| Domain | Models |
|---|---|
| Accounts | `User` (guest, OTP), `Vendor`, `Admin` (master / subadmin + permissions), `Otp` |
| Catalogue | `State`, `City` (shared by booking + SEO), `Category`, `Amenity` |
| Stays | `Property`, `RoomType` (rate plans), `Inventory` (room-type × night), `InventoryLog`, `PricingRule` |
| Bookings & money | `Booking` (hotel/bus/flight in one collection), `Payment`, `Payout`, `CommissionRule`, `Coupon` |
| Content | `Banner`, `Page`, `Faq`, `Review`, `SupportTicket`, `Notification`, `Media`, `AuditLog`, `SyncLog`, `AiConversation` |
| SEO CMS | `HotelCategory`, `SeoHotel`, `Itinerary`, `SeoArticle`, `Revision`, `Redirect`, `SitemapLog` |
| Config | `Setting` (single doc: brand, theme, features, homeSections, booking, tax, commission, seo, integrations) |

## Booking lifecycle (hotel)
1. `POST /public/quote` — server computes nightly rates (override → rule → weekend → base), rate plan, extra guests, coupon, GST slab.
2. `POST /me/bookings/hotel` — re-quotes, **atomically reserves** each night (`findOneAndUpdate` with `$expr booked+blocked+qty ≤ total`), rolls back on partial failure, creates booking `pending_payment` with `holdExpiresAt` (configurable, default 15 min). `idempotencyKey` makes retries safe.
3. `POST /me/payments/order` — gateway order (re-used if one is open → no double charge).
4. `POST /me/payments/verify` (or webhook) — signature verification → `confirmBooking` → `confirmed` or `pending_approval` (request-to-book).
5. Scheduler expires unpaid holds and releases inventory. Cancellation computes refund from policy & rate plan, releases inventory, refunds via gateway, adjusts commission/payout.

Bus/flight follow the same states with provider `block → confirm/book → cancel` adapters.

## Pricing & tax
- Commission precedence: vendor override → vendor rule → category rule → service rule → global rule → settings default; charged on pre-tax amount.
- GST slabs configurable (Admin → Tax & commission) — defaults 5% ≤ ₹7,500/room-night, 18% above. **Confirm with CA.**

## Security
JWT per audience (separate tokens), bcrypt passwords, helmet, CORS allow-list, rate limits (API, OTP, login, AI), NoSQL key sanitisation,
zod validation, HTML sanitisation for CMS content, upload type/size limits, audit log, revenue-field stripping for sub-admins.
API keys only in environment variables.

## Scaling notes
- Stateless API → horizontal scaling behind a load balancer; move `jobs/scheduler.js` to a single worker (or BullMQ) when running >1 instance.
- Media: swap `middlewares/upload.js` disk storage for S3/Cloudinary; serve via CDN.
- Cache SEO pages at the CDN (they send `Cache-Control: public, max-age=300`).
- Search: Mongo indexes today; Atlas Search / OpenSearch when listings reach tens of thousands.

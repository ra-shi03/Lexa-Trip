# API reference (v1)

Base: `/api/v1` · Auth: `Authorization: Bearer <token>` (separate tokens for guest, vendor, admin) · Mobile clients send `X-Client: app`.
Response: `{ success: true, data, meta?, message? }` or `{ success: false, message, details? }`. Lists accept `page, limit, q, sort (-field)`.

## Auth
| Method | Path | Notes |
|---|---|---|
| POST | `/auth/user/send-otp` `{phone, mode?: login|signup}` | `login` needs an existing account (404 otherwise), `signup` needs a new number (409 otherwise); dev: returns `devOtp` |
| POST | `/auth/user/verify-otp` `{phone, otp, mode?, name?, email?}` | signup requires `name`; → `{token, user, isNew}` |
| GET | `/auth/user/me` | |
| POST | `/auth/vendor/register` · `/auth/vendor/login` · GET `/auth/vendor/me` · POST `/auth/vendor/change-password` | |
| POST | `/auth/admin/login` · GET `/auth/admin/me` · POST `/auth/admin/change-password` | `effectivePermissions` included |

## Public
`GET /public/settings` (theme, features, home layout) · `/public/home` · `/public/categories` · `/public/amenities` · `/public/states` ·
`/public/cities?state&popular` · `/public/suggest?q` · `/public/offers` · `/public/pages` · `/public/pages/:slug` · `/public/faqs?category`

Stays: `GET /public/properties?city&checkIn&checkOut&adults&children&rooms&category&amenities&minPrice&maxPrice&rating&stars&sort&page`
· `GET /public/properties/:idOrSlug` · `GET /public/properties/:id/rates?checkIn&checkOut&rooms&adults&children`
· `GET /public/properties/:id/reviews` · `POST /public/quote` · `POST /public/coupons/validate`

Bus: `GET /public/bus/search?from&to&date` · `GET /public/bus/trips/:tripId/seats`
Flights: `GET /public/flights/airports?q` · `GET /public/flights/search?from&to&date&returnDate&adults&children&infants&cabin`
AI: `GET /public/ai/status` · `POST /public/ai/parse` · `POST /public/ai/chat` · `POST /public/ai/plan` · `GET /public/ai/review-summary/:id`

## Guest (`/me`, user token)
Profile `PUT /me/profile` · travellers CRUD `/me/travellers` · wishlist `GET /me/wishlist`, `POST /me/wishlist/:propertyId` (toggle) ·
notifications `GET /me/notifications`, `POST /me/notifications/read` · reviews `POST /me/reviews` · support `GET|POST /me/support`, `POST /me/support/:id/reply`

Bookings: `POST /me/bookings/hotel|bus|flight` · `GET /me/bookings?tab=upcoming|completed|cancelled&type` · `GET /me/bookings/:id`
· `GET /me/bookings/:id/cancellation-preview` · `POST /me/bookings/:id/cancel {reason}`
Payments: `POST /me/payments/order {bookingId}` · `POST /me/payments/verify {orderId,paymentId,signature}` · `POST /me/payments/mock {orderId,outcome}` (sandbox) · `GET /me/payments/status/:bookingId`

## Vendor (`/vendor`)
`GET /dashboard` · `PUT /profile` · `PUT /bank` · `POST /documents` (multipart `file`, `type`) · notifications ·
properties CRUD `/properties`, `POST /properties/:id/submit`, `POST /uploads/images` (multipart `images[]`) ·
rooms `/properties/:id/rooms` · pricing rules `/properties/:id/pricing-rules` ·
inventory `GET /properties/:id/inventory?from&days`, `PUT /properties/:id/inventory {roomTypeIds, from, to, daysOfWeek, set:{price,blocked,totalRooms,closed,minStay}}` ·
channel manager `GET|PUT /properties/:id/channel-manager`, `POST …/test`, `POST …/sync` ·
bookings `GET /bookings?tab&q&status`, `GET /bookings/:id`, `POST /bookings/:id/action {action: approve|reject|check_in|check_out|no_show|cancel, note}` ·
`GET /earnings` · `GET /reports?from&to&format=csv`

## Admin (`/admin`) — permission in brackets
dashboard [dashboard] · users [users] · vendors (+status, permissions, documents) [vendors] · `PUT /vendors/:id/commission` [commission] ·
properties (+ `POST /properties/:id/action` approve|reject|suspend|feature|unfeature|show|hide) [properties] · inventory & channel manager [inventory] ·
bookings [bookings] · finance: `/finance/transactions`, `/finance/refunds`, `/finance/payouts(/generate)`, `/reports/revenue`, `/reports/operations`, `/commission-rules` [revenue — master only] ·
CRUD: `/categories`, `/amenities` [catalog], `/coupons` [coupons], `/banners`, `/pages`, `/faqs` [content] ·
`/reviews` [reviews] · `/support` [support] · `/settings`, `PUT /settings/:section` · `/subadmins`, `/permissions`, `/audit-logs` [master] · `/ai/conversations`

## SEO CMS (`/admin/seo`) [seo]
`GET /overview` · `GET /tree` · entities `states | cities | hotel-categories | hotels | itineraries | articles` each with
`GET / POST / GET :id / PUT :id / DELETE :id / POST :id/status {status|scheduledAt, reviewNotes} / GET :id/revisions / POST :id/duplicate` ·
`POST /cities/:cityId/generate-categories` · `GET /revisions/:id`, `POST /revisions/:id/restore` · `GET /preview/:type/:id` ·
redirects CRUD · media (`GET`, `POST` multipart `files[]`, `PUT`, `DELETE`) · `GET /import/template`, `POST /import` (multipart `file`, `dryRun`, `createMissingLocations`) ·
`GET /sitemap`, `POST /sitemap/submit`, `GET /search-console/sitemaps` · `POST /ai/assist`

## Webhooks
`POST /api/v1/webhooks/razorpay` (signature `X-Razorpay-Signature`) · `POST /api/v1/webhooks/channel/:provider` (`X-Channel-Secret` if `CHANNEL_WEBHOOK_SECRET` set)

## Public non-API routes (server-rendered)
`/hotels/...`, `/blog/...`, `/sitemap.xml`, `/sitemaps/<type>-<n>.xml`, `/robots.txt`, `/uploads/*`, `/api/health`

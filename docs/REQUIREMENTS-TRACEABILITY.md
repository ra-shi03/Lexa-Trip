# Requirements traceability

Every requirement from (1) the Appzeto SOW PDF, (2) the client's SEO CMS brief and (3) the theme/AI brief, plus the
developer's technical requirements, mapped to where it is implemented.
Status: ✅ done & tested · 🟡 built, uses sandbox/stub until the client provides an account/API · ⏳ planned (next phase)

## A. SOW — Deliverables
| Requirement | Status | Where |
|---|---|---|
| User app (Android & iOS) | ✅ app-style experience inside the frontend project (`src/app/`), installable, fully admin-driven branding; Flutter conversion is the last step | `frontend/src/app/`, `docs/MOBILE-APP.md`, `FLUTTER-MIGRATION.md` |
| Vendor panel | ✅ | `frontend/src/pages/vendor`, `backend/src/routes/vendor.routes.js` |
| Master admin panel | ✅ | `frontend/src/pages/admin`, `backend/src/routes/admin.routes.js` |
| Website (responsive) | ✅ | same React app, mobile/tablet/desktop |
| Channel manager integration | 🟡 adapter + mapping + sync log + webhook; STAAH/AxisRooms adapters await API docs | `services/channelManager/`, Property editor → Channel manager |
| Inventory management page (admin/vendor) | ✅ calendar grid, bulk update, blocks, stop-sell, min-stay, date prices | `components/panel/InventoryGrid.jsx`, `services/inventory.service.js` |

## B. SOW — User app
| Requirement | Status | Where |
|---|---|---|
| Mobile + OTP login (full-page Login / Sign up tabs, admin-editable via Admin → Login page) | ✅ (SMS provider 🟡 console/dev OTP until MSG91/Twilio keys) | `auth.controller.js`, `otp.service.js`, `pages/user/Login.jsx` |
| Profile (name, email, contact) | ✅ | Account → Profile |
| Saved travellers | ✅ | Account → Saved travellers |
| Booking history: upcoming / completed / cancelled | ✅ | Account → My trips |
| Saved properties & favourite destinations | ✅ wishlist (favourite cities field in model) | Account → Saved |
| Help, support, T&C, privacy | ✅ tickets + static pages + FAQ | Account → Help, `/p/:slug`, `/p/faq` |
| Customisable accommodation categories (+ admin-defined) | ✅ | Admin → Categories |
| Search by city/area/property, dates, guests/children/rooms | ✅ autocomplete | `components/search/*` |
| Filters: budget, category, amenities, rating, location; sort price/popularity/rating/relevance | ✅ | `pages/user/Search.jsx`, `search.service.js` |
| Photos, description, facilities, location, check-in & cancellation policy | ✅ | `pages/user/PropertyDetail.jsx` |
| Room types, occupancy limits, prices, taxes & total before payment | ✅ server-computed quote, GST slabs | `pricing.service.js#quoteHotel` |
| Meal plans, refundable / non-refundable rates | ✅ rate plans per room | RoomType.ratePlans |
| Booking summary, payment gateway, unique booking ID, voucher | ✅ (Razorpay implemented; sandbox default) | Checkout, PaymentStep, BookingDetail (printable voucher) |
| Status updates & notifications | ✅ in-app + email (SMTP 🟡) ; push ⏳ (FCM with Flutter) | `notification.service.js` |
| Cancellation & refund flow per policy | ✅ refund preview + gateway refund | `booking.service.js#cancelBooking` |
| Bus: search, operators/timings/fares, seat map, passengers, pay, ticket, history, cancel/refund | 🟡 complete flow on sandbox provider | `providers/bus`, `pages/user/Bus.jsx` |
| Flight: one-way/round-trip, fares & conditions, fare types & baggage, passengers, pay, PNR, cancel | 🟡 complete flow on sandbox provider; amendments ⏳ (provider-specific) | `providers/flight`, `pages/user/Flights.jsx` |
| Payments: taxes/fees, success/failure/pending handling | ✅ incl. 15-min inventory hold, idempotency, webhook | `payment.controller.js` |

## C. SOW — Vendor panel
| Requirement | Status |
|---|---|
| Registration/login, business & property details, documents upload, bank/payout info | ✅ |
| Admin approval before property goes live | ✅ vendor approval + property approval |
| Multiple properties (permission-limited), categories, descriptions, photos, amenities | ✅ |
| Check-in/out times, house rules, capacity, child policy, room types, meal plans | ✅ |
| Weekday/weekend/seasonal/special-date pricing | ✅ base + weekend + pricing rules + per-date override |
| Room quantities, closures, extra guest charges, cancellation policy, restrictions (min stay) | ✅ |
| Channel manager sync | 🟡 |
| Bookings: upcoming/completed/cancelled/active, guest details, vouchers, statuses, check-in/out, request approval, cancellations | ✅ |
| Earnings, commission deductions, payouts | ✅ |
| Reports: booking/revenue, property & room-wise, occupancy, cancellations, commission/payouts, CSV download | ✅ |

## D. SOW — Master admin
| Requirement | Status |
|---|---|
| Dashboard: users/vendors/properties/bookings, revenue/commission trends, status summaries, per-service overview, activity, pending approvals | ✅ |
| Users & vendors: manage, approve/reject/suspend/activate, documents, permissions, histories | ✅ |
| Categories, amenities, attributes; listing approval; featured; visibility; destinations | ✅ |
| Bookings across services; payments; commission rules; transactions; refunds; payouts; financial reports | ✅ |
| Banners, coupons, static pages, FAQs, support details | ✅ |
| Payment gateway / notification / API configuration & status; service availability settings | ✅ (keys in .env by design) |

## E. SOW — Website, integrations, security
| Requirement | Status |
|---|---|
| Responsive website with all flows + basic on-page SEO | ✅ (SPA pages set title/meta; SEO landing pages are SSR) |
| Payment gateway, OTP/SMS, email, maps | ✅ Razorpay + OSM maps; 🟡 SMS/SMTP need credentials |
| RBAC, protected comms, validation, duplicate booking/payment prevention, secure data | ✅ JWT, zod, helmet, rate limits, NoSQL-sanitise, atomic inventory, idempotency keys, order reuse |
| Backups, deployment, device/browser testing | ⏳ deployment-phase (see `DEPLOYMENT.md`) |

## F. Client brief — Advanced SEO CMS & hotel itineraries
| Requirement | Status | Where |
|---|---|---|
| Separate SEO section in admin with hierarchy India → State → City → Hotel category → Hotels | ✅ | Admin → SEO CMS → Content explorer |
| 5-Star / 4-Star / 3-Star / Luxury Resorts per city (+ custom) | ✅ one-click from templates | `generate-categories` |
| Individual hotel profile & database: name, address/location, category, rooms, facilities, amenities, images/gallery, description, contact | ✅ | `models/seo/SeoHotel.js`, HotelEditor |
| Itineraries per hotel (multiple): day-wise, experiences/activities, dining, facilities, nearby attractions, guest info, FAQs | ✅ | `models/seo/Itinerary.js`, ItineraryEditor |
| SEO articles | ✅ state- or city-level | `models/seo/SeoArticle.js` |
| Independent SEO per hotel & itinerary: title, meta, slug, H1/H2/H3, primary/secondary/long-tail keywords, image alt, canonical, schema, internal linking | ✅ | `SeoMeta.js`, SeoPanel, ContentEditor |
| Not shown on homepage/navigation, but own public URL and crawlable | ✅ SSR pages, sitemap discovery only | `ssr.controller.js` |
| URLs `/blog/rajasthan/udaipur/`, `/hotels/rajasthan/udaipur/<hotel>/` | ✅ exact pattern | `url.service.js` |
| Automatic XML sitemap | ✅ split & chunked, auto-refresh | `sitemap.service.js` |
| Google Search Console integration | ✅ verification tag + sitemap submit via service account (🟡 needs client GSC access) | `gsc.service.js` |
| Proper internal linking | ✅ automatic (breadcrumbs, categories, siblings, itineraries, articles) + manual | views |
| Canonical management, index/noindex | ✅ meta + X-Robots-Tag; preview always noindex | |
| Same content for Google and visitors | ✅ server-rendered HTML, no user-agent branching | |
| Add/edit/delete states & cities | ✅ | Admin → Destinations |
| SEO content editor, image upload & media management | ✅ TipTap editor, media library w/ folders & alt | |
| Bulk hotel import (CSV/Excel) | ✅ dry-run validation, upsert | `import.service.js` |
| Draft / Review / Publish | ✅ + scheduled auto-publish, archive | WorkflowBar, scheduler |
| SEO preview | ✅ Google SERP preview, live SEO score, signed draft preview link | |
| Sitemap management | ✅ | Admin → Sitemap & Search Console |
| Content revision history | ✅ snapshot per save + restore | `Revision` model |
| Pilot: Rajasthan → Udaipur → Bamboo Saa Resort & Spa | ✅ seeded (placeholder copy, published + **noindex** until verified) | `seed.js` |
| Scalable to thousands of hotels | ✅ indexes, lazy tree, chunked sitemaps, bulk import, auto 301s | |

## G. Theme & AI brief
| Requirement | Status |
|---|---|
| Kayak-like professional, light, premium UI on white background | ✅ segmented search bar, sort tabs with prices, filter rail, horizontal result cards |
| Brand colours from LexaTrip logo (orange + navy) | ✅ default tokens |
| AI features (Gemini or similar) on website & guest app | ✅ Lexa AI chat, NL smart search, trip planner, review summaries + admin SEO writer (🟡 needs `GEMINI_API_KEY`; rule-based fallback works without) |

## H. Developer technical requirements
| Requirement | Status |
|---|---|
| MERN, JavaScript, Tailwind + vanilla CSS | ✅ |
| Theme dynamic from master admin | ✅ colours, fonts, radius, mode, logo, presets, live preview |
| User app features dynamic from master admin | ✅ feature flags, home-section order/visibility, booking rules, AI name |
| MVC monolithic backend | ✅ |
| Component-based, reusable frontend | ✅ `components/ui` design system, ResourcePage, PropertyEditor, etc. shared by panels |
| App-like UI ready for Flutter | ✅ bottom tabs, sheets, uniform JSON API |
| All panels responsive | ✅ verified at 390px (no horizontal overflow) |
| Sub-admins created by master; no revenue access | ✅ enforced server-side (3 layers) + UI |
| CLAUDE.md + docs; separate frontend/backend folders | ✅ |

## Decisions (2026-11-21)
- Database: MongoDB Atlas (`cluster0`, database `lexatrip`) — URI in `backend/.env` only.
- Sub-admins **can** see the amount a customer paid on a booking (needed for support/refunds); commission, vendor payout and all aggregate revenue stay master-only.
- OTP: keep the default/dev OTP (`OTP_PROVIDER=console`, `DEV_OTP`) for now; real SMS provider later.
- Bus & flight: stay on sandbox providers until the client supplies API keys.
- AI (Gemini key/model): on hold — to be discussed.

## Pending / needs client input
1. Domain, hosting (VPS / cloud) and SSL.
2. Razorpay (or other) live keys; SMS provider for OTP (later); SMTP/SES for email; FCM for push.
3. Bus & flight API keys from the client — adapters are pre-defined.
4. Channel manager choice (STAAH / AxisRooms) + API credentials.
5. Gemini API key (Google AI Studio / Vertex) and budget.
6. Google Search Console access for the service account.
7. Verified Bamboo Saa content, photos (with usage rights), legal pages, GST rates confirmation.
8. Review of the existing LexaTrip website (not shared yet) — migration of current URLs into the redirect table.

# Dynamic theme & app features

Everything below is edited in **Admin → Theme & branding / App features / Integrations** and served to clients by
`GET /api/v1/public/settings`. No rebuild or app release is needed.

## Theme tokens
`primary, primaryHover, primarySoft, secondary, accent, background, surface, text, muted, border, success, warning, danger,
fontFamily, headingFontFamily, radius, mode (light|dark|system)`.

Defaults come from the LexaTrip logo: orange `#F26B1D` (gradient to `#F7931E`) on white, navy word-mark `#14213D`,
font *Plus Jakarta Sans* (clean geometric sans similar to the logo; alternatives: Inter, Manrope, DM Sans, Poppins…).

### How it works (web)
- `frontend/src/styles/index.css` maps Tailwind v4 theme colours to CSS variables (`--color-primary: var(--lt-primary)` …).
- `SettingsContext.applyTheme()` writes `--lt-*` variables on `<html>` and swaps the Google Fonts link → every
  `bg-primary`, `text-ink`, `rounded-brand`, `.btn-primary` etc. updates instantly.
- SEO pages (EJS) inject the same tokens into `:root`, so they always match the app.

### Flutter
Map the same JSON to `ThemeData` (`colorScheme.primary = primary`, `secondary = secondary`, `surface`, text theme with
`GoogleFonts.getFont(fontFamily)`, `BorderRadius.circular(radius)`).

## Feature flags
`hotels, buses, flights, aiAssistant, aiSmartSearch, aiTripPlanner, aiReviewSummary, wishlist, reviews, coupons, savedTravellers,
priceInsights, mapView, supportTickets, requestToBook, payAtHotel, maintenanceMode` — routes, navigation, home blocks and API
endpoints (bus/flight) respect them.

## Home screen composition
`homeSections` = ordered list of `{ key, label, enabled }` (`hero_search, categories, ai_banner, offers, popular_destinations,
featured_properties, why_us`). Banners & coupons feed the offers block.

## Booking rules
Hold minutes, max rooms, max nights, convenience fee. Tax slabs and default commission are master-only.

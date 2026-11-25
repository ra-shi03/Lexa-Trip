# Customer mobile app (inside `frontend/`)

The customer app is **part of the frontend project** (same MERN codebase, same build, same backend). It is an app-style experience —
splash, onboarding, bottom tabs, native-style headers — and is the blueprint that is converted/wrapped into Flutter as the **last** project step.

## Run
```bash
cd frontend
npm run dev          # website + panels            → http://localhost:5173
npm run dev:app      # the customer app (own port) → http://localhost:5174   (also on your phone: http://<mac-ip>:5174)
```
You can also open **http://localhost:5173/app** — it switches that browser into app mode (remembered). Use *Menu → Open website version*
or **/web** to switch back. Start the backend first. Login: any mobile + OTP `123456` (dev).

`npm run build` → website build (`dist/`) · `npm run build:app` → app-only build (`dist-app/`, same code with `VITE_APP_MODE=true`).

## How "app mode" works
`src/lib/mode.js#isAppMode()` is true when: `VITE_APP_MODE=true`, the page runs as an **installed PWA** (standalone), or the user opened `/app`.
`/admin` and `/vendor` are never in app mode. `src/main.jsx` then loads **either** `src/app/entry.jsx` (app) **or** `src/entry-web.jsx` (website),
each with its own stylesheet, so the website's desktop layout is never affected.

```
frontend/src/
  app/                 ← customer-app only
    entry.jsx          providers + AppRouter
    AppRouter.jsx      routes (same paths as the website, so shared screens just work)
    AppShell.jsx       top bar + bottom tabs
    screens/           Splash, Onboarding, AppHome, Menu
    app.css            phone-first overrides (desktop breakpoints disabled, 480px column)
  pages/user/…         booking & account screens SHARED by website and app
  components/, context/, hooks/, lib/   shared
```
Add an app-only screen in `src/app/screens` and register it in `AppRouter.jsx`. Fix/extend a shared screen once — both experiences get it.

## Launch flow
`Splash` (admin logo/background) → `Onboarding` (first launch, admin slides) → `Home` → tabs **Home · Explore · Trips · Lexa AI · Profile** (`/profile` hub → `/account` edit page: photo, name, gender, date of birth, email).
Checkout, payment, seat selection, voucher etc. hide the tab bar like a native app.

## What the master admin controls (no code, no rebuild)
| Item | Admin page |
|---|---|
| Logo mark, full logo, **favicon / app icon**, app name, tagline | Theme & branding |
| Colours, fonts, corner radius, dark mode | Theme & branding |
| Splash background / image / duration, onboarding slides | **Mobile app** |
| **Login / Sign up page**: hero photo, overlay, logo badge, welcome text, button labels, headings, email field (optional/required/hidden), desktop highlights | **Login page** |
| Home hero slideshow, headline, AI banner | Home page content |
| Offers, category photos, destination photos | Banners / Categories / Destinations |
| Show/hide Stays, Buses, Flights, AI, wishlist, coupons, support… | App features |

Backend generates the PWA assets from those settings: `GET /api/v1/public/manifest` (name, theme colour, `start_url=/app`) and
`GET /api/v1/public/brand/icon/{48|96|144|180|192|256|512}.png` (resized from the uploaded logo mark). Favicon, `apple-touch-icon`,
`theme-color` and tab title are applied at runtime from `/public/settings`.

## Install on a phone
Open the app URL on the phone → iOS Safari: Share → *Add to Home Screen*; Android Chrome: ⋮ → *Install app*. An installed icon opens straight
into the app. Full PWA install / offline needs **https** (deploy). The service worker is registered in production builds only.

## Deploy
Either host `dist/` (website + app: users reach the app at `/app` or by installing) or host `dist-app/` on its own domain/sub-domain
(e.g. `app.lexatrip.com`). Route `/api` and `/uploads` to the backend (see `DEPLOYMENT.md`).

## Flutter (last step)
Screens map 1:1 (see `FLUTTER-MIGRATION.md`): `/public/settings` → ThemeData, `Splash/Onboarding/AppHome/Menu` → Flutter screens, booking
screens → same API calls. Nothing in this app blocks the conversion; the API contract is the single source of truth.


## Website vs app are separate codebases (inside one Vite project)
- `/` → **website** (`src/App.jsx`, `src/pages/*`). `/app` → **customer app** (`src/app/*`). Admin/vendor panels are always the website.
- The app has its own copy of every guest screen in `src/app/screens/` (Search, PropertyDetail, Checkout, BookingDetail, Bus, Flights, AiPage, Login, Misc, `account/Account`). Nothing in `src/app` imports from `src/pages`, and the website never imports from `src/app`. Only API client, contexts, hooks and UI primitives are shared.
- Launch flow: signed out (new customer **or** after logout) → Splash → Onboarding → Login → Home. Still signed in → Splash → Home. Logout clears the splash marker and returns to `/app`.

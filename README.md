# LexaTrip — Book. Explore. Repeat.

Hotel, stay, bus & flight booking platform with vendor panel, master/sub-admin panel, Lexa AI (Gemini) and an
Advanced SEO CMS for hotel landing pages & itineraries.

| Part | Stack | Folder |
|---|---|---|
| API, SEO pages, jobs | Node 20+, Express 5, MongoDB (Mongoose 9), EJS — MVC monolith | `backend/` |
| Website, **customer mobile app** (`src/app/`), vendor panel, admin panel | React 19, Vite, Tailwind CSS v4 + vanilla CSS, React Router 7 | `frontend/` |

## Quick start
```bash
# 1. Backend
cd backend
cp .env.example .env          # set MONGO_URI (include user:password if your MongoDB has auth enabled) and JWT_SECRET
npm install
npm run seed                  # ⚠ drops the configured database, loads demo data + SEO pilot
npm run dev                   # http://localhost:5001

# 2. Frontend (new terminal)
cd frontend
cp .env.example .env          # VITE_BACKEND_URL=http://localhost:5001
npm install
npm run dev                   # http://localhost:5173
```

| URL | What |
|---|---|
| http://localhost:5173/ | Guest website |
| http://localhost:5174/ | **Customer mobile app** (`cd frontend && npm run dev:app`) — or open `/app` on :5173 |
| http://localhost:5173/vendor | Vendor panel — vendor@lexatrip.com / Vendor@123 |
| http://localhost:5173/admin | Admin — admin@lexatrip.com / Admin@123 (sub-admin: subadmin@lexatrip.com / Subadmin@123) |
| http://localhost:5173/hotels/rajasthan/udaipur/bamboo-saa-resort-spa/ | SEO pilot hotel page (server-rendered) |
| http://localhost:5173/sitemap.xml · /robots.txt | Sitemaps |

Guest login: any Indian mobile number + OTP `123456` (development mode). Payments run in sandbox mode.

# SEO CMS — operator & developer guide

## Editor workflow
1. **Admin → SEO CMS → Content explorer** — pick India → State → City.
2. City → *Categories* → **Generate default categories** (templates editable in *Sitemap & Search Console → Global SEO settings*).
3. **Add hotel** → fill Details, Rooms, Facilities, Images (alt text!), Content (H1 + H2/H3 sections), FAQs, SEO, Internal links.
4. Hotel → *Itineraries* → **New itinerary** (day-wise plan, experiences, dining, attractions, guest info, FAQs, SEO).
5. **Save** (creates a revision) → **Preview** (signed link, noindex) → **Send for review** → **Publish** or **Schedule**.
6. Check the **SEO score** and **Google preview** in the SEO tab; use **AI suggest** for drafts of title/meta/keywords/outline.
7. Published + indexable pages appear in `/sitemap.xml` within minutes (cache 10 min; *Regenerate* forces it).

## URL rules (`backend/src/services/seo/url.service.js`)
| Page | URL |
|---|---|
| City hotel hub | `/hotels/<state>/<city>/` |
| Category | `/hotels/<state>/<city>/<category>/` |
| Hotel | `/hotels/<state>/<city>/<hotel>/` |
| Itinerary | `/hotels/<state>/<city>/<hotel>/itinerary/<slug>/` |
| State guide hub | `/blog/<state>/` |
| City guide hub | `/blog/<state>/<city>/` |
| Article | `/blog/<state>/<slug>/` or `/blog/<state>/<city>/<slug>/` |

Collisions are prevented on save (hotel vs category slugs in a city; state-level article vs city slugs; `itinerary` reserved).
Non-trailing-slash URLs 301 to the trailing-slash form. Changing a published URL or deleting a page creates a 301 automatically.

## What Google receives
- Complete HTML (EJS), canonical, robots meta + `X-Robots-Tag`, OG tags, verification meta tags.
- JSON-LD: BreadcrumbList on every page; Hotel/Resort/LodgingBusiness (+ address, geo, amenities, star rating);
  TouristTrip with day ItemList; Article; ItemList on hubs; FAQPage when FAQs exist; plus optional custom JSON-LD.
- `robots.txt` disallows `/api/`, panels, checkout and `?preview=` URLs and points to the sitemap.

## Pilot status
Bamboo Saa Resort & Spa, its itinerary and the category pages are seeded **published**; hotel + itinerary are **noindex** because the
copy and photos are placeholders. The "Where to stay in Udaipur" article is indexable (generic, factual content). To go live:
replace placeholders → set *Allow search engines to index* → Save → *Submit sitemap to Google*.

## Bulk import
Template: *Bulk import → Download template*. Columns include name, slug, state, city, categories (`|`-separated slugs), propertyType,
starRating, descriptions, address, lat/lng, contact, times, priceFrom, amenities, facilities, heroImage(+Alt), gallery,
seoTitle, metaDescription, h1, keywords, canonicalUrl, index, status. Always **Validate** first. Re-import updates by (city, slug)
without overwriting editorial content.

## Search Console
1. Verify the property (DNS recommended) or paste the meta-tag code in *Sitemap & Search Console → Verify ownership*.
2. Create a Google Cloud service account with the *Search Console API* enabled, add its email as **Owner** in GSC.
3. Set `GSC_SERVICE_ACCOUNT_FILE` and `GSC_SITE_URL` (e.g. `sc-domain:lexatrip.com`) in `backend/.env`.
4. *Submit sitemap to Google*. (Google's Indexing API is only for job/livestream pages, so it is intentionally not used.)

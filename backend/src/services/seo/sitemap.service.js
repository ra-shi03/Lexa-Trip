import { State, City } from '../../models/Location.js';
import HotelCategory from '../../models/seo/HotelCategory.js';
import SeoHotel from '../../models/seo/SeoHotel.js';
import Itinerary from '../../models/seo/Itinerary.js';
import SeoArticle from '../../models/seo/SeoArticle.js';
import { SitemapLog } from '../../models/seo/Revision.js';
import { paths, absolute } from './url.service.js';
import { env } from '../../config/env.js';

/**
 * XML sitemaps (sitemaps.org protocol). Split by content type and chunked at
 * 45,000 URLs so the system scales to thousands of hotels/itineraries.
 * Only PUBLISHED + INDEXABLE + sitemap.include=true pages are listed.
 */
const CHUNK = 45_000;
const TTL = 10 * 60_000;
let cache = { at: 0, sets: null };

const indexable = { status: 'published', 'seo.robots.index': { $ne: false }, 'seo.sitemap.include': { $ne: false } };
const entry = (path, doc) => ({
  loc: absolute(path),
  lastmod: (doc.updatedAt || doc.publishedAt || new Date()).toISOString(),
  changefreq: doc.seo?.sitemap?.changefreq || 'weekly',
  priority: doc.seo?.sitemap?.priority ?? 0.6,
});

async function build() {
  const [states, cities, cats, hotels, its, articles] = await Promise.all([
    State.find({ isActive: true }).lean(),
    City.find({ isActive: true }).populate('state', 'slug').lean(),
    HotelCategory.find(indexable).populate('state', 'slug').populate('city', 'slug').lean(),
    SeoHotel.find(indexable).populate('state', 'slug').populate('city', 'slug').lean(),
    Itinerary.find(indexable).populate({ path: 'hotel', select: 'slug state city status seo', populate: [{ path: 'state', select: 'slug' }, { path: 'city', select: 'slug' }] }).lean(),
    SeoArticle.find(indexable).populate('state', 'slug').populate('city', 'slug').lean(),
  ]);

  const liveHotels = new Set(hotels.map((h) => String(h._id)));
  const citiesWithHotels = new Set(hotels.map((h) => String(h.city?._id)));
  const statesWithArticles = new Set([...articles.map((a) => String(a.state?._id)), ...hotels.map((h) => String(h.state?._id))]);
  const citiesWithArticles = new Set(articles.filter((a) => a.city).map((a) => String(a.city._id)));

  const locations = [
    ...cities.filter((c) => citiesWithHotels.has(String(c._id)) && c.seo?.robots?.index !== false).map((c) => entry(paths.cityHotels(c.state, c), { ...c, seo: { sitemap: { priority: 0.8 } } })),
    ...states.filter((s) => statesWithArticles.has(String(s._id))).map((s) => entry(paths.stateBlog(s), s)),
    ...cities.filter((c) => citiesWithArticles.has(String(c._id))).map((c) => entry(paths.cityBlog(c.state, c), c)),
    ...cats.map((c) => entry(paths.category(c.state, c.city, c), c)),
  ];

  return {
    locations,
    hotels: hotels.map((h) => entry(paths.hotel(h.state, h.city, h), h)),
    itineraries: its
      .filter((i) => i.hotel && liveHotels.has(String(i.hotel._id)))
      .map((i) => entry(paths.itinerary(i.hotel.state, i.hotel.city, i.hotel, i), i)),
    articles: articles.map((a) => entry(paths.article(a.state, a.city, a), a)),
  };
}

export async function getSitemapSets({ fresh = false } = {}) {
  if (!fresh && cache.sets && Date.now() - cache.at < TTL) return cache.sets;
  cache = { at: Date.now(), sets: await build() };
  return cache.sets;
}

export const invalidateSitemap = () => { cache = { at: 0, sets: null }; };

const xmlEscape = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export async function sitemapIndexXml() {
  const sets = await getSitemapSets();
  const files = [];
  for (const [name, list] of Object.entries(sets)) {
    const chunks = Math.max(1, Math.ceil(list.length / CHUNK));
    if (!list.length) continue;
    for (let i = 1; i <= chunks; i++) files.push(`${env.siteUrl}/sitemaps/${name}-${i}.xml`);
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${files.map((f) => `  <sitemap><loc>${xmlEscape(f)}</loc><lastmod>${new Date().toISOString()}</lastmod></sitemap>`).join('\n')}
</sitemapindex>`;
}

export async function sitemapXml(name, page = 1) {
  const sets = await getSitemapSets();
  const list = sets[name];
  if (!list) return null;
  const slice = list.slice((page - 1) * CHUNK, page * CHUNK);
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${slice.map((u) => `  <url><loc>${xmlEscape(u.loc)}</loc><lastmod>${u.lastmod}</lastmod><changefreq>${u.changefreq}</changefreq><priority>${Number(u.priority).toFixed(1)}</priority></url>`).join('\n')}
</urlset>`;
}

export async function sitemapSummary() {
  const sets = await getSitemapSets({ fresh: true });
  const counts = Object.fromEntries(Object.entries(sets).map(([k, v]) => [k, v.length]));
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  await SitemapLog.create({ action: 'generated', urlCount: total, message: JSON.stringify(counts) });
  return { counts, total, indexUrl: `${env.siteUrl}/sitemap.xml`, urls: Object.fromEntries(Object.entries(sets).map(([k, v]) => [k, v.slice(0, 200)])) };
}

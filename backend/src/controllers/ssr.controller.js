import jwt from 'jsonwebtoken';
import { State, City } from '../models/Location.js';
import HotelCategory from '../models/seo/HotelCategory.js';
import SeoHotel from '../models/seo/SeoHotel.js';
import Itinerary from '../models/seo/Itinerary.js';
import SeoArticle from '../models/seo/SeoArticle.js';
import Property from '../models/Property.js';
import { Redirect } from '../models/seo/Revision.js';
import { getSettings } from '../services/settings.service.js';
import { paths, absolute } from '../services/seo/url.service.js';
import { breadcrumbSchema, faqSchema, hotelSchema, itinerarySchema, articleSchema, itemListSchema, finalSchemas } from '../services/seo/schema.service.js';
import { sitemapIndexXml, sitemapXml } from '../services/seo/sitemap.service.js';
import { stripHtml } from '../utils/sanitizeHtml.js';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Server-rendered public SEO pages (EJS views).
 * Google and human visitors receive the SAME fully-rendered HTML — no cloaking,
 * no client-side rendering dependency. Pages are not linked from the main site
 * navigation; they are discovered via the XML sitemap and internal links.
 */

// ── Middlewares ──
export async function seoRedirects(req, res, next) {
  const [fullPath, ...qs] = req.originalUrl.split('?');
  const query = qs.length ? `?${qs.join('?')}` : '';
  // 1) enforce trailing slash (canonical form)
  if (!fullPath.endsWith('/') && !fullPath.split('/').pop().includes('.')) {
    return res.redirect(301, `${fullPath}/${query}`);
  }
  // 2) managed 301/302 redirects (slug changes, deleted pages)
  const r = await Redirect.findOne({ from: fullPath.toLowerCase(), isActive: true }).lean();
  if (r) {
    Redirect.updateOne({ _id: r._id }, { $inc: { hits: 1 } }).catch(() => {});
    return res.redirect(r.code, r.to);
  }
  next();
}

function previewOf(req) {
  if (!req.query.preview) return false;
  try {
    return Boolean(jwt.verify(String(req.query.preview), env.jwtSecret).preview);
  } catch {
    return false;
  }
}

const visible = (doc, preview) => doc && (preview || doc.status === 'published');
const notFound = () => ApiError.notFound('Page not found');

async function baseView(req, { path, seo = {}, title, description, image, crumbs, schemas = [] }) {
  const s = await getSettings();
  const preview = previewOf(req);
  const robots = preview ? { index: false, follow: false } : { index: seo.robots?.index !== false, follow: seo.robots?.follow !== false };
  const pageTitle = seo.title || title;
  return {
    site: { url: env.siteUrl, name: s.brand.appName, tagline: s.brand.tagline, logo: s.brand.logoUrl, mark: s.brand.markUrl, favicon: s.brand.faviconUrl, email: s.brand.supportEmail, phone: s.brand.supportPhone },
    theme: s.theme,
    meta: {
      title: pageTitle.includes(s.seo.siteName) ? pageTitle : `${pageTitle}${s.seo.titleSuffix || ''}`,
      description: (seo.metaDescription || description || s.seo.defaultDescription || '').slice(0, 320),
      canonical: seo.canonicalUrl ? absolute(seo.canonicalUrl) : absolute(path),
      robots: `${robots.index ? 'index' : 'noindex'},${robots.follow ? 'follow' : 'nofollow'},max-image-preview:large`,
      keywords: [seo.primaryKeyword, ...(seo.secondaryKeywords || [])].filter(Boolean).join(', '),
      ogTitle: seo.ogTitle || pageTitle,
      ogDescription: seo.ogDescription || seo.metaDescription || description,
      ogImage: absolute(seo.ogImage || image || s.seo.defaultOgImage),
      gscVerification: s.seo.gscVerification,
      bingVerification: s.seo.bingVerification,
    },
    preview,
    crumbs,
    schemas: finalSchemas([breadcrumbSchema(crumbs, env.siteUrl), ...schemas], seo),
    stripHtml,
    fmt: (n) => (n ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n) : ''),
    paths,
  };
}

function send(res, view, data) {
  if (data.preview) res.set('X-Robots-Tag', 'noindex, nofollow');
  else if (data.meta.robots.startsWith('noindex')) res.set('X-Robots-Tag', data.meta.robots);
  res.set('Cache-Control', data.preview ? 'no-store' : 'public, max-age=300');
  res.render(view, data);
}

async function loadStateCity(stateSlug, citySlug) {
  const state = await State.findOne({ slug: stateSlug, isActive: true }).lean();
  if (!state) throw notFound();
  if (!citySlug) return { state };
  const city = await City.findOne({ slug: citySlug, state: state._id, isActive: true }).lean();
  if (!city) throw notFound();
  return { state, city };
}

const crumbsFor = (state, city, extra = [], section = 'hotels') => [
  { label: 'Home', url: '/' },
  ...(section === 'blog' ? [{ label: `${state.name} travel guide`, url: paths.stateBlog(state) }] : [{ label: `${state.name}`, url: paths.stateBlog(state) }]),
  ...(city ? [{ label: section === 'blog' ? `${city.name} guide` : `Hotels in ${city.name}`, url: section === 'blog' ? paths.cityBlog(state, city) : paths.cityHotels(state, city) }] : []),
  ...extra,
];

// ── /hotels/:state/:city/ ──
export async function cityHotels(req, res) {
  const { state, city } = await loadStateCity(req.params.state, req.params.city);
  const preview = previewOf(req);
  const [categories, hotels, articles] = await Promise.all([
    HotelCategory.find({ city: city._id, ...(preview ? {} : { status: 'published' }) }).sort({ sortOrder: 1 }).lean(),
    SeoHotel.find({ city: city._id, ...(preview ? {} : { status: 'published' }) }).select('name slug shortDescription heroImage starRating priceFrom categories propertyType').sort({ starRating: -1, name: 1 }).lean(),
    SeoArticle.find({ city: city._id, status: 'published' }).select('title slug excerpt coverImage').limit(6).lean(),
  ]);
  if (!hotels.length && !preview) throw notFound();
  const path = paths.cityHotels(state, city);
  const data = await baseView(req, {
    path,
    seo: city.seo,
    title: city.content?.h1 || `Hotels in ${city.name}, ${state.name}`,
    description: `Explore ${hotels.length} handpicked hotels and resorts in ${city.name}, ${state.name} — photos, rooms, itineraries and guest information.`,
    image: city.image,
    crumbs: crumbsFor(state, city),
    schemas: [itemListSchema(hotels.map((h) => ({ name: h.name, url: paths.hotel(state, city, h) })), env.siteUrl)],
  });
  send(res, 'seo/city', { ...data, state, city, categories, hotels, articles });
}

// ── /hotels/:state/:city/:slug/  (category OR hotel) ──
export async function categoryOrHotel(req, res) {
  const { state, city } = await loadStateCity(req.params.state, req.params.city);
  const preview = previewOf(req);
  const category = await HotelCategory.findOne({ city: city._id, slug: req.params.slug }).lean();
  if (category) {
    if (!visible(category, preview)) throw notFound();
    const hotels = await SeoHotel.find({ city: city._id, categories: category._id, ...(preview ? {} : { status: 'published' }) }).select('name slug shortDescription heroImage starRating priceFrom propertyType').lean();
    const siblings = await HotelCategory.find({ city: city._id, _id: { $ne: category._id }, status: 'published' }).select('name slug').lean();
    const path = paths.category(state, city, category);
    const data = await baseView(req, {
      path,
      seo: category.seo,
      title: category.content?.h1 || `${category.name} in ${city.name}`,
      description: `Compare the best ${category.name.toLowerCase()} in ${city.name}, ${state.name}: photos, rooms, amenities and itineraries.`,
      image: category.image || hotels[0]?.heroImage?.url,
      crumbs: crumbsFor(state, city, [{ label: category.name, url: path }]),
      schemas: [itemListSchema(hotels.map((h) => ({ name: h.name, url: paths.hotel(state, city, h) })), env.siteUrl), faqSchema(category.faqs)],
    });
    return send(res, 'seo/category', { ...data, state, city, category, hotels, siblings });
  }

  const hotel = await SeoHotel.findOne({ city: city._id, slug: req.params.slug }).populate('categories', 'name slug status').lean();
  if (!visible(hotel, preview)) throw notFound();
  const [itineraries, related, articles, property] = await Promise.all([
    Itinerary.find({ hotel: hotel._id, ...(preview ? {} : { status: 'published' }) }).select('title slug summary durationDays durationNights heroImage travellerType').lean(),
    SeoHotel.find({ _id: { $in: hotel.relatedHotels?.length ? hotel.relatedHotels : [] }, status: 'published' }).select('name slug heroImage starRating shortDescription').lean().then(async (r) =>
      r.length ? r : SeoHotel.find({ city: city._id, _id: { $ne: hotel._id }, status: 'published' }).select('name slug heroImage starRating shortDescription').limit(4).lean(),
    ),
    SeoArticle.find({ status: 'published', $or: [{ hotels: hotel._id }, { city: city._id }] }).select('title slug excerpt city').limit(4).lean(),
    hotel.property ? Property.findOne({ _id: hotel.property, status: 'approved', isVisible: true }).select('slug minPrice').lean() : null,
  ]);
  const path = paths.hotel(state, city, hotel);
  const full = { ...hotel, state, city };
  const data = await baseView(req, {
    path,
    seo: hotel.seo,
    title: hotel.content?.h1 || `${hotel.name}, ${city.name}`,
    description: hotel.shortDescription || stripHtml(hotel.description).slice(0, 160),
    image: hotel.heroImage?.url,
    crumbs: crumbsFor(state, city, [{ label: hotel.name, url: path }]),
    schemas: [hotelSchema(full, absolute(path), env.siteUrl), faqSchema(hotel.faqs)],
  });
  const bookUrl = property ? `/stay/${property.slug}` : `/search?city=${encodeURIComponent(city.name)}`;
  send(res, 'seo/hotel', { ...data, state, city, hotel, itineraries, related, articles, bookUrl, livePriceFrom: property?.minPrice });
}

// ── /hotels/:state/:city/:hotel/itinerary/:slug/ ──
export async function itineraryPage(req, res) {
  const { state, city } = await loadStateCity(req.params.state, req.params.city);
  const preview = previewOf(req);
  const hotel = await SeoHotel.findOne({ city: city._id, slug: req.params.hotel }).lean();
  if (!visible(hotel, preview)) throw notFound();
  const it = await Itinerary.findOne({ hotel: hotel._id, slug: req.params.slug }).lean();
  if (!visible(it, preview)) throw notFound();
  const others = await Itinerary.find({ hotel: hotel._id, _id: { $ne: it._id }, status: 'published' }).select('title slug durationDays').lean();
  const path = paths.itinerary(state, city, hotel, it);
  const data = await baseView(req, {
    path,
    seo: it.seo,
    title: it.content?.h1 || it.title,
    description: it.summary,
    image: it.heroImage?.url || hotel.heroImage?.url,
    crumbs: crumbsFor(state, city, [{ label: hotel.name, url: paths.hotel(state, city, hotel) }, { label: it.title, url: path }]),
    schemas: [itinerarySchema(it, absolute(path)), faqSchema(it.faqs)],
  });
  const property = hotel.property ? await Property.findOne({ _id: hotel.property, status: 'approved' }).select('slug').lean() : null;
  send(res, 'seo/itinerary', { ...data, state, city, hotel, it, others, bookUrl: property ? `/stay/${property.slug}` : `/search?city=${encodeURIComponent(city.name)}` });
}

// ── /blog/:state/ ──
export async function stateBlog(req, res) {
  const { state } = await loadStateCity(req.params.state);
  const [articles, hotelCities] = await Promise.all([
    SeoArticle.find({ state: state._id, status: 'published' }).populate('city', 'name slug').sort({ publishedAt: -1 }).lean(),
    SeoHotel.distinct('city', { state: state._id, status: 'published' }),
  ]);
  if (!articles.length && !hotelCities.length && !previewOf(req)) throw notFound();
  const cities = await City.find({ state: state._id, isActive: true }).select('name slug').lean();
  const cityIdsWithContent = new Set([...articles.filter((a) => a.city).map((a) => String(a.city._id)), ...hotelCities.map(String)]);
  const hotelCityIds = new Set(hotelCities.map(String));
  const path = paths.stateBlog(state);
  const data = await baseView(req, {
    path,
    seo: state.seo,
    title: state.content?.h1 || `${state.name} Travel Guide — Places, Stays & Itineraries`,
    description: `Plan your ${state.name} trip: city guides, where to stay, itineraries and travel tips from LexaTrip.`,
    image: state.image,
    crumbs: [{ label: 'Home', url: '/' }, { label: `${state.name} travel guide`, url: path }],
  });
  send(res, 'seo/blog-state', {
    ...data,
    state,
    articles,
    cities: cities.filter((c) => cityIdsWithContent.has(String(c._id))).map((c) => ({ ...c, hasHotels: hotelCityIds.has(String(c._id)) })),
  });
}

// ── /blog/:state/:slug/  (city hub OR state-level article) ──
export async function blogCityOrArticle(req, res) {
  const { state } = await loadStateCity(req.params.state);
  const city = await City.findOne({ state: state._id, slug: req.params.slug, isActive: true }).lean();
  if (city) {
    const articles = await SeoArticle.find({ city: city._id, status: 'published' }).sort({ publishedAt: -1 }).lean();
    if (!articles.length && !previewOf(req)) throw notFound();
    const hotels = await SeoHotel.find({ city: city._id, status: 'published' }).select('name slug').limit(12).lean();
    const path = paths.cityBlog(state, city);
    const data = await baseView(req, {
      path,
      seo: {},
      title: `${city.name} Travel Guide — Things to Do, Stays & Tips`,
      description: `Everything you need for a trip to ${city.name}, ${state.name}: guides, itineraries and the best places to stay.`,
      image: city.image,
      crumbs: crumbsFor(state, city, [], 'blog'),
    });
    return send(res, 'seo/blog-city', { ...data, state, city, articles, hotels });
  }
  return renderArticle(req, res, state, null, req.params.slug);
}

// ── /blog/:state/:city/:slug/ ──
export async function cityArticle(req, res) {
  const { state, city } = await loadStateCity(req.params.state, req.params.city);
  return renderArticle(req, res, state, city, req.params.slug);
}

async function renderArticle(req, res, state, city, slug) {
  const preview = previewOf(req);
  const a = await SeoArticle.findOne({ state: state._id, city: city ? city._id : null, slug }).populate({ path: 'hotels', select: 'name slug city state heroImage shortDescription', populate: [{ path: 'city', select: 'slug name' }, { path: 'state', select: 'slug' }] }).lean();
  if (!visible(a, preview)) throw notFound();
  const s = await getSettings();
  const more = await SeoArticle.find({ state: state._id, _id: { $ne: a._id }, status: 'published' }).select('title slug city').populate('city', 'slug').limit(5).lean();
  const path = paths.article(state, city, a);
  const data = await baseView(req, {
    path,
    seo: a.seo,
    title: a.content?.h1 || a.title,
    description: a.excerpt,
    image: a.coverImage?.url,
    crumbs: crumbsFor(state, city, [{ label: a.title, url: path }], 'blog'),
    schemas: [articleSchema(a, absolute(path), env.siteUrl, s.brand.appName, s.seo.organizationLogo), faqSchema(a.faqs)],
  });
  send(res, 'seo/article', { ...data, state, city, a, more });
}

// ── robots.txt & sitemaps ──
export async function robots(_req, res) {
  const s = await getSettings();
  res.type('text/plain').send(
    [
      'User-agent: *',
      'Allow: /',
      'Disallow: /api/',
      'Disallow: /admin',
      'Disallow: /vendor',
      'Disallow: /account',
      'Disallow: /checkout',
      'Disallow: /*?preview=',
      s.seo.robotsExtra || '',
      '',
      `Sitemap: ${env.siteUrl}/sitemap.xml`,
      '',
    ].join('\n'),
  );
}

export async function sitemapIndex(_req, res) {
  res.type('application/xml').set('Cache-Control', 'public, max-age=600').send(await sitemapIndexXml());
}

export async function sitemapFile(req, res) {
  const m = req.params.file.match(/^([a-z]+)-(\d+)\.xml$/);
  const xml = m && (await sitemapXml(m[1], Number(m[2])));
  if (!xml) throw notFound();
  res.type('application/xml').set('Cache-Control', 'public, max-age=600').send(xml);
}

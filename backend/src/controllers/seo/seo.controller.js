import jwt from 'jsonwebtoken';
import { State, City } from '../../models/Location.js';
import HotelCategory from '../../models/seo/HotelCategory.js';
import SeoHotel from '../../models/seo/SeoHotel.js';
import Itinerary from '../../models/seo/Itinerary.js';
import SeoArticle from '../../models/seo/SeoArticle.js';
import { Revision, Redirect, SitemapLog } from '../../models/seo/Revision.js';
import { Media } from '../../models/Misc.js';
import Property from '../../models/Property.js';
import { saveEntity, changeStatus, restoreRevision, loadPopulated, SEO_MODELS } from '../../services/seo/content.service.js';
import { pathFor, absolute, paths } from '../../services/seo/url.service.js';
import { sitemapSummary, invalidateSitemap } from '../../services/seo/sitemap.service.js';
import { submitSitemap, listSitemaps, gscConfigured } from '../../services/seo/gsc.service.js';
import { importHotels, templateCsv, IMPORT_COLUMNS } from '../../services/seo/import.service.js';
import { seoAssist } from '../../services/ai/ai.service.js';
import { getSettings } from '../../services/settings.service.js';
import { audit } from '../../services/audit.service.js';
import { publicUrlFor } from '../../middlewares/upload.js';
import { env } from '../../config/env.js';
import { ok, created } from '../../utils/response.js';
import { ApiError } from '../../utils/ApiError.js';
import { buildListQuery, pageMeta } from '../../utils/queryBuilder.js';
import { slugify, escapeRegex } from '../../utils/helpers.js';

/**
 * Folder tree for the SEO CMS sidebar:
 *   India → State → City → { categories, hotels, articles } (with counts)
 * Hotels themselves are loaded lazily per city (scales to thousands).
 */
export async function tree(_req, res) {
  const [states, cities, catCounts, hotelCounts, articleCounts, cats] = await Promise.all([
    State.find().sort({ sortOrder: 1, name: 1 }).select('name slug status isActive').lean(),
    City.find().sort({ sortOrder: 1, name: 1 }).select('name slug state status isActive').lean(),
    HotelCategory.aggregate([{ $group: { _id: '$city', n: { $sum: 1 } } }]),
    SeoHotel.aggregate([{ $group: { _id: '$city', n: { $sum: 1 }, published: { $sum: { $cond: [{ $eq: ['$status', 'published'] }, 1, 0] } } } }]),
    SeoArticle.aggregate([{ $group: { _id: { state: '$state', city: '$city' }, n: { $sum: 1 } } }]),
    HotelCategory.find().select('name slug city status').sort({ sortOrder: 1 }).lean(),
  ]);
  const m = (arr) => Object.fromEntries(arr.map((x) => [String(x._id), x]));
  const cc = m(catCounts);
  const hc = m(hotelCounts);
  ok(res, {
    country: 'India',
    states: states.map((s) => ({
      ...s,
      articles: articleCounts.filter((a) => String(a._id.state) === String(s._id) && !a._id.city).reduce((x, a) => x + a.n, 0),
      cities: cities
        .filter((c) => String(c.state) === String(s._id))
        .map((c) => ({
          ...c,
          categories: cats.filter((k) => String(k.city) === String(c._id)),
          categoryCount: cc[String(c._id)]?.n || 0,
          hotelCount: hc[String(c._id)]?.n || 0,
          publishedHotels: hc[String(c._id)]?.published || 0,
          articleCount: articleCounts.filter((a) => String(a._id.city) === String(c._id)).reduce((x, a) => x + a.n, 0),
        })),
    })),
  });
}

/** Generic entity handlers for SeoHotel / Itinerary / SeoArticle / HotelCategory / City / State */
export function entity(type) {
  const Model = SEO_MODELS[type];
  const searchFields = { SeoHotel: ['name', 'slug', 'seo.primaryKeyword'], Itinerary: ['title', 'slug'], SeoArticle: ['title', 'slug'], HotelCategory: ['name', 'slug'], City: ['name', 'slug'], State: ['name', 'slug'] }[type];
  const filterFields = { SeoHotel: ['state', 'city', 'status', 'categories'], Itinerary: ['hotel', 'status'], SeoArticle: ['state', 'city', 'status'], HotelCategory: ['city', 'state', 'status'], City: ['state', 'status', 'isActive'], State: ['status', 'isActive'] }[type];
  const listPopulate = {
    SeoHotel: [{ path: 'state', select: 'name slug' }, { path: 'city', select: 'name slug' }, { path: 'categories', select: 'name slug' }],
    Itinerary: [{ path: 'hotel', select: 'name slug state city', populate: [{ path: 'state', select: 'slug' }, { path: 'city', select: 'slug' }] }],
    SeoArticle: [{ path: 'state', select: 'name slug' }, { path: 'city', select: 'name slug' }],
    HotelCategory: [{ path: 'state', select: 'name slug' }, { path: 'city', select: 'name slug' }],
    City: [{ path: 'state', select: 'name slug' }],
    State: [],
  }[type];
  const listSelect = {
    SeoHotel: 'name slug state city categories status starRating seo.title seo.primaryKeyword seo.robots heroImage updatedAt publishedAt scheduledAt version propertyType',
    Itinerary: 'title slug hotel status durationDays durationNights travellerType seo.title updatedAt publishedAt scheduledAt version',
    SeoArticle: 'title slug state city status seo.title updatedAt publishedAt scheduledAt version',
  }[type];

  return {
    async list(req, res) {
      const { filter, skip, limit, page, sort } = buildListQuery(req.query, { searchFields, filterFields });
      const q = Model.find(filter).sort(sort).skip(skip).limit(limit).populate(listPopulate);
      if (listSelect) q.select(listSelect);
      const [items, total] = await Promise.all([q.lean(), Model.countDocuments(filter)]);
      const withUrl = items.map((d) => {
        try {
          return { ...d, publicUrl: pathFor(type, d) };
        } catch {
          return d;
        }
      });
      ok(res, withUrl, pageMeta(total, page, limit));
    },
    async get(req, res) {
      const d = await loadPopulated(type, req.params.id);
      if (!d) throw ApiError.notFound();
      const extra = {};
      if (type === 'SeoHotel') {
        extra.itineraries = await Itinerary.find({ hotel: d._id }).select('title slug status durationDays updatedAt').lean();
        if (d.property) extra.linkedProperty = await Property.findById(d.property).select('name slug status minPrice').lean();
      }
      ok(res, { ...d, ...extra, publicUrl: pathFor(type, d), absoluteUrl: absolute(pathFor(type, d)) });
    },
    async create(req, res) {
      const doc = await saveEntity(type, null, { ...req.body }, req.admin, req.body.revisionNote);
      audit(req, `seo.${type}.create`, type, doc._id);
      created(res, doc);
    },
    async update(req, res) {
      const note = req.body.revisionNote;
      delete req.body.revisionNote;
      const doc = await saveEntity(type, req.params.id, { ...req.body }, req.admin, note);
      audit(req, `seo.${type}.update`, type, doc._id);
      ok(res, doc, undefined, 'Saved');
    },
    async remove(req, res) {
      const d = await loadPopulated(type, req.params.id);
      if (!d) throw ApiError.notFound();
      if (type === 'State' && (await City.exists({ state: d._id }))) throw ApiError.conflict('Delete or move the cities in this state first');
      if (type === 'City' && ((await SeoHotel.exists({ city: d._id })) || (await Property.exists({ 'address.city': d._id })))) throw ApiError.conflict('This city has hotels/properties. Remove them first.');
      if (d.status === 'published' && ['SeoHotel', 'Itinerary', 'SeoArticle', 'HotelCategory'].includes(type)) {
        // Keep link equity: redirect removed URL to its parent hub
        const parent = type === 'Itinerary' ? paths.hotel(d.hotel.state, d.hotel.city, d.hotel) : type === 'SeoArticle' ? (d.city ? paths.cityBlog(d.state, d.city) : paths.stateBlog(d.state)) : paths.cityHotels(d.state, d.city);
        await Redirect.findOneAndUpdate({ from: pathFor(type, d) }, { to: parent, code: 301, isActive: true }, { upsert: true });
      }
      if (type === 'SeoHotel') await Itinerary.deleteMany({ hotel: d._id });
      if (type === 'City') await HotelCategory.deleteMany({ city: d._id });
      await Model.deleteOne({ _id: d._id });
      invalidateSitemap();
      audit(req, `seo.${type}.delete`, type, d._id, { name: d.name || d.title });
      ok(res, null, undefined, 'Deleted');
    },
    async status(req, res) {
      const doc = await changeStatus(type, req.params.id, req.body.status, req.admin, { scheduledAt: req.body.scheduledAt, reviewNotes: req.body.reviewNotes });
      audit(req, `seo.${type}.${req.body.scheduledAt ? 'schedule' : req.body.status}`, type, doc._id);
      ok(res, doc, undefined, req.body.scheduledAt ? 'Scheduled' : `Moved to ${doc.status}`);
    },
    async revisions(req, res) {
      ok(res, await Revision.find({ entityType: type, entityId: req.params.id }).sort({ createdAt: -1 }).select('-snapshot').limit(100).lean());
    },
    async duplicate(req, res) {
      const d = await Model.findById(req.params.id).lean();
      if (!d) throw ApiError.notFound();
      const copy = { ...d, status: 'draft', publishedAt: undefined, scheduledAt: undefined };
      delete copy._id;
      const base = d.slug;
      let i = 2;
      while (await Model.exists({ ...(d.city ? { city: d.city } : {}), ...(d.hotel ? { hotel: d.hotel } : {}), slug: `${base}-${i}` })) i++;
      copy.slug = `${base}-${i}`;
      if (copy.name) copy.name = `${copy.name} (copy)`;
      if (copy.title) copy.title = `${copy.title} (copy)`;
      created(res, await saveEntity(type, null, copy, req.admin, `Duplicated from ${base}`));
    },
  };
}

export async function revision(req, res) {
  const r = await Revision.findById(req.params.id).lean();
  if (!r) throw ApiError.notFound();
  ok(res, r);
}
export async function restore(req, res) {
  const doc = await restoreRevision(req.params.id, req.admin);
  audit(req, 'seo.revision.restore', 'Revision', req.params.id);
  ok(res, doc, undefined, 'Revision restored');
}

/** Creates the default listing categories (5-Star, 4-Star, 3-Star, Luxury Resorts…) for a city */
export async function generateCategories(req, res) {
  const city = await City.findById(req.params.cityId).lean();
  if (!city) throw ApiError.notFound();
  const s = await getSettings();
  const out = [];
  for (const [i, t] of (s.seo.hotelCategoryTemplates || []).entries()) {
    if (await HotelCategory.exists({ city: city._id, slug: t.slug })) continue;
    out.push(await saveEntity('HotelCategory', null, { city: city._id, state: city.state, name: t.name, slug: t.slug, starRating: t.starRating, sortOrder: i, content: { h1: `${t.name} in ${city.name}` } }, req.admin, 'Generated from template'));
  }
  created(res, out, `${out.length} categor${out.length === 1 ? 'y' : 'ies'} created`);
}

/** Signed short-lived URL to preview drafts exactly as Google/visitors will see them */
export async function previewLink(req, res) {
  const { type, id } = req.params;
  const d = await loadPopulated(type, id);
  if (!d) throw ApiError.notFound();
  const token = jwt.sign({ preview: true, type, id }, env.jwtSecret, { expiresIn: '1h' });
  const path = pathFor(type, d);
  ok(res, { url: `${path}?preview=${token}`, path, absoluteUrl: absolute(path) });
}

// ─── Redirects ───
export async function redirects(req, res) {
  const filter = req.query.q ? { $or: [{ from: new RegExp(escapeRegex(req.query.q), 'i') }, { to: new RegExp(escapeRegex(req.query.q), 'i') }] } : {};
  ok(res, await Redirect.find(filter).sort({ createdAt: -1 }).limit(500).lean());
}
export async function saveRedirect(req, res) {
  const norm = (p) => (p.startsWith('http') ? p : `/${p.replace(/^\/+/, '').replace(/\/?$/, '/')}`.toLowerCase());
  const body = { from: norm(req.body.from), to: norm(req.body.to), code: req.body.code || 301, isActive: req.body.isActive !== false };
  if (body.from === body.to) throw ApiError.badRequest('Source and target cannot be the same');
  const r = req.params.id ? await Redirect.findByIdAndUpdate(req.params.id, body, { new: true }) : await Redirect.create(body);
  ok(res, r, undefined, 'Redirect saved');
}
export async function deleteRedirect(req, res) {
  await Redirect.deleteOne({ _id: req.params.id });
  ok(res, null);
}

// ─── Media library ───
export async function media(req, res) {
  const { filter, skip, limit, page } = buildListQuery(req.query, { searchFields: ['filename', 'alt', 'title'], filterFields: ['folder'] });
  const [items, total] = await Promise.all([Media.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), Media.countDocuments(filter)]);
  ok(res, items, pageMeta(total, page, limit));
}
export async function uploadMedia(req, res) {
  const files = req.files || [];
  if (!files.length) throw ApiError.badRequest('Choose at least one image');
  const folder = slugify(req.body.folder || 'general').replace(/-+/g, '-') || 'general';
  const docs = await Media.insertMany(
    files.map((f) => ({ url: publicUrlFor(f.path), filename: f.originalname, mimeType: f.mimetype, size: f.size, alt: req.body.alt || '', folder: req.body.folder || folder, uploadedBy: req.admin._id })),
  );
  created(res, docs, `${docs.length} file(s) uploaded`);
}
export async function updateMedia(req, res) {
  ok(res, await Media.findByIdAndUpdate(req.params.id, { alt: req.body.alt, title: req.body.title, folder: req.body.folder }, { new: true }));
}
export async function deleteMedia(req, res) {
  await Media.deleteOne({ _id: req.params.id });
  ok(res, null, undefined, 'Removed from library');
}

// ─── Bulk import ───
export async function importTemplate(_req, res) {
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="lexatrip-hotels-import-template.csv"');
  res.send(templateCsv());
}
export async function importColumns(_req, res) {
  ok(res, IMPORT_COLUMNS);
}
export async function importRun(req, res) {
  if (!req.file) throw ApiError.badRequest('Upload a CSV or XLSX file');
  const out = await importHotels(req.file, { dryRun: req.body.dryRun !== 'false', createMissingLocations: req.body.createMissingLocations === 'true', admin: req.admin });
  if (!out.dryRun) audit(req, 'seo.import', 'SeoHotel', null, { created: out.created, updated: out.updated, failed: out.failed });
  ok(res, out);
}

// ─── Sitemap & Search Console ───
export async function sitemap(_req, res) {
  const [summary, logs] = await Promise.all([sitemapSummary(), SitemapLog.find().sort({ createdAt: -1 }).limit(20).lean()]);
  ok(res, { ...summary, logs, gscConfigured: gscConfigured(), robotsUrl: `${env.siteUrl}/robots.txt` });
}
export async function submitToGoogle(req, res) {
  ok(res, await submitSitemap(req.admin._id));
}
export async function gscSitemaps(_req, res) {
  ok(res, await listSitemaps());
}

// ─── AI SEO writer ───
export async function aiAssist(req, res) {
  ok(res, await seoAssist(req.body));
}

/** Overview numbers for the SEO dashboard */
export async function overview(_req, res) {
  const count = (M, extra = {}) => M.aggregate([{ $match: extra }, { $group: { _id: '$status', n: { $sum: 1 } } }]);
  const [hotels, itineraries, articles, categories, noindex, missingMeta, scheduled] = await Promise.all([
    count(SeoHotel), count(Itinerary), count(SeoArticle), count(HotelCategory),
    SeoHotel.countDocuments({ status: 'published', 'seo.robots.index': false }),
    SeoHotel.countDocuments({ $or: [{ 'seo.title': { $in: [null, ''] } }, { 'seo.metaDescription': { $in: [null, ''] } }] }),
    SeoHotel.countDocuments({ scheduledAt: { $ne: null }, status: { $ne: 'published' } }),
  ]);
  const toObj = (a) => Object.fromEntries(a.map((x) => [x._id, x.n]));
  ok(res, { hotels: toObj(hotels), itineraries: toObj(itineraries), articles: toObj(articles), categories: toObj(categories), issues: { noindex, missingMeta, scheduled } });
}

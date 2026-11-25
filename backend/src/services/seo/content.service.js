import { Revision, Redirect } from '../../models/seo/Revision.js';
import SeoHotel from '../../models/seo/SeoHotel.js';
import Itinerary from '../../models/seo/Itinerary.js';
import SeoArticle from '../../models/seo/SeoArticle.js';
import HotelCategory from '../../models/seo/HotelCategory.js';
import { City, State } from '../../models/Location.js'; // State used in SEO_MODELS
import { cleanHtml } from '../../utils/sanitizeHtml.js';
import { slugify } from '../../utils/helpers.js';
import { ApiError } from '../../utils/ApiError.js';
import { pathFor } from './url.service.js';
import { invalidateSitemap } from './sitemap.service.js';

export const SEO_MODELS = { SeoHotel, Itinerary, SeoArticle, HotelCategory, City, State };

const POPULATE = {
  SeoHotel: [{ path: 'state', select: 'name slug' }, { path: 'city', select: 'name slug' }],
  Itinerary: [{ path: 'hotel', select: 'name slug state city', populate: [{ path: 'state', select: 'name slug' }, { path: 'city', select: 'name slug' }] }],
  SeoArticle: [{ path: 'state', select: 'name slug' }, { path: 'city', select: 'name slug' }],
  HotelCategory: [{ path: 'state', select: 'name slug' }, { path: 'city', select: 'name slug' }],
  City: [{ path: 'state', select: 'name slug' }],
  State: [],
};

export async function loadPopulated(type, id) {
  return SEO_MODELS[type].findById(id).populate(POPULATE[type]).lean();
}

/** Sanitises every rich-text field coming from the editor */
export function sanitizeContent(body) {
  if (body.description !== undefined) body.description = cleanHtml(body.description);
  if (body.content) {
    if (body.content.intro !== undefined) body.content.intro = cleanHtml(body.content.intro);
    body.content.sections = (body.content.sections || []).map((s) => ({ ...s, body: cleanHtml(s.body) }));
  }
  if (body.days) body.days = body.days.map((d) => ({ ...d, description: cleanHtml(d.description) }));
  if (body.faqs) body.faqs = body.faqs.filter((f) => f.question).map((f) => ({ ...f, answer: cleanHtml(f.answer) }));
  if (body.slug) body.slug = slugify(body.slug);
  return body;
}

/**
 * Prevents URL collisions in the shared /hotels/<state>/<city>/<x>/ and /blog/<state>/<x>/ spaces:
 * hotel slugs vs category slugs in a city, and state-level article slugs vs city slugs.
 */
export async function assertSlugFree(type, body, id) {
  const slug = body.slug;
  if (!slug) return;
  if (['SeoHotel', 'HotelCategory'].includes(type) && body.city) {
    const other = type === 'SeoHotel' ? HotelCategory : SeoHotel;
    if (await other.exists({ city: body.city, slug })) throw ApiError.conflict(`"${slug}" is already used by a ${type === 'SeoHotel' ? 'category' : 'hotel'} in this city`);
    if (slug === 'itinerary') throw ApiError.badRequest('"itinerary" is a reserved slug');
  }
  if (type === 'SeoArticle' && !body.city && body.state) {
    if (await City.exists({ state: body.state, slug })) throw ApiError.conflict(`"${slug}" clashes with a city URL in this state`);
  }
  if (type === 'City' && body.state) {
    if (await SeoArticle.exists({ state: body.state, city: null, slug, _id: { $ne: id } })) throw ApiError.conflict(`"${slug}" is used by a state-level article`);
  }
}

export async function snapshot(type, doc, admin, note) {
  await Revision.create({
    entityType: type,
    entityId: doc._id,
    version: doc.version,
    status: doc.status,
    snapshot: doc.toObject ? doc.toObject() : doc,
    note,
    author: admin?._id,
    authorName: admin?.name,
  });
}

/**
 * Saves an SEO entity: sanitise → collision check → bump version → revision snapshot
 * → auto 301 redirect if a published URL changed → sitemap refresh.
 */
export async function saveEntity(type, id, body, admin, note) {
  const Model = SEO_MODELS[type];
  sanitizeContent(body);
  delete body._id;
  delete body.version;
  delete body.createdAt;
  delete body.updatedAt;

  if (!id) {
    if (!body.slug && (body.name || body.title)) body.slug = slugify(body.name || body.title);
    await assertSlugFree(type, body);
    const doc = await Model.create({ ...body, createdBy: admin?._id, updatedBy: admin?._id, publishedAt: body.status === 'published' ? new Date() : undefined });
    await snapshot(type, doc, admin, note || 'Created');
    invalidateSitemap();
    return doc;
  }

  const before = await loadPopulated(type, id);
  if (!before) throw ApiError.notFound();
  await assertSlugFree(type, { ...before, ...body, state: body.state || before.state?._id, city: body.city || before.city?._id }, id);

  const doc = await Model.findById(id);
  doc.set({ ...body, updatedBy: admin?._id });
  if (body.status === 'published' && before.status !== 'published') doc.publishedAt = new Date();
  doc.version = (doc.version || 1) + 1;
  await doc.save();
  await snapshot(type, doc, admin, note);

  if (before.status === 'published') {
    const after = await loadPopulated(type, id);
    const oldPath = pathFor(type, before);
    const newPath = pathFor(type, after);
    if (oldPath !== newPath) {
      await Redirect.findOneAndUpdate({ from: oldPath }, { to: newPath, code: 301, isActive: true }, { upsert: true });
      await Redirect.deleteMany({ from: newPath }); // never redirect away from a live URL
    }
  }
  invalidateSitemap();
  return doc;
}

const TRANSITIONS = {
  draft: ['review', 'published', 'archived'],
  review: ['draft', 'published', 'archived'],
  published: ['draft', 'archived', 'review'],
  archived: ['draft'],
};

export async function changeStatus(type, id, status, admin, { scheduledAt, reviewNotes } = {}) {
  const doc = await SEO_MODELS[type].findById(id);
  if (!doc) throw ApiError.notFound();
  if (scheduledAt) {
    doc.scheduledAt = new Date(scheduledAt);
    if (doc.status === 'draft') doc.status = 'review';
  } else {
    if (doc.status !== status && !TRANSITIONS[doc.status]?.includes(status)) throw ApiError.badRequest(`Cannot move from ${doc.status} to ${status}`);
    doc.status = status;
    if (status === 'published') {
      doc.publishedAt = doc.publishedAt || new Date();
      doc.scheduledAt = undefined;
    }
  }
  if (reviewNotes !== undefined) doc.reviewNotes = reviewNotes;
  doc.updatedBy = admin?._id;
  doc.version += 1;
  await doc.save();
  await snapshot(type, doc, admin, scheduledAt ? `Scheduled for ${new Date(scheduledAt).toISOString()}` : `Status → ${status}`);
  invalidateSitemap();
  return doc;
}

/** Scheduler hook: publishes entities whose scheduledAt has passed. */
export async function publishScheduled() {
  let count = 0;
  for (const [type, Model] of Object.entries({ SeoHotel, Itinerary, SeoArticle, HotelCategory })) {
    const due = await Model.find({ scheduledAt: { $lte: new Date() }, status: { $in: ['draft', 'review'] } });
    for (const doc of due) {
      doc.status = 'published';
      doc.publishedAt = new Date();
      doc.scheduledAt = undefined;
      doc.version += 1;
      await doc.save();
      await snapshot(type, doc, null, 'Auto-published (schedule)');
      count++;
    }
  }
  if (count) invalidateSitemap();
  return count;
}

export async function restoreRevision(revisionId, admin) {
  const rev = await Revision.findById(revisionId).lean();
  if (!rev) throw ApiError.notFound('Revision not found');
  const data = { ...rev.snapshot };
  for (const k of ['_id', '__v', 'createdAt', 'updatedAt', 'version', 'createdBy']) delete data[k];
  return saveEntity(rev.entityType, rev.entityId, data, admin, `Restored v${rev.version}`);
}

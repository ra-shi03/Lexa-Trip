import CatalogRequest, { REQUEST_KINDS } from '../models/CatalogRequest.js';
import { Amenity } from '../models/Catalog.js';
import Property from '../models/Property.js';
import { BASE_QUICK_ADD } from '../constants/quickAdd.js';
import { ApiError } from '../utils/ApiError.js';
import { escapeRegex, slugify } from '../utils/helpers.js';
import { buildListQuery, pageMeta } from '../utils/queryBuilder.js';
import { notify } from './notification/notification.service.js';

const LABEL = { tag: 'search tag', house_rule: 'house rule', amenity: 'amenity', room_feature: 'room feature' };
const exact = (name) => new RegExp(`^${escapeRegex(name)}$`, 'i');
const isAmenity = (kind) => kind === 'amenity' || kind === 'room_feature';
const amenityScope = (kind) => (kind === 'amenity' ? 'property' : 'room');

/** Built-in + approved quick-add values for tags and house rules. */
async function quickAdd(kind) {
  const approved = await CatalogRequest.find({ status: 'approved', kind }).distinct('name');
  return [...new Set([...BASE_QUICK_ADD[kind], ...approved])];
}

/** Everything the property editor can offer. */
export async function editorOptions() {
  const [tags, houseRules, amenities] = await Promise.all([
    quickAdd('tag'),
    quickAdd('house_rule'),
    Amenity.find({ isActive: true }).sort({ name: 1 }).lean(),
  ]);
  return { tags, houseRules, amenities };
}

/** Vendor property writes may only contain approved tags / rules (values already saved on the property stay). */
export async function keepApproved(body, current) {
  for (const [field, kind] of [['tags', 'tag'], ['houseRules', 'house_rule']]) {
    if (!Array.isArray(body[field])) continue;
    const allowed = new Set([...(await quickAdd(kind)), ...(current?.[field] || [])]);
    body[field] = body[field].filter((v) => allowed.has(v));
  }
}

export async function createRequest(vendor, { kind, name, property }) {
  const clean = String(name || '').replace(/\s+/g, ' ').trim();
  if (!REQUEST_KINDS.includes(kind)) throw ApiError.badRequest('Unknown request type');
  if (clean.length < 2 || clean.length > (kind === 'house_rule' ? 120 : 40)) throw ApiError.badRequest(`Enter 2–${kind === 'house_rule' ? 120 : 40} characters`);
  const available = isAmenity(kind)
    ? await Amenity.exists({ name: exact(clean), isActive: true, scope: { $in: [null, 'all', amenityScope(kind)] } })
    : (await quickAdd(kind)).some((x) => x.toLowerCase() === clean.toLowerCase());
  if (available) throw ApiError.conflict(`“${clean}” is already available — just select it`);
  if (await CatalogRequest.exists({ vendor: vendor._id, kind, name: exact(clean), status: 'pending' })) throw ApiError.conflict('You have already requested this — it is waiting for approval');
  if (await CatalogRequest.countDocuments({ vendor: vendor._id, status: 'pending' }) >= 30) throw ApiError.badRequest('You have 30 requests waiting. Please wait for a decision first.');
  const owned = property && (await Property.exists({ _id: String(property), vendor: vendor._id }));
  const doc = await CatalogRequest.create({ kind, name: clean, vendor: vendor._id, property: owned ? property : undefined });
  await notify({ recipientType: 'admin', title: 'New vendor request', body: `${vendor.businessName} asked for a ${LABEL[kind]}: “${clean}”`, type: 'catalog_request', data: { requestId: doc._id } });
  return doc;
}

export const vendorRequests = (vendorId) => CatalogRequest.find({ vendor: vendorId }).sort({ createdAt: -1 }).limit(100).lean();

export async function adminRequests(query) {
  const { filter, skip, limit, page, sort } = buildListQuery(query, { searchFields: ['name'], filterFields: ['status', 'kind'] });
  const [items, total, pending] = await Promise.all([
    CatalogRequest.find(filter).sort(sort).skip(skip).limit(limit).populate('vendor', 'businessName email').populate('property', 'name').lean(),
    CatalogRequest.countDocuments(filter),
    CatalogRequest.countDocuments({ status: 'pending' }),
  ]);
  return { items, meta: { ...pageMeta(total, page, limit), pending } };
}

export async function decideRequest(id, { action, note }, adminId) {
  if (!['approve', 'reject'].includes(action)) throw ApiError.badRequest('Choose approve or reject');
  const reason = String(note || '').trim().slice(0, 500);
  if (action === 'reject' && !reason) throw ApiError.badRequest('Add a note telling the vendor why it was rejected');
  // atomic claim so two reviewers can't both decide
  const doc = await CatalogRequest.findOneAndUpdate(
    { _id: id, status: 'pending' },
    { status: action === 'approve' ? 'approved' : 'rejected', note: reason, reviewedBy: adminId, reviewedAt: new Date() },
    { new: true },
  );
  if (!doc) throw ApiError.conflict('This request was already decided');
  if (action === 'approve' && isAmenity(doc.kind)) {
    const scope = amenityScope(doc.kind);
    const existing = await Amenity.findOne({ $or: [{ name: exact(doc.name) }, { slug: slugify(doc.name) }] });
    if (existing) {
      if (existing.scope && existing.scope !== scope) existing.scope = 'all';
      existing.isActive = true;
      await existing.save();
    } else {
      await Amenity.create({ name: doc.name, slug: slugify(doc.name), icon: 'check', scope, isFilterable: scope === 'property', group: scope === 'room' ? 'room' : 'general' });
    }
  }
  await notify({
    recipientType: 'vendor', recipient: doc.vendor, type: 'catalog_request',
    title: `Request ${doc.status}: ${doc.name}`,
    body: reason || (doc.status === 'approved' ? `Your ${LABEL[doc.kind]} is now available in the property editor.` : ''),
  });
  return doc;
}

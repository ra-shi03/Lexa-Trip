import Deal from '../models/Deal.js';
import Property from '../models/Property.js';
import RoomType from '../models/RoomType.js';
import { ApiError } from '../utils/ApiError.js';
import { toDay, addDays, round2 } from '../utils/helpers.js';

import { today } from '../utils/clock.js';
/**
 * Vendor deals ("Deals of the day"): limited-time discounts applied by the pricing engine.
 * Every price shown or charged goes through `applyDealsToNights`, called from pricing.service#nightlyRates,
 * so search cards, the room list, checkout and the booking all agree.
 */
export const DEAL_LIMITS = { minPercent: 5, maxPercent: 70, minAmount: 50, maxWindowDays: 30, maxStartAheadDays: 90 };


/** live = running today · scheduled = starts later · ended · paused */
export function dealStatus(d, now = today()) {
  if (toDay(d.endDate) < now) return 'ended';
  if (!d.isActive) return 'paused';
  if (toDay(d.startDate) > now) return 'scheduled';
  return 'live';
}

export const dealLabel = (d) => (d.discountType === 'percent' ? `${d.value}% off` : `₹${d.value} off`);

/** Discounted amount for one night (never below 0, never more than the price itself). */
export function discounted(price, d) {
  const off = d.discountType === 'percent' ? (price * d.value) / 100 : d.value;
  return round2(Math.max(0, price - Math.min(off, price)));
}

/** Active deals of a property touching any night in [from, to). */
export function dealsFor(propertyId, from, to) {
  return Deal.find({ property: propertyId, isActive: true, endDate: { $gte: toDay(from) }, startDate: { $lt: toDay(to) } }).lean();
}

/** Same as dealsFor, for a whole results page in one query. */
export function dealsForMany(propertyIds, from, to) {
  return Deal.find({ property: { $in: propertyIds }, isActive: true, endDate: { $gte: toDay(from) }, startDate: { $lt: toDay(to) } }).lean();
}

const covers = (d, roomTypeId, date) =>
  toDay(d.startDate) <= date && toDay(d.endDate) >= date && (!d.roomTypes?.length || d.roomTypes.some((r) => String(r) === String(roomTypeId)));

/**
 * nightly [{ date, amount }] → [{ date, amount, original?, dealId? }]. When several deals cover a night
 * the guest gets the bigger saving.
 */
export function applyDealsToNights(nightly, roomTypeId, deals) {
  if (!deals?.length) return nightly;
  return nightly.map((n) => {
    let best = null;
    for (const d of deals) {
      if (!covers(d, roomTypeId, toDay(n.date))) continue;
      const amount = discounted(n.amount, d);
      if (!best || amount < best.amount) best = { amount, d };
    }
    return best && best.amount < n.amount ? { ...n, amount: best.amount, original: n.amount, dealId: best.d._id } : n;
  });
}

/** Public shape of a deal for cards / banners (no internal ids beyond _id). */
export const publicDeal = (d) => d && ({
  _id: d._id, title: d.title || dealLabel(d), label: dealLabel(d), discountType: d.discountType, value: d.value,
  startDate: d.startDate, endDate: d.endDate, allRooms: !d.roomTypes?.length,
});

/** Property ids with at least one deal live today → the "Deals of the day" collection. */
export async function liveDealPropertyIds() {
  const t = today();
  return Deal.distinct('property', { isActive: true, startDate: { $lte: t }, endDate: { $gte: t } });
}

/** Best live-today deal per property (for search cards / the property page). */
export async function liveDealsByProperty(propertyIds) {
  const t = today();
  const list = await Deal.find({ property: { $in: propertyIds }, isActive: true, startDate: { $lte: t }, endDate: { $gte: t } }).lean();
  const best = {};
  for (const d of list) {
    const k = String(d.property);
    // percent deals compare by value; amount deals are ranked after a percent deal of the same "size" — good enough for a badge
    if (!best[k] || (d.discountType === best[k].discountType ? d.value > best[k].value : d.discountType === 'percent')) best[k] = d;
  }
  return best;
}

/**
 * Validates + normalises a deal payload. `property` must already be the caller's (vendor scope checked by the caller).
 * Rules: discount within limits · start today or later (≤ 90 days ahead) · window ≤ 30 nights ·
 * room types belong to the property · no overlap with another active deal on the same rooms.
 */
export async function prepareDeal(input, property, { existingId } = {}) {
  if (property.status !== 'approved') throw ApiError.badRequest('Deals can run only on approved, live properties');
  const discountType = input.discountType === 'amount' ? 'amount' : 'percent';
  const value = Number(input.value);
  if (discountType === 'percent' && !(value >= DEAL_LIMITS.minPercent && value <= DEAL_LIMITS.maxPercent)) throw ApiError.badRequest(`Discount must be ${DEAL_LIMITS.minPercent}–${DEAL_LIMITS.maxPercent}%`);
  if (discountType === 'amount' && !(value >= DEAL_LIMITS.minAmount)) throw ApiError.badRequest(`Flat discount must be at least ₹${DEAL_LIMITS.minAmount}`);

  const startDate = toDay(input.startDate || new Date());
  const endDate = toDay(input.endDate || startDate);
  if (Number.isNaN(+startDate) || Number.isNaN(+endDate)) throw ApiError.badRequest('Choose valid dates');
  if (!existingId && startDate < today()) throw ApiError.badRequest('A deal can’t start in the past');
  if (endDate < startDate) throw ApiError.badRequest('End date must be on or after the start date');
  if (endDate < today()) throw ApiError.badRequest('This date range has already ended');
  if (startDate > addDays(today(), DEAL_LIMITS.maxStartAheadDays)) throw ApiError.badRequest(`Deals can be scheduled up to ${DEAL_LIMITS.maxStartAheadDays} days ahead`);
  if ((endDate - startDate) / 86400000 + 1 > DEAL_LIMITS.maxWindowDays) throw ApiError.badRequest(`A deal can run for at most ${DEAL_LIMITS.maxWindowDays} days`);

  const roomTypes = [...new Set((input.roomTypes || []).map(String))];
  if (roomTypes.length) {
    const n = await RoomType.countDocuments({ _id: { $in: roomTypes }, property: property._id });
    if (n !== roomTypes.length) throw ApiError.badRequest('Some selected rooms don’t belong to this property');
  }
  if (discountType === 'amount') {
    const cheapest = await RoomType.findOne(roomTypes.length ? { _id: { $in: roomTypes } } : { property: property._id, isActive: true }).sort({ basePrice: 1 }).select('basePrice').lean();
    if (cheapest && value >= cheapest.basePrice) throw ApiError.badRequest(`Flat discount must be lower than the room price (₹${cheapest.basePrice})`);
  }

  const isActive = input.isActive !== false;
  if (isActive) {
    const clash = await Deal.findOne({
      property: property._id, isActive: true, _id: { $ne: existingId },
      startDate: { $lte: endDate }, endDate: { $gte: startDate },
      ...(roomTypes.length ? { $or: [{ roomTypes: { $size: 0 } }, { roomTypes: { $in: roomTypes } }] } : {}),
    }).lean();
    if (clash) throw ApiError.conflict(`Overlaps “${clash.title || dealLabel(clash)}” (${clash.startDate.toISOString().slice(0, 10)} → ${clash.endDate.toISOString().slice(0, 10)}). Pause or edit that deal first.`);
  }

  return {
    property: property._id, vendor: property.vendor, roomTypes, discountType, value, startDate, endDate, isActive,
    title: String(input.title || '').trim().slice(0, 60) || undefined,
  };
}

/** Deals page rows: deal + property name/photo + room names + derived status. */
export async function dealRows(filter) {
  const deals = await Deal.find(filter).sort({ endDate: -1, startDate: -1 }).limit(300).lean();
  const props = await Property.find({ _id: { $in: [...new Set(deals.map((d) => String(d.property)))] } }).select('name slug images minPrice address.city').populate('address.city', 'name').lean();
  const rooms = await RoomType.find({ property: { $in: props.map((p) => p._id) } }).select('name basePrice property').lean();
  const pMap = Object.fromEntries(props.map((p) => [String(p._id), p]));
  const rMap = Object.fromEntries(rooms.map((r) => [String(r._id), r]));
  return deals.map((d) => {
    const p = pMap[String(d.property)];
    return {
      ...d,
      status: dealStatus(d),
      label: dealLabel(d),
      property: p ? { _id: p._id, name: p.name, slug: p.slug, image: p.images?.[0]?.url, city: p.address?.city?.name, minPrice: p.minPrice } : { _id: d.property, name: 'Removed property' },
      roomTypes: (d.roomTypes || []).map((id) => rMap[String(id)]).filter(Boolean).map((r) => ({ _id: r._id, name: r.name, basePrice: r.basePrice })),
    };
  });
}

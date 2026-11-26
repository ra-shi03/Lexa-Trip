import Property from '../models/Property.js';
import RoomType from '../models/RoomType.js';
import { City } from '../models/Location.js';
import { Category, Amenity } from '../models/Catalog.js';
import { PricingRule } from '../models/Inventory.js';
import { getAvailability } from './inventory.service.js';
import { nightlyRates } from './pricing.service.js';
import { dealsForMany, liveDealPropertyIds, liveDealsByProperty, publicDeal } from './deal.service.js';
import { escapeRegex, addDays, toDay, round2 } from '../utils/helpers.js';
import { pageMeta } from '../utils/queryBuilder.js';

import { today, daysFromToday } from '../utils/clock.js';
const SORTS = {
  recommended: { isFeatured: -1, 'rating.avg': -1, minPrice: 1 },
  price_asc: { minPrice: 1 },
  price_desc: { minPrice: -1 },
  rating: { 'rating.avg': -1, 'rating.count': -1 },
  popularity: { 'rating.count': -1 },
  stars: { starRating: -1 },
};

/** Resolves a free-text place ("udaipur", "lake city", "goa") to a City id. */
export async function resolveCity(text) {
  if (!text) return null;
  const rx = new RegExp(`^${escapeRegex(String(text).trim())}`, 'i');
  return City.findOne({ isActive: true, $or: [{ name: rx }, { slug: rx }, { aliases: rx }] }).populate('state', 'name slug').lean();
}

/**
 * Stay search used by web, app and the AI assistant.
 * Filters run in MongoDB; exact date pricing + availability is computed for the returned page.
 */
export async function searchProperties(params) {
  const {
    city, cityId, q, checkIn, checkOut, adults = 2, children = 0, rooms = 1,
    category, minPrice, maxPrice, amenities, rating, stars, sort = 'recommended',
    page = 1, limit = 12, onlyAvailable = false, featured, deals,
  } = params;

  const filter = { status: 'approved', isVisible: true };
  let resolvedCity = null;
  if (cityId) filter['address.city'] = cityId;
  else if (city) {
    resolvedCity = await resolveCity(city);
    if (resolvedCity) filter['address.city'] = resolvedCity._id;
    else filter.$or = [{ name: new RegExp(escapeRegex(city), 'i') }, { 'address.area': new RegExp(escapeRegex(city), 'i') }];
  }
  if (q) filter.name = new RegExp(escapeRegex(q), 'i');
  // `deals=today` or a category of kind "deals" (e.g. "Deals of the day") → stays with a vendor deal live today
  let dealsMode = deals === 'today' || deals === 'true';
  if (category) {
    const slugs = String(category).split(',');
    const cats = await Category.find({ slug: { $in: slugs } }).select('_id kind').lean();
    if (cats.some((c) => c.kind === 'deals')) dealsMode = true;
    const types = cats.filter((c) => c.kind !== 'deals');
    if (types.length || !dealsMode) filter.category = { $in: types.map((c) => c._id) };
  }
  if (dealsMode) filter._id = { $in: await liveDealPropertyIds() };
  if (amenities) {
    const slugs = String(amenities).split(',');
    const ams = await Amenity.find({ slug: { $in: slugs } }).select('_id').lean();
    if (ams.length) filter.amenities = { $all: ams.map((a) => a._id) };
  }
  if (minPrice || maxPrice) {
    filter.minPrice = {};
    if (minPrice) filter.minPrice.$gte = Number(minPrice);
    if (maxPrice) filter.minPrice.$lte = Number(maxPrice);
  }
  if (rating) filter['rating.avg'] = { $gte: Number(rating) };
  if (stars) filter.starRating = { $in: String(stars).split(',').map(Number) };
  if (featured) filter.isFeatured = true;

  const pg = Math.max(1, Number(page));
  const lim = Math.min(50, Number(limit) || 12);
  const [items, total, priceStats] = await Promise.all([
    Property.find(filter)
      .sort(SORTS[sort] || SORTS.recommended)
      .skip((pg - 1) * lim)
      .limit(lim)
      .populate('category', 'name slug icon')
      .populate('address.city', 'name slug')
      .populate('amenities', 'name slug icon')
      .lean(),
    Property.countDocuments(filter),
    Property.aggregate([{ $match: filter }, { $group: { _id: null, min: { $min: '$minPrice' }, max: { $max: '$minPrice' }, avg: { $avg: '$minPrice' } } }]),
  ]);

  // Deals of the day are tonight's offers → default the stay to tonight (other searches default to tomorrow)
  const ci = checkIn ? toDay(checkIn) : dealsMode ? today() : daysFromToday(1);
  const co = checkOut ? toDay(checkOut) : addDays(ci, 1);
  const nights = Math.max(1, Math.round((co - ci) / 86400000));

  // Load everything the page needs in a few batched queries (not several per property)
  const ids = items.map((p) => p._id);
  const [liveDeals, roomTypes, stayDealsAll, rules] = await Promise.all([
    liveDealsByProperty(ids), // badge: the property's deal running today
    RoomType.find({ property: { $in: ids }, isActive: true, maxOccupancy: { $gte: Math.ceil((Number(adults) + Number(children)) / Number(rooms)) } }).lean(),
    dealsForMany(ids, ci, co),
    PricingRule.find({ property: { $in: ids }, isActive: true }).sort({ priority: -1 }).lean(),
  ]);
  const availability = roomTypes.length ? await getAvailability(roomTypes, ci, co) : {};
  const results = await Promise.all(
    items.map(async (p) => {
      const rts = roomTypes.filter((r) => String(r.property) === String(p._id));
      const deal = publicDeal(liveDeals[String(p._id)]);
      if (!rts.length) return { ...p, available: false, nightlyFrom: p.minPrice, roomsLeft: 0, deal };
      const stayDeals = stayDealsAll.filter((d) => String(d.property) === String(p._id));
      let best = null;
      for (const rt of rts) {
        const a = availability[String(rt._id)];
        if (a.minAvailable < Number(rooms)) continue;
        const nightly = await nightlyRates(rt, ci, co, a.nights, stayDeals, rules);
        const avg = nightly.reduce((s, n) => s + n.amount, 0) / nightly.length;
        const avgOriginal = nightly.reduce((s, n) => s + (n.original ?? n.amount), 0) / nightly.length;
        if (!best || avg < best.avg) best = { avg, avgOriginal, roomType: rt.name, left: a.minAvailable, refundable: rt.ratePlans?.some((r) => r.refundable), breakfast: rt.ratePlans?.some((r) => r.mealPlan !== 'EP') };
      }
      return {
        _id: p._id,
        name: p.name,
        slug: p.slug,
        category: p.category,
        city: p.address?.city,
        area: p.address?.area,
        starRating: p.starRating,
        rating: p.rating,
        images: p.images?.slice(0, 5),
        amenities: p.amenities?.slice(0, 6),
        shortDescription: p.shortDescription,
        geo: p.geo,
        isFeatured: p.isFeatured,
        cancellationType: p.cancellationPolicy?.type,
        available: Boolean(best),
        nightlyFrom: best ? round2(best.avg) : p.minPrice,
        // pre-deal price for the strike-through; only when the deal actually covers the searched nights
        nightlyOriginal: best && best.avgOriginal > best.avg + 0.5 ? round2(best.avgOriginal) : undefined,
        deal,
        totalFrom: best ? round2(best.avg * nights * Number(rooms)) : null,
        cheapestRoom: best?.roomType,
        roomsLeft: best?.left ?? 0,
        refundable: best?.refundable,
        breakfastAvailable: best?.breakfast,
      };
    }),
  );

  const list = onlyAvailable ? results.filter((r) => r.available) : results;
  return {
    items: list,
    meta: {
      ...pageMeta(total, pg, lim),
      nights,
      checkIn: ci,
      checkOut: co,
      deals: dealsMode || undefined,
      city: resolvedCity ? { _id: resolvedCity._id, name: resolvedCity.name, slug: resolvedCity.slug, state: resolvedCity.state } : null,
      priceStats: priceStats[0] ? { min: priceStats[0].min, max: priceStats[0].max, avg: Math.round(priceStats[0].avg) } : null,
    },
  };
}

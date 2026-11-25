import Property from '../models/Property.js';
import RoomType from '../models/RoomType.js';
import { City } from '../models/Location.js';
import { Category, Amenity } from '../models/Catalog.js';
import { getAvailability } from './inventory.service.js';
import { nightlyRates } from './pricing.service.js';
import { escapeRegex, addDays, toDay, round2 } from '../utils/helpers.js';
import { pageMeta } from '../utils/queryBuilder.js';

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
    page = 1, limit = 12, onlyAvailable = false, featured,
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
  if (category) {
    const slugs = String(category).split(',');
    const cats = await Category.find({ slug: { $in: slugs } }).select('_id').lean();
    filter.category = { $in: cats.map((c) => c._id) };
  }
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

  const ci = checkIn ? toDay(checkIn) : addDays(new Date(), 1);
  const co = checkOut ? toDay(checkOut) : addDays(ci, 1);
  const nights = Math.max(1, Math.round((co - ci) / 86400000));

  const results = await Promise.all(
    items.map(async (p) => {
      const rts = await RoomType.find({ property: p._id, isActive: true, maxOccupancy: { $gte: Math.ceil((Number(adults) + Number(children)) / Number(rooms)) } }).lean();
      if (!rts.length) return { ...p, available: false, nightlyFrom: p.minPrice, roomsLeft: 0 };
      const avail = await getAvailability(rts, ci, co);
      let best = null;
      for (const rt of rts) {
        const a = avail[String(rt._id)];
        if (a.minAvailable < Number(rooms)) continue;
        const nightly = await nightlyRates(rt, ci, co, a.nights);
        const avg = nightly.reduce((s, n) => s + n.amount, 0) / nightly.length;
        if (!best || avg < best.avg) best = { avg, roomType: rt.name, left: a.minAvailable, refundable: rt.ratePlans?.some((r) => r.refundable), breakfast: rt.ratePlans?.some((r) => r.mealPlan !== 'EP') };
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
      city: resolvedCity ? { _id: resolvedCity._id, name: resolvedCity.name, slug: resolvedCity.slug, state: resolvedCity.state } : null,
      priceStats: priceStats[0] ? { min: priceStats[0].min, max: priceStats[0].max, avg: Math.round(priceStats[0].avg) } : null,
    },
  };
}

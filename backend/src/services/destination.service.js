import { City } from '../models/Location.js';
import { getSettings } from './settings.service.js';
import { ApiError } from '../utils/ApiError.js';

export const MAX_POPULAR = 12;

/**
 * Cities shown as "Popular destinations" (home screens + search autocomplete), in the admin's order.
 * The curated list lives in settings.popularDestinations; until someone saves it, cities flagged isPopular are used.
 * A card photo set there overrides the city photo on these cards only.
 */
export async function popularCities() {
  const { popularDestinations: cfg } = await getSettings();
  const populate = { path: 'state', select: 'name slug' };
  if (!Array.isArray(cfg.items)) return City.find({ isActive: true, isPopular: true }).sort({ sortOrder: 1 }).limit(MAX_POPULAR).populate(populate).lean();
  const found = await City.find({ _id: { $in: cfg.items.map((i) => i.city) }, isActive: true }).populate(populate).lean();
  const byId = new Map(found.map((c) => [String(c._id), c]));
  return cfg.items.flatMap((i) => {
    const city = byId.get(String(i.city)); // deleted / deactivated cities simply drop out
    return city ? [{ ...city, image: i.image || city.image }] : [];
  });
}

/** Validates the admin payload before it is stored */
export function cleanPopularSettings(body = {}) {
  const text = (v, max) => String(v || '').trim().slice(0, max);
  if (!Array.isArray(body.items)) throw ApiError.badRequest('Send the list of destinations');
  const seen = new Set();
  const items = body.items.flatMap((i) => {
    const city = String(i?.city || '');
    if (!/^[a-f0-9]{24}$/i.test(city)) throw ApiError.badRequest('Unknown destination in the list');
    if (seen.has(city)) return [];
    seen.add(city);
    return [{ city, image: text(i.image, 500) }];
  });
  if (items.length > MAX_POPULAR) throw ApiError.badRequest(`You can feature up to ${MAX_POPULAR} destinations`);
  return { enabled: body.enabled !== false, title: text(body.title, 40) || 'Popular destinations', subtitle: text(body.subtitle, 80), items };
}

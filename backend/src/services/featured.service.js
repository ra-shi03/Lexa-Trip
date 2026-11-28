import Property from '../models/Property.js';
import { getSettings } from './settings.service.js';
import { searchProperties } from './search.service.js';
import { ApiError } from '../utils/ApiError.js';

export const MAX_FEATURED = 12; // cards shown on home
const LOAD = 50;

/**
 * "Handpicked stays" on the app + website home.
 * Membership is the property's `isFeatured` flag (also set by Feature/Unfeature on the Properties page);
 * settings.featuredStays.order holds the order chosen on Admin → Handpicked stays. Newly flagged stays go last.
 */
export async function featuredStays() {
  const [{ featuredStays: cfg }, { items }] = await Promise.all([getSettings(), searchProperties({ featured: true, limit: LOAD })]);
  const order = (cfg.order || []).map(String);
  const rank = (p) => { const i = order.indexOf(String(p._id)); return i < 0 ? order.length : i; };
  return [...items].sort((a, b) => rank(a) - rank(b)).slice(0, MAX_FEATURED);
}

/** Saves the admin page: sets the featured flags to match the list and returns the settings value to store. */
export async function saveFeaturedStays(body = {}) {
  const text = (v, max) => String(v || '').trim().slice(0, max);
  if (!Array.isArray(body.items)) throw ApiError.badRequest('Send the list of stays');
  const ids = [...new Set(body.items.map(String))];
  if (ids.some((i) => !/^[a-f0-9]{24}$/i.test(i))) throw ApiError.badRequest('Unknown property in the list');
  if (ids.length > LOAD) throw ApiError.badRequest(`Choose up to ${MAX_FEATURED} stays`);
  const found = await Property.find({ _id: { $in: ids } }).select('status isFeatured').lean();
  if (found.length !== ids.length) throw ApiError.badRequest('A property in the list no longer exists — reload the page');
  if (found.some((p) => !p.isFeatured && p.status !== 'approved')) throw ApiError.badRequest('Only approved properties can be added');

  await Promise.all([
    Property.updateMany({ _id: { $in: ids } }, { isFeatured: true }),
    Property.updateMany({ _id: { $nin: ids }, isFeatured: true }, { isFeatured: false }),
  ]);
  return { enabled: body.enabled !== false, title: text(body.title, 40) || 'Handpicked stays', subtitle: text(body.subtitle, 80), order: ids };
}

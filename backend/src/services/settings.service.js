import Setting from '../models/Setting.js';
import { DEFAULT_SETTINGS } from '../constants/defaultSettings.js';

const SECTIONS = ['brand', 'theme', 'features', 'homeSections', 'home', 'app', 'auth', 'booking', 'tax', 'commission', 'social', 'seo', 'integrations'];
let cache = null;
let cachedAt = 0;
const TTL = 30_000;

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
function deepMerge(base, over) {
  if (!isObj(base) || !isObj(over)) return over === undefined ? base : over;
  const out = { ...base };
  for (const [k, v] of Object.entries(over)) out[k] = isObj(v) && isObj(base[k]) ? deepMerge(base[k], v) : v;
  return out;
}

export async function getSettings({ fresh = false } = {}) {
  if (!fresh && cache && Date.now() - cachedAt < TTL) return cache;
  const doc = (await Setting.findOne({ key: 'global' }).lean()) || {};
  const merged = {};
  for (const s of SECTIONS) merged[s] = deepMerge(DEFAULT_SETTINGS[s], doc[s] ?? undefined);
  merged.updatedAt = doc.updatedAt;
  cache = merged;
  cachedAt = Date.now();
  return merged;
}

export async function updateSettingsSection(section, value, adminId) {
  if (!SECTIONS.includes(section)) throw new Error(`Unknown settings section: ${section}`);
  await Setting.findOneAndUpdate(
    { key: 'global' },
    { $set: { [section]: value, updatedBy: adminId } },
    { upsert: true, new: true },
  );
  cache = null;
  return getSettings({ fresh: true });
}

/** What the public web/app clients are allowed to see (no integration internals). */
export async function getPublicSettings() {
  const s = await getSettings();
  return {
    brand: s.brand,
    theme: s.theme,
    features: s.features,
    homeSections: s.homeSections,
    home: s.home,
    app: s.app,
    auth: s.auth,
    booking: { currency: s.booking.currency, maxRoomsPerBooking: s.booking.maxRoomsPerBooking, maxNights: s.booking.maxNights },
    social: s.social,
    seo: { siteName: s.seo.siteName, defaultTitle: s.seo.defaultTitle, defaultDescription: s.seo.defaultDescription, titleSuffix: s.seo.titleSuffix },
    ai: { assistantName: s.integrations.ai?.assistantName || 'Lexa AI' },
    payment: { methods: s.integrations.payment?.enabledMethods || [] },
    updatedAt: s.updatedAt,
  };
}

export const SETTINGS_SECTIONS = SECTIONS;

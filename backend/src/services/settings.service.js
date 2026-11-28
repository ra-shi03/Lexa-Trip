import Setting from '../models/Setting.js';
import { DEFAULT_SETTINGS } from '../constants/defaultSettings.js';
import { publish, onLive } from './live.service.js';
import { setPlatformTimezone, platformTimezone, offsetLabel } from '../utils/clock.js';

const SECTIONS = ['brand', 'theme', 'features', 'homeSections', 'home', 'popularDestinations', 'featuredStays', 'app', 'auth', 'regional', 'storage', 'booking', 'tax', 'commission', 'social', 'seo', 'integrations'];
let cache = null;
let cachedAt = 0;
const TTL = 30_000;
// Any process (cluster worker) drops its cache as soon as settings change anywhere, before clients re-fetch
// …and reloads so the platform clock (timezone) switches on every worker too
onLive((e) => { if (e.topic === 'settings') { cache = null; getSettings().catch(() => {}); } });

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
  setPlatformTimezone(merged.regional?.timezone);
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
  const fresh = await getSettings({ fresh: true });
  publish('settings', { scope: section });
  return fresh;
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
    popularDestinations: { enabled: s.popularDestinations.enabled, title: s.popularDestinations.title, subtitle: s.popularDestinations.subtitle },
    featuredStays: { enabled: s.featuredStays.enabled, title: s.featuredStays.title, subtitle: s.featuredStays.subtitle },
    app: s.app,
    auth: s.auth,
    regional: { timezone: platformTimezone(), offset: offsetLabel() },
    booking: { currency: s.booking.currency, maxRoomsPerBooking: s.booking.maxRoomsPerBooking, maxNights: s.booking.maxNights },
    social: s.social,
    seo: { siteName: s.seo.siteName, defaultTitle: s.seo.defaultTitle, defaultDescription: s.seo.defaultDescription, titleSuffix: s.seo.titleSuffix },
    ai: { assistantName: s.integrations.ai?.assistantName || 'Lexa AI' },
    payment: { methods: s.integrations.payment?.enabledMethods || [] },
    updatedAt: s.updatedAt,
  };
}

export const SETTINGS_SECTIONS = SECTIONS;

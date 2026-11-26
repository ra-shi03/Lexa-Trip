const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const inr2 = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });

export const money = (n, precise = false) => (n === null || n === undefined || Number.isNaN(Number(n)) ? '—' : (precise ? inr2 : inr).format(Number(n)));
export const num = (n) => new Intl.NumberFormat('en-IN').format(Number(n || 0));

/* ── Dates & time ───────────────────────────────────────────────────────────────────────────────────────
 * One platform timezone (Admin → Settings → Region & time) for every app and panel — not the viewer's device.
 * SettingsContext calls setPlatformTimezone() as soon as settings load (and live when the admin changes it).
 * Two kinds of values come from the API:
 *   • calendar days  — stay dates, inventory nights, deal dates: stored as UTC midnight ("2026-11-26T00:00:00Z")
 *                      or "YYYY-MM-DD". They are a day, not an instant → formatted in UTC, never shifted.
 *   • timestamps     — createdAt, paidAt, bus/flight departures → shown in the platform timezone.
 */
let TZ = 'Asia/Kolkata';
let partsFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
export function setPlatformTimezone(zone) {
  if (!zone || zone === TZ) return;
  try {
    partsFmt = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    TZ = zone;
  } catch { /* invalid zone from the server — keep the previous one */ }
}
export const platformTimezone = () => TZ;

const DAY_RX = /^\d{4}-\d{2}-\d{2}$/;
/** true for "YYYY-MM-DD" or an exact UTC midnight (how the API sends calendar days) */
export const isCalendarDay = (d) => {
  if (typeof d === 'string') return DAY_RX.test(d) || /T00:00:00(\.000)?Z$/.test(d);
  const x = new Date(d);
  return !Number.isNaN(+x) && x.getUTCHours() === 0 && x.getUTCMinutes() === 0 && x.getUTCSeconds() === 0 && x.getUTCMilliseconds() === 0;
};
const parse = (d) => (typeof d === 'string' && DAY_RX.test(d) ? new Date(`${d}T00:00:00Z`) : new Date(d));
/** Wall-clock parts of an instant in the platform timezone */
export const platformParts = (at = new Date()) => Object.fromEntries(partsFmt.formatToParts(new Date(at)).filter((p) => p.type !== 'literal').map((p) => [p.type, Number(p.value)]));
const zoneOf = (d) => (isCalendarDay(d) ? 'UTC' : TZ);

/** "YYYY-MM-DD": a calendar day as-is, or the platform calendar day of a timestamp (isoDate(new Date()) = today) */
export const isoDate = (d) => {
  if (typeof d === 'string' && DAY_RX.test(d)) return d;
  const x = parse(d);
  if (isCalendarDay(x)) return x.toISOString().slice(0, 10);
  const p = platformParts(x);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
};
/** Calendar-day arithmetic → UTC midnight of (that day + n). Works for "YYYY-MM-DD", calendar days and timestamps. */
export const addDays = (d, n) => new Date(Date.parse(`${isoDate(d)}T00:00:00Z`) + n * 86400000);
export const today = () => isoDate(new Date());
/** 0–23 in the platform timezone (greetings, "tonight") */
export const platformHour = () => platformParts().hour;
/** Day of week (0 = Sunday) of a calendar day / timestamp in the platform calendar */
export const weekday = (d) => new Date(`${isoDate(d)}T00:00:00Z`).getUTCDay();

export const dateLabel = (d, opts = { day: 'numeric', month: 'short' }) => (d ? parse(d).toLocaleDateString('en-IN', { timeZone: zoneOf(d), ...opts }) : '—');
export const dateFull = (d) => dateLabel(d, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
export const dateTime = (d) => (d ? new Date(d).toLocaleString('en-IN', { timeZone: TZ, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
export const time = (d) => (d ? new Date(d).toLocaleTimeString('en-IN', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }) : '—');
/** "GMT+05:30" style offset of the platform timezone */
export const offsetName = (zone = TZ, at = new Date()) => new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'longOffset' }).formatToParts(at).find((p) => p.type === 'timeZoneName')?.value?.replace(/^GMT$/, 'GMT+00:00') || 'GMT';
export const duration = (min) => `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}m`;
export const nights = (a, b) => Math.max(0, Math.round((new Date(b) - new Date(a)) / 86400000));
export const plural = (n, word, pluralWord) => `${n} ${n === 1 ? word : pluralWord || `${word}s`}`;
export const titleCase = (s = '') => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
export const timeAgo = (d) => {
  const s = (Date.now() - new Date(d)) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

export const STATUS_TONE = {
  confirmed: 'success', checked_in: 'primary', checked_out: 'neutral', completed: 'neutral', pending_payment: 'warning', pending_approval: 'warning',
  cancelled: 'danger', failed: 'danger', expired: 'neutral', paid: 'success', pending: 'warning', refunded: 'neutral', partially_refunded: 'warning',
  approved: 'success', rejected: 'danger', suspended: 'danger', draft: 'neutral', review: 'warning', published: 'success', archived: 'neutral',
  active: 'success', blocked: 'danger', open: 'warning', in_progress: 'primary', resolved: 'success', closed: 'neutral', processing: 'primary', on_hold: 'warning',
  success: 'success', created: 'neutral', processed: 'success', requested: 'warning',
};

export const cx = (...a) => a.filter(Boolean).join(' ');
export const slugify = (s = '') => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

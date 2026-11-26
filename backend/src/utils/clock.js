/**
 * Platform clock — the ONE place that decides "what day / time is it" for bookings, deals, reports and jobs.
 * The timezone comes from Admin → Settings → Region & time (settings.regional.timezone, IANA name such as
 * "Asia/Kolkata" or "UTC"); settings.service keeps it in sync on every process.
 *
 * Storage stays as it was: calendar days (stay dates, inventory nights, deal dates) are stored as UTC midnight
 * of that calendar day. Only the question "which calendar day is it right now?" depends on the timezone —
 * e.g. at 02:00 IST on 27 Nov it is still 26 Nov in UTC, so with Asia/Kolkata "today" is the 27th.
 */
export const DEFAULT_TIMEZONE = 'Asia/Kolkata';
let tz = DEFAULT_TIMEZONE;
let fmt = makeFmt(tz);

function makeFmt(zone) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
}

export function isValidTimezone(zone) {
  if (!zone || typeof zone !== 'string') return false;
  try { makeFmt(zone); return true; } catch { return false; }
}

export function setPlatformTimezone(zone) {
  if (!isValidTimezone(zone) || zone === tz) return;
  tz = zone;
  fmt = makeFmt(zone);
}

export const platformTimezone = () => tz;

/** Wall-clock parts of an instant in the platform timezone. */
export function parts(at = new Date()) {
  const p = Object.fromEntries(fmt.formatToParts(new Date(at)).map((x) => [x.type, x.value]));
  return { year: +p.year, month: +p.month, day: +p.day, hour: +p.hour, minute: +p.minute };
}

/** Calendar day of an instant in the platform timezone, as UTC midnight (the storage format for days). */
export function dayOf(at = new Date()) {
  const p = parts(at);
  return new Date(Date.UTC(p.year, p.month - 1, p.day));
}

/** Today in the platform timezone (UTC midnight of that calendar day). */
export const today = () => dayOf(new Date());

/** today ± n days */
export const daysFromToday = (n) => new Date(today().getTime() + n * 86400000);

/** "2026-11-26" for the platform's today */
export const todayIso = () => today().toISOString().slice(0, 10);

/** Offset like "+05:30" for display */
export function offsetLabel(zone = tz, at = new Date()) {
  const name = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'longOffset' }).formatToParts(at).find((x) => x.type === 'timeZoneName')?.value || 'GMT';
  const m = name.match(/GMT([+-]\d{2}:\d{2})?/);
  return m?.[1] || '+00:00';
}

/** Formats an instant for emails / server-rendered pages in the platform timezone. */
export const formatDateTime = (at, opts = { dateStyle: 'medium', timeStyle: 'short' }) => new Intl.DateTimeFormat('en-IN', { timeZone: tz, ...opts }).format(new Date(at));
/** Formats a stored calendar day (UTC midnight) — never shifted by timezone. */
export const formatDay = (day, opts = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) => new Intl.DateTimeFormat('en-IN', { timeZone: 'UTC', ...opts }).format(new Date(day));

const offsetMinutes = (zone, at) => {
  const [h, m] = offsetLabel(zone, at).split(':').map(Number);
  return Math.sign(h || (offsetLabel(zone, at).startsWith('-') ? -1 : 1)) * (Math.abs(h) * 60 + (m || 0));
};

/**
 * The real instant a platform calendar day begins — for filtering TIMESTAMPS (createdAt, paidAt) by day.
 * e.g. Asia/Kolkata 26 Nov starts at 2026-11-25T18:30Z.  Accepts a UTC-midnight Date or "YYYY-MM-DD".
 */
export function dayStart(day) {
  const d = typeof day === 'string' ? new Date(`${day.slice(0, 10)}T00:00:00Z`) : new Date(day);
  const utcMidnight = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return new Date(utcMidnight - offsetMinutes(tz, new Date(utcMidnight)) * 60000);
}

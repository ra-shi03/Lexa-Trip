import { today } from './format';
/**
 * Vendor deals ("Deals of the day") — display helpers shared by guest screens and the vendor/admin panels.
 * Dates are UTC midnights from the API (same as inventory), so compare by calendar day.
 */
const DAY = 86400000;
const utcDay = (d) => { const x = new Date(d); return Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()); };
const todayUtc = () => Date.parse(`${today()}T00:00:00Z`); // platform today (Admin → Region & time)

export const dealLabel = (d) => (!d ? '' : d.discountType === 'amount' ? `₹${Number(d.value).toLocaleString('en-IN')} off` : `${d.value}% off`);
/** Short ribbon text: "−20%" / "−₹500" */
export const dealRibbon = (d) => (!d ? '' : d.discountType === 'amount' ? `−₹${Number(d.value).toLocaleString('en-IN')}` : `−${d.value}%`);

/** Days left including today (1 = ends tonight) */
export const dealDaysLeft = (d) => Math.max(0, Math.round((utcDay(d.endDate) - todayUtc()) / DAY) + 1);

/** "Ends tonight" · "Ends tomorrow" · "3 days left" · "Till 12 Dec" */
export function dealEnds(d) {
  if (!d?.endDate) return '';
  const left = dealDaysLeft(d);
  if (left <= 1) return 'Ends tonight';
  if (left === 2) return 'Ends tomorrow';
  if (left <= 7) return `${left} days left`;
  return `Till ${new Date(d.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' })}`;
}

/** "Valid for stays 26 Nov – 28 Nov" */
export function dealWindow(d) {
  if (!d) return '';
  const f = (x) => new Date(x).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  return utcDay(d.startDate) === utcDay(d.endDate) ? `Valid for stays on ${f(d.startDate)}` : `Valid for stays ${f(d.startDate)} – ${f(d.endDate)}`;
}

export const STATUS_META = {
  live: { label: 'Live today', tone: 'success' },
  scheduled: { label: 'Scheduled', tone: 'primary' },
  paused: { label: 'Paused', tone: 'warning' },
  ended: { label: 'Ended', tone: 'neutral' },
};

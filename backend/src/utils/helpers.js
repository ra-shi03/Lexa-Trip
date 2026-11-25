import crypto from 'node:crypto';

export const slugify = (str = '') =>
  String(str)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);

export const escapeRegex = (s = '') => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Strip time → UTC midnight. All inventory dates are stored this way. */
export const toDay = (d) => {
  const x = new Date(d);
  return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()));
};

export const addDays = (d, n) => new Date(toDay(d).getTime() + n * 86400000);

export const dayRange = (from, to) => {
  const out = [];
  for (let d = toDay(from); d < toDay(to); d = addDays(d, 1)) out.push(d);
  return out;
};

export const nightsBetween = (a, b) => Math.round((toDay(b) - toDay(a)) / 86400000);

export const isoDay = (d) => toDay(d).toISOString().slice(0, 10);

export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export const randomCode = (prefix, len = 8) =>
  `${prefix}${crypto.randomBytes(16).toString('hex').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, len)}`;

export const pick = (obj, keys) =>
  keys.reduce((acc, k) => (obj?.[k] !== undefined ? { ...acc, [k]: obj[k] } : acc), {});

export const toCsv = (rows, columns) => {
  const esc = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = columns.map((c) => esc(c.label)).join(',');
  const body = rows.map((r) => columns.map((c) => esc(typeof c.value === 'function' ? c.value(r) : r[c.value])).join(','));
  return [head, ...body].join('\n');
};

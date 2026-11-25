const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const inr2 = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });

export const money = (n, precise = false) => (n === null || n === undefined || Number.isNaN(Number(n)) ? '—' : (precise ? inr2 : inr).format(Number(n)));
export const num = (n) => new Intl.NumberFormat('en-IN').format(Number(n || 0));

export const isoDate = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const today = () => isoDate(new Date());

export const dateLabel = (d, opts = { day: 'numeric', month: 'short' }) => (d ? new Date(d).toLocaleDateString('en-IN', opts) : '—');
export const dateFull = (d) => dateLabel(d, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
export const dateTime = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
export const time = (d) => (d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }) : '—');
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

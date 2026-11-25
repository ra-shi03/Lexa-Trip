export { money, dateLabel, dateTime, titleCase, plural, num, isoDate, addDays } from '../../lib/format';

/** Client-side CSV export for the rows currently loaded (server CSV exports exist for reports) */
export function toCsvDownload(rows, filename, includeRevenue = false) {
  const cols = [
    ['Booking', (b) => b.bookingCode], ['Type', (b) => b.type], ['Status', (b) => b.status], ['Payment', (b) => b.paymentStatus],
    ['Guest', (b) => b.primaryGuest?.name], ['Phone', (b) => b.primaryGuest?.phone],
    ['Property / route', (b) => (b.type === 'hotel' ? b.snapshot?.propertyName : `${b.trip?.from} - ${b.trip?.to}`)],
    ['Check-in / departure', (b) => (b.checkIn || b.trip?.departure || '').slice(0, 10)], ['Amount', (b) => b.pricing?.totalAmount],
    ...(includeRevenue ? [['Commission', (b) => b.commission?.amount], ['Vendor payout', (b) => b.vendorPayoutAmount]] : []),
    ['Created', (b) => b.createdAt],
  ];
  const esc = (v) => { const s = v === undefined || v === null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const csv = [cols.map((c) => c[0]).join(','), ...rows.map((r) => cols.map((c) => esc(c[1](r))).join(','))].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = filename;
  a.click();
}

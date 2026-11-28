import { useState } from 'react';
import { Download, BedDouble, Bus, Plane } from 'lucide-react';
import { api } from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { useToast } from '../../context/ToastContext';
import { DataTable, Tabs, StatusBadge, Drawer, Button, Badge, ConfirmDialog, EmptyState } from '../ui';
import { useSearchParams } from 'react-router';
import { useFilters, SearchField, FilterSelect, DateRange, ClearFilters } from './Filters';
import { PriceBreakdown } from '../stay/StayComponents';
import { money, dateLabel, dateTime, titleCase, plural, toCsvDownload } from './panelUtils';

const TYPE_ICON = { hotel: BedDouble, bus: Bus, flight: Plane };

/** Bookings list + detail drawer with lifecycle actions. Vendor: hotel only; admin: all services. */
export function BookingsPanel({ apiBase, admin, showRevenue }) {
  const [sp] = useSearchParams();
  const empty = { q: '', tab: sp.get('tab') || '', type: '', paymentStatus: '', dateField: '', from: '', to: '' };
  const f = useFilters(empty);
  const v = f.values;
  const toast = useToast();
  const { data, meta, loading, error, reload } = useApi(() => api.get(`${apiBase}/bookings`, f.params), f.deps);
  const [open, setOpen] = useState(null);
  const [exporting, setExporting] = useState(false);
  const filtered = Boolean(v.q || v.type || v.paymentStatus || v.dateField || v.from || v.to);

  // Export everything that matches the filters, not just the page on screen
  const exportCsv = async () => {
    setExporting(true);
    try {
      const all = [];
      for (let page = 1; page <= 25; page += 1) {
        const res = await api.get(`${apiBase}/bookings`, { ...f.params, page, limit: 200 });
        all.push(...res.data);
        if (page >= res.meta.pages) break;
      }
      toCsvDownload(all, 'bookings.csv', showRevenue);
    } catch (e) { toast.error(e); } finally { setExporting(false); }
  };

  const tabs = [['', 'All', 'all'], ['approval', 'Needs approval'], ['upcoming', 'Upcoming'], ['active', 'In-house'], ['completed', 'Completed'], ['cancelled', 'Cancelled'], ['failed', 'Failed / expired']]
    .map(([value, label, key]) => ({ value, label, count: meta?.counts?.[key || value] }));

  return (
    <div>
      <div className="card card-pad mb-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <SearchField value={v.q} onChange={(q) => f.set({ q })} busy={f.typing} placeholder={admin ? 'Booking ID, guest, phone, email, property, PNR' : 'Booking ID, guest, phone, email, property'} />
          <ClearFilters show={filtered} onClear={() => f.set({ ...empty, tab: v.tab })} />
          <Button variant="outline" icon={Download} loading={exporting} disabled={!meta?.total} onClick={exportCsv}>Export{meta?.total ? ` ${meta.total}` : ''}</Button>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">
          {admin && <FilterSelect label="Service" all="All services" value={v.type} onChange={(type) => f.set({ type })} options={[{ value: 'hotel', label: 'Hotels' }, { value: 'bus', label: 'Bus' }, { value: 'flight', label: 'Flights' }]} />}
          <FilterSelect label="Payment" all="Any payment" value={v.paymentStatus} onChange={(paymentStatus) => f.set({ paymentStatus })} options={['paid', 'pending', 'failed', 'refunded', 'partially_refunded'].map((x) => ({ value: x, label: titleCase(x) }))} />
          <FilterSelect label="Filter dates by" all="Booking date" value={v.dateField} onChange={(dateField) => f.set({ dateField })} options={[{ value: 'checkin', label: admin ? 'Check-in / departure' : 'Check-in date' }, { value: 'checkout', label: 'Check-out date' }]} />
          <DateRange from={v.from} to={v.to} ahead={Boolean(v.dateField)} onChange={(range) => f.set(range)} />
        </div>
      </div>
      <Tabs className="mb-4" value={v.tab} onChange={(tab) => f.set({ tab })} tabs={tabs} />
      <DataTable
        rows={data}
        loading={loading}
        error={error}
        onRetry={reload}
        meta={meta}
        onPage={f.setPage}
        onRowClick={setOpen}
        empty={<EmptyState title={filtered || v.tab ? 'No bookings match these filters' : 'No bookings yet'} />}
        columns={[
          { key: 'bookingCode', label: 'Booking', render: (b) => { const I = TYPE_ICON[b.type]; return <div className="flex items-center gap-2.5"><I size={16} className="text-muted" /><div><p className="font-semibold">{b.bookingCode}</p><p className="text-xs text-muted">{dateTime(b.createdAt)} · {titleCase(b.source || '')}</p></div></div>; } },
          { key: 'guest', label: 'Guest', render: (b) => <div><p className="font-medium">{b.primaryGuest?.name || b.user?.name}</p><p className="text-xs text-muted">{b.primaryGuest?.phone}</p></div> },
          { key: 'stay', label: 'Details', render: (b) => (b.type === 'hotel' ? <div><p className="font-medium">{b.snapshot?.propertyName}</p><p className="text-xs text-muted">{b.snapshot?.roomName} · {dateLabel(b.checkIn)} → {dateLabel(b.checkOut)}</p></div> : <div><p className="font-medium">{b.trip?.from} → {b.trip?.to}</p><p className="text-xs text-muted">{dateLabel(b.trip?.departure)} · PNR {b.pnr || '—'}</p></div>) },
          { key: 'amount', label: 'Amount', align: 'right', render: (b) => <span className="font-semibold">{money(b.pricing?.totalAmount)}</span> },
          ...(showRevenue ? [{ key: 'commission', label: 'Commission', align: 'right', render: (b) => money(b.commission?.amount) }] : []),
          { key: 'status', label: 'Status', render: (b) => <div className="flex flex-col gap-1"><StatusBadge status={b.status} /><StatusBadge status={b.paymentStatus} /></div> },
        ]}
      />
      <BookingDrawer booking={open} onClose={() => setOpen(null)} apiBase={apiBase} showRevenue={showRevenue} onChanged={() => { reload(); setOpen(null); }} />
    </div>
  );
}

function BookingDrawer({ booking: b, onClose, apiBase, onChanged, showRevenue }) {
  const toast = useToast();
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  if (!b) return null;
  const act = async (action, note) => {
    setBusy(true);
    try { const r = await api.post(`${apiBase}/bookings/${b._id}/action`, { action, note }); toast.success(r.message); onChanged(); } catch (e) { toast.error(e); } finally { setBusy(false); setConfirm(null); }
  };
  const actions = [
    b.status === 'pending_approval' && ['approve', 'Approve', 'primary'],
    b.status === 'pending_approval' && ['reject', 'Decline & refund', 'danger', true],
    b.type === 'hotel' && b.status === 'confirmed' && ['check_in', 'Mark checked-in', 'primary'],
    b.type === 'hotel' && b.status === 'checked_in' && ['check_out', 'Mark checked-out', 'primary'],
    b.type === 'hotel' && b.status === 'confirmed' && ['no_show', 'Mark no-show', 'outline'],
    ['confirmed', 'pending_approval'].includes(b.status) && ['cancel', 'Cancel booking', 'danger', true],
  ].filter(Boolean);
  return (
    <Drawer open onClose={onClose} title={b.bookingCode} width="max-w-lg" footer={actions.length > 0 && <div className="flex flex-wrap gap-2">{actions.map(([a, l, v, needsReason]) => <Button key={a} size="sm" variant={v} loading={busy} onClick={() => (needsReason ? setConfirm(a) : act(a))}>{l}</Button>)}</div>}>
      <div className="space-y-5 text-sm">
        <div className="flex flex-wrap gap-2"><StatusBadge status={b.status} /><StatusBadge status={b.paymentStatus} /><Badge>{titleCase(b.type)}</Badge><Badge>{titleCase(b.source || 'web')}</Badge></div>
        {b.type === 'hotel' ? (
          <div className="rounded-brand bg-surface p-4"><p className="font-bold">{b.snapshot?.propertyName}</p><p className="text-muted">{b.snapshot?.roomName} · {b.ratePlan?.name}</p><p className="mt-2">{dateLabel(b.checkIn)} → {dateLabel(b.checkOut)} · {plural(b.nights || 0, 'night')} · {plural(b.rooms || 0, 'room')} · {plural(b.guests?.adults || 0, 'adult')}{b.guests?.children ? `, ${b.guests.children} child` : ''}</p></div>
        ) : (
          <div className="rounded-brand bg-surface p-4"><p className="font-bold">{b.trip?.from} → {b.trip?.to}</p><p className="text-muted">{b.trip?.operator || `${b.trip?.airline} ${b.trip?.flightNo}`}</p><p className="mt-2">{dateTime(b.trip?.departure)} · PNR {b.pnr || '—'}</p>{b.passengers?.map((p, i) => <p key={i} className="text-xs text-muted">{p.fullName} {p.seatNo ? `· seat ${p.seatNo}` : ''}</p>)}</div>
        )}
        <div><p className="mb-1 font-bold">Guest</p><p>{b.primaryGuest?.name}</p><p className="text-muted">{b.primaryGuest?.email} · {b.primaryGuest?.phone}</p>{b.specialRequests && <p className="mt-2 rounded-lg bg-warning/10 p-2 text-xs">Request: {b.specialRequests}</p>}</div>
        <div className="rounded-brand border border-line p-4"><PriceBreakdown pricing={b.pricing} nights={b.nights} rooms={b.rooms} /></div>
        {showRevenue && b.commission && <div className="grid grid-cols-2 gap-3 rounded-brand bg-primary-soft/40 p-3"><div><p className="text-xs text-muted">Commission ({b.commission.rate}{b.commission.type === 'percent' ? '%' : ' flat'})</p><p className="font-bold">{money(b.commission.amount)}</p></div><div><p className="text-xs text-muted">Vendor payout</p><p className="font-bold">{money(b.vendorPayoutAmount)}</p></div></div>}
        {b.cancellation?.requestedAt && <div className="rounded-brand bg-danger/5 p-3 text-xs"><p className="font-bold text-danger">Cancelled by {b.cancellation.requestedBy}</p><p>{b.cancellation.reason}</p><p>Refund {money(b.cancellation.refundAmount)} · {titleCase(b.cancellation.refundStatus)}</p></div>}
        <div><p className="mb-2 font-bold">Timeline</p><ol className="space-y-2 border-l-2 border-line pl-4">{b.statusHistory?.map((h, i) => <li key={i} className="text-xs"><p className="font-semibold">{titleCase(h.status)} <span className="font-normal text-muted">by {h.by}</span></p><p className="text-muted">{dateTime(h.at)}{h.note ? ` · ${h.note}` : ''}</p></li>)}</ol></div>
      </div>
      <ConfirmDialog open={Boolean(confirm)} onClose={() => setConfirm(null)} onConfirm={(r) => act(confirm, r)} withReason loading={busy} title={confirm === 'reject' ? 'Decline booking request?' : 'Cancel booking?'} message="The guest will be notified and refunded as per policy (full refund when the property cancels)." confirmLabel="Confirm" />
    </Drawer>
  );
}

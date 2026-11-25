import { useState } from 'react';
import { Search, Download, BedDouble, Bus, Plane } from 'lucide-react';
import { api } from '../../lib/api';
import { useApi, useDebounce } from '../../hooks/useApi';
import { useToast } from '../../context/ToastContext';
import { DataTable, Tabs, StatusBadge, Drawer, Button, Badge, ConfirmDialog, Select } from '../ui';
import { PriceBreakdown } from '../stay/StayComponents';
import { money, dateLabel, dateTime, titleCase, plural, toCsvDownload } from './panelUtils';

const TYPE_ICON = { hotel: BedDouble, bus: Bus, flight: Plane };

/** Bookings list + detail drawer with lifecycle actions. Vendor: hotel only; admin: all services. */
export function BookingsPanel({ apiBase, admin, showRevenue }) {
  const [tab, setTab] = useState('all');
  const [type, setType] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const dq = useDebounce(q);
  const { data, meta, loading, error, reload } = useApi(() => api.get(`${apiBase}/bookings`, { tab: tab === 'all' ? undefined : tab, type: type || undefined, q: dq || undefined, page }), [tab, type, dq, page]);
  const [open, setOpen] = useState(null);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input className="input pl-9" placeholder="Booking ID, guest name, phone, PNR" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></div>
        {admin && <Select className="w-44" value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} placeholder="All services" options={[{ value: 'hotel', label: 'Hotels' }, { value: 'bus', label: 'Bus' }, { value: 'flight', label: 'Flights' }]} />}
        <Button variant="outline" icon={Download} onClick={() => toCsvDownload(data || [], 'bookings.csv', showRevenue)}>Export</Button>
      </div>
      <Tabs className="mb-4" value={tab} onChange={(v) => { setTab(v); setPage(1); }} tabs={[{ value: 'all', label: 'All' }, { value: 'upcoming', label: 'Upcoming' }, { value: 'active', label: 'In-house' }, { value: 'completed', label: 'Completed' }, { value: 'cancelled', label: 'Cancelled' }]} />
      <DataTable
        rows={data}
        loading={loading}
        error={error}
        onRetry={reload}
        meta={meta}
        onPage={setPage}
        onRowClick={setOpen}
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

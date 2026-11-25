import { useState } from 'react';
import { useParams } from 'react-router';
import { Check, X, Send, Download, Plus, Receipt, Percent, RotateCcw } from 'lucide-react';
import { PropertyEditor } from '../../components/panel/PropertyEditor';
import { InventoryPage } from '../../components/panel/InventoryGrid';
import { BookingsPanel } from '../../components/panel/BookingsPanel';
import { ReportsView } from '../../components/panel/ReportsView';
import { BarsChart, TrendChart } from '../../components/panel/Charts';
import { DataTable, PageHeader, StatusBadge, Tabs, Button, Drawer, Select, Badge, Modal, Input, ConfirmDialog, StatCard } from '../../components/ui';
import { useApi } from '../../hooks/useApi';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { dateLabel, dateTime, money, titleCase, timeAgo, isoDate, addDays, cx } from '../../lib/format';

export const AdminBookings = () => {
  const { isMaster } = useAuth();
  return <div><PageHeader title="Bookings" subtitle="Hotel, bus and flight bookings across the platform" /><BookingsPanel apiBase="/admin" admin showRevenue={isMaster} /></div>;
};
export const AdminInventory = () => <InventoryPage apiBase="/admin" />;
export function AdminPropertyEdit() {
  const { id } = useParams();
  return <PropertyEditor apiBase="/admin" id={id} listPath="/admin/properties" admin />;
}

export function ReviewsPage() {
  const [status, setStatus] = useState('pending');
  const [page, setPage] = useState(1);
  const { data, meta, loading, reload } = useApi(() => api.get('/admin/reviews', { status: status || undefined, page }), [status, page]);
  const moderate = async (r, s) => { await api.patch(`/admin/reviews/${r._id}`, { status: s }); reload(); };
  return (
    <div>
      <PageHeader title="Reviews" subtitle="Approved reviews update the property rating automatically" />
      <Tabs pill className="mb-4 w-fit" value={status} onChange={(v) => { setStatus(v); setPage(1); }} tabs={[{ value: 'pending', label: 'Pending' }, { value: 'approved', label: 'Approved' }, { value: 'rejected', label: 'Rejected' }, { value: '', label: 'All' }]} />
      <DataTable rows={data} meta={meta} onPage={setPage} loading={loading} columns={[
        { key: 'p', label: 'Property', render: (r) => r.property?.name }, { key: 'u', label: 'Guest', render: (r) => r.user?.name },
        { key: 'rating', label: 'Rating', render: (r) => <Badge tone="navy">{r.rating}/5</Badge> },
        { key: 'comment', label: 'Review', render: (r) => <div className="max-w-md"><p className="font-semibold">{r.title}</p><p className="text-xs text-muted line-clamp-2">{r.comment}</p></div> },
        { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
        { key: 'a', label: '', align: 'right', render: (r) => <div className="flex justify-end gap-1">{r.status !== 'approved' && <Button size="xs" icon={Check} onClick={() => moderate(r, 'approved')}>Approve</Button>}{r.status !== 'rejected' && <Button size="xs" variant="ghost" icon={X} className="text-danger" onClick={() => moderate(r, 'rejected')} />}</div> },
      ]} />
    </div>
  );
}

export function SupportPage() {
  const [status, setStatus] = useState('open');
  const { data, loading, reload } = useApi(() => api.get('/admin/support', { status: status || undefined }), [status]);
  const [open, setOpen] = useState(null);
  const [msg, setMsg] = useState('');
  const reply = async (newStatus) => { const { data: t } = await api.post(`/admin/support/${open._id}`, { message: msg || undefined, status: newStatus }); setOpen({ ...open, ...t }); setMsg(''); reload(); };
  return (
    <div>
      <PageHeader title="Support tickets" subtitle="Booking-related help requests from guests" />
      <Tabs pill className="mb-4 w-fit" value={status} onChange={setStatus} tabs={[{ value: 'open', label: 'Open' }, { value: 'in_progress', label: 'In progress' }, { value: 'resolved', label: 'Resolved' }, { value: '', label: 'All' }]} />
      <DataTable rows={data} loading={loading} onRowClick={setOpen} columns={[{ key: 'subject', label: 'Subject', render: (t) => <p className="font-semibold">{t.subject}</p> }, { key: 'u', label: 'Guest', render: (t) => `${t.user?.name || ''} · ${t.user?.phone || ''}` }, { key: 'b', label: 'Booking', render: (t) => t.booking?.bookingCode || '—' }, { key: 'updatedAt', label: 'Updated', render: (t) => timeAgo(t.updatedAt) }, { key: 'status', label: 'Status', render: (t) => <StatusBadge status={t.status} /> }]} />
      <Drawer open={Boolean(open)} onClose={() => setOpen(null)} title={open?.subject} footer={open && (
        <div className="space-y-2">
          <div className="flex gap-2"><input className="input" placeholder="Reply to guest" value={msg} onChange={(e) => setMsg(e.target.value)} /><Button icon={Send} disabled={!msg} onClick={() => reply('in_progress')} /></div>
          <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => reply('resolved')}>Mark resolved</Button><Button size="sm" variant="ghost" onClick={() => reply('closed')}>Close</Button></div>
        </div>
      )}>
        <div className="space-y-3">{open?.messages?.map((m, i) => <div key={i} className={cx('max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm', m.from === 'admin' ? 'ml-auto bg-secondary text-white' : 'bg-surface')}>{m.text}<p className={cx('mt-1 text-[10px]', m.from === 'admin' ? 'text-white/60' : 'text-muted')}>{dateTime(m.at)}</p></div>)}</div>
      </Drawer>
    </div>
  );
}

export function AiConversationsPage() {
  const { data, loading } = useApi(() => api.get('/admin/ai/conversations'), []);
  const [open, setOpen] = useState(null);
  return (
    <div>
      <PageHeader title="Lexa AI conversations" subtitle="Review what guests ask the assistant — improve content, offers and inventory" />
      <DataTable rows={data} loading={loading} onRowClick={setOpen} columns={[{ key: 'u', label: 'Guest', render: (c) => c.user?.name || 'Anonymous' }, { key: 'first', label: 'First question', render: (c) => <span className="line-clamp-2 max-w-md text-sm">{c.messages?.find((m) => m.role === 'user')?.content}</span> }, { key: 'n', label: 'Messages', render: (c) => c.messages?.length }, { key: 'updatedAt', label: 'Last activity', render: (c) => timeAgo(c.updatedAt) }]} />
      <Drawer open={Boolean(open)} onClose={() => setOpen(null)} title="Conversation">
        <div className="space-y-3">{open?.messages?.map((m, i) => <div key={i} className={cx('max-w-[90%] rounded-2xl px-3.5 py-2.5 text-sm', m.role === 'user' ? 'ml-auto bg-secondary text-white' : 'bg-surface')}>{m.content}</div>)}</div>
      </Drawer>
    </div>
  );
}

// ───────────── Finance (master only) ─────────────
export function TransactionsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const { data, meta, loading } = useApi(() => api.get('/admin/finance/transactions', { page, status: status || undefined }), [page, status]);
  return (
    <div>
      <PageHeader title="Transactions" subtitle="Every payment attempt across the platform" />
      <Tabs pill className="mb-4 w-fit" value={status} onChange={(v) => { setStatus(v); setPage(1); }} tabs={[{ value: '', label: 'All' }, { value: 'success', label: 'Success' }, { value: 'failed', label: 'Failed' }, { value: 'pending', label: 'Pending' }, { value: 'refunded', label: 'Refunded' }]} />
      <DataTable rows={data} meta={meta} onPage={setPage} loading={loading} columns={[
        { key: 'createdAt', label: 'Date', render: (t) => dateTime(t.createdAt) }, { key: 'b', label: 'Booking', render: (t) => <div><p className="font-semibold">{t.booking?.bookingCode}</p><p className="text-xs text-muted">{t.booking?.type}</p></div> },
        { key: 'u', label: 'Customer', render: (t) => t.user?.name || t.user?.phone }, { key: 'gateway', label: 'Gateway', render: (t) => <div><p>{t.gateway}</p><p className="text-xs text-muted">{t.gatewayPaymentId || t.gatewayOrderId}</p></div> },
        { key: 'method', label: 'Method', render: (t) => titleCase(t.method || '—') }, { key: 'amount', label: 'Amount', align: 'right', render: (t) => <b>{money(t.amount, true)}</b> },
        { key: 'refunds', label: 'Refunded', align: 'right', render: (t) => (t.refunds?.length ? money(t.refunds.reduce((s, r) => s + r.amount, 0), true) : '—') }, { key: 'status', label: 'Status', render: (t) => <StatusBadge status={t.status} /> },
      ]} />
    </div>
  );
}

export function RefundsPage() {
  const [status, setStatus] = useState('');
  const { data, loading, reload } = useApi(() => api.get('/admin/finance/refunds', { status: status || undefined }), [status]);
  const [act, setAct] = useState(null);
  const toast = useToast();
  const run = async (b, action, note) => { try { await api.post(`/admin/finance/refunds/${b._id}`, { action, note }); toast.success('Done'); setAct(null); reload(); } catch (e) { toast.error(e); } };
  return (
    <div>
      <PageHeader title="Refunds" subtitle="Cancellation refunds — retry failed gateway refunds or reject" />
      <Tabs pill className="mb-4 w-fit" value={status} onChange={setStatus} tabs={[{ value: '', label: 'All' }, { value: 'approved', label: 'Pending at gateway' }, { value: 'processed', label: 'Processed' }, { value: 'rejected', label: 'Rejected' }]} />
      <DataTable rows={data} loading={loading} columns={[
        { key: 'bookingCode', label: 'Booking', render: (b) => <div><p className="font-semibold">{b.bookingCode}</p><p className="text-xs text-muted">{b.snapshot?.propertyName || b.type}</p></div> },
        { key: 'u', label: 'Customer', render: (b) => b.user?.name }, { key: 'paid', label: 'Paid', render: (b) => money(b.pricing?.totalAmount, true) },
        { key: 'refund', label: 'Refund', render: (b) => <b>{money(b.cancellation?.refundAmount, true)}</b> }, { key: 'reason', label: 'Reason', render: (b) => <span className="text-xs">{b.cancellation?.reason}<br /><span className="text-muted">by {b.cancellation?.requestedBy} · {dateLabel(b.cancellation?.requestedAt)}</span></span> },
        { key: 'status', label: 'Status', render: (b) => <StatusBadge status={b.cancellation?.refundStatus} /> },
        { key: 'a', label: '', align: 'right', render: (b) => ['approved', 'requested'].includes(b.cancellation?.refundStatus) && <div className="flex justify-end gap-1"><Button size="xs" onClick={() => run(b, 'process')}>Process</Button><Button size="xs" variant="ghost" className="text-danger" onClick={() => setAct(b)}>Reject</Button></div> },
      ]} />
      <ConfirmDialog open={Boolean(act)} onClose={() => setAct(null)} withReason title="Reject refund?" onConfirm={(note) => run(act, 'reject', note)} />
    </div>
  );
}

export function PayoutsPage() {
  const { data, loading, reload } = useApi(() => api.get('/admin/finance/payouts'), []);
  const [gen, setGen] = useState(null);
  const [pay, setPay] = useState(null);
  const toast = useToast();
  const generate = async () => { try { const r = await api.post('/admin/finance/payouts/generate', gen); toast.success(r.message); setGen(null); reload(); } catch (e) { toast.error(e); } };
  const update = async () => { try { await api.put(`/admin/finance/payouts/${pay._id}`, pay); toast.success('Payout updated'); setPay(null); reload(); } catch (e) { toast.error(e); } };
  return (
    <div>
      <PageHeader title="Vendor payouts" subtitle="Settle net earnings (after commission) for completed stays" actions={<Button icon={Plus} onClick={() => setGen({ from: isoDate(addDays(new Date(), -30)), to: isoDate(new Date()) })}>Generate payouts</Button>} />
      <DataTable rows={data} loading={loading} columns={[
        { key: 'v', label: 'Vendor', render: (p) => <div><p className="font-semibold">{p.vendor?.businessName}</p><p className="text-xs text-muted">{p.vendor?.bank?.bankName} {p.vendor?.bank?.accountNumber ? `••${p.vendor.bank.accountNumber.slice(-4)}` : '— no bank details'}</p></div> },
        { key: 'period', label: 'Period', render: (p) => `${dateLabel(p.periodStart)} – ${dateLabel(p.periodEnd)}` }, { key: 'n', label: 'Bookings', render: (p) => p.bookings?.length },
        { key: 'g', label: 'Gross', render: (p) => money(p.grossAmount) }, { key: 'c', label: 'Commission', render: (p) => money(p.commissionAmount) }, { key: 'net', label: 'Net payout', render: (p) => <b>{money(p.netAmount)}</b> },
        { key: 'status', label: 'Status', render: (p) => <StatusBadge status={p.status} /> },
        { key: 'a', label: '', align: 'right', render: (p) => p.status !== 'paid' && <Button size="xs" variant="outline" onClick={() => setPay({ ...p, status: 'paid', reference: '' })}>Mark paid</Button> },
      ]} />
      <Modal open={Boolean(gen)} onClose={() => setGen(null)} title="Generate payouts" size="sm" footer={<Button onClick={generate}>Generate</Button>}>
        {gen && <div className="grid gap-4"><p className="text-sm text-muted">Creates one payout per vendor for checked-out/completed (and penalty-bearing cancelled) stays with check-out in this period, not yet paid.</p><Input label="Check-out from" type="date" value={gen.from} onChange={(e) => setGen({ ...gen, from: e.target.value })} /><Input label="Check-out to" type="date" value={gen.to} onChange={(e) => setGen({ ...gen, to: e.target.value })} /></div>}
      </Modal>
      <Modal open={Boolean(pay)} onClose={() => setPay(null)} title="Update payout" size="sm" footer={<Button onClick={update}>Save</Button>}>
        {pay && <div className="grid gap-4"><Select label="Status" value={pay.status} onChange={(e) => setPay({ ...pay, status: e.target.value })} options={['pending', 'processing', 'paid', 'on_hold'].map((v) => ({ value: v, label: titleCase(v) }))} /><Input label="UTR / bank reference" value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} /><Input label="Note" value={pay.note || ''} onChange={(e) => setPay({ ...pay, note: e.target.value })} /></div>}
      </Modal>
    </div>
  );
}

export function AdminReports() {
  const [tab, setTab] = useState('revenue');
  const [range, setRange] = useState({ from: isoDate(addDays(new Date(), -30)), to: isoDate(new Date()) });
  const { data } = useApi(() => api.get('/admin/reports/revenue', range), [range.from, range.to], { enabled: tab === 'revenue' });
  const t = (data?.byService || []).reduce((a, r) => ({ gross: a.gross + r.gross, commission: a.commission + r.commission, refunds: a.refunds + r.refunds }), { gross: 0, commission: 0, refunds: 0 });
  return (
    <div>
      <Tabs className="mb-6" value={tab} onChange={setTab} tabs={[{ value: 'revenue', label: 'Revenue & commission' }, { value: 'operations', label: 'Occupancy & cancellations' }]} />
      {tab === 'operations' ? <ReportsView endpoint="/admin/reports/operations" title="Operational reports" /> : (
        <div>
          <PageHeader title="Financial reports" actions={<><Input type="date" size="sm" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} /><Input type="date" size="sm" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} /><Button variant="outline" size="sm" icon={Download} onClick={() => api.download('/admin/reports/revenue', { ...range, format: 'csv' }, 'revenue.csv')}>CSV</Button></>} />
          <div className="mb-6 grid gap-4 sm:grid-cols-3"><StatCard label="Gross" value={money(t.gross)} icon={Receipt} tone="navy" /><StatCard label="Commission earned" value={money(t.commission)} icon={Percent} tone="success" /><StatCard label="Refunds" value={money(t.refunds)} icon={RotateCcw} tone="danger" /></div>
          <div className="mb-6 grid gap-6 xl:grid-cols-2"><div className="card card-pad"><p className="mb-3 font-bold">Daily gross</p><TrendChart data={data?.daily || []} dataKey="gross" currency /></div><div className="card card-pad"><p className="mb-3 font-bold">Gross by service</p><BarsChart data={data?.byService || []} dataKey="gross" currency /></div></div>
          <p className="mb-2 font-bold">Top vendors</p>
          <DataTable rows={data?.byVendor} columns={[{ key: 'vendorName', label: 'Vendor' }, { key: 'bookings', label: 'Bookings' }, { key: 'gross', label: 'Gross', render: (r) => money(r.gross) }, { key: 'commission', label: 'Commission', render: (r) => money(r.commission) }, { key: 'payout', label: 'Payout', render: (r) => money(r.payout) }]} />
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import { LayoutDashboard, Building2, CalendarDays, CalendarCheck, Wallet, BarChart3, User, Plus, Clock, LogIn, LogOut as LogOutIcon, Upload, Percent, Receipt, Bell } from 'lucide-react';
import { PanelLayout } from '../../components/layout/PanelLayout';
import { Logo } from '../../components/layout/Logo';
import { PropertyEditor } from '../../components/panel/PropertyEditor';
import { InventoryPage } from '../../components/panel/InventoryGrid';
import { DealsPage } from '../../components/panel/DealsPage';
import { BookingsPanel } from '../../components/panel/BookingsPanel';
import { ReportsView } from '../../components/panel/ReportsView';
import { Button, Input, Select, PageHeader, StatCard, DataTable, StatusBadge, Alert, PageLoader, Img, Tabs, EmptyState } from '../../components/ui';
import { useApi } from '../../hooks/useApi';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { money, dateLabel, dateTime, titleCase, timeAgo } from '../../lib/format';

// ───────────── Auth ─────────────
export function VendorAuth({ mode = 'login' }) {
  const { vendor, login } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState({ name: '', businessName: '', email: '', phone: '', password: '' });
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data, message } = mode === 'login' ? await api.post('/auth/vendor/login', { email: form.email, password: form.password }) : await api.post('/auth/vendor/register', form);
      login('vendor', data.token, data.vendor);
      if (message) toast.success(message);
    } catch (er) { toast.error(er); } finally { setBusy(false); }
  };
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-secondary p-12 text-white lg:flex">
        <Logo light suffix="Partner" />
        <div><h1 className="text-4xl font-extrabold text-white">Grow your bookings with LexaTrip</h1><p className="mt-4 max-w-md text-white/70">List hotels, villas, resorts and homestays. Manage rooms, rates, inventory and bookings — with channel-manager sync.</p></div>
        <p className="text-sm text-white/50">Commission-based · Weekly payouts · Dedicated support</p>
      </div>
      <div className="grid place-items-center p-6">
        <form onSubmit={submit} className="w-full max-w-md space-y-4">
          <Logo className="mb-4 lg:hidden" suffix="Partner" />
          <h2 className="text-2xl font-extrabold">{mode === 'login' ? 'Partner sign in' : 'List your property'}</h2>
          {mode === 'register' && <><Input label="Your name" required value={form.name} onChange={set('name')} /><Input label="Business / brand name" required value={form.businessName} onChange={set('businessName')} /><Input label="Mobile" required maxLength={10} value={form.phone} onChange={set('phone')} /></>}
          <Input label="Email" type="email" required value={form.email} onChange={set('email')} />
          <Input label="Password" type="password" required minLength={mode === 'register' ? 8 : 1} value={form.password} onChange={set('password')} hint={mode === 'register' ? 'At least 8 characters' : undefined} />
          <Button type="submit" block size="lg" loading={busy}>{mode === 'login' ? 'Sign in' : 'Create partner account'}</Button>
          <p className="text-center text-sm text-muted">{mode === 'login' ? <>New partner? <Link to="/vendor/register" className="font-bold text-primary">Register</Link></> : <>Already registered? <Link to="/vendor/login" className="font-bold text-primary">Sign in</Link></>}</p>
        </form>
      </div>
    </div>
  );
}

// ───────────── Shell ─────────────
export function VendorShell() {
  const { vendor, ready, logout } = useAuth();
  const navigate = useNavigate();
  if (!ready.vendor) return <PageLoader />;
  if (!vendor) return <Navigate to="/vendor/login" replace />;
  const nav = [
    { items: [{ to: '/vendor', label: 'Dashboard', icon: LayoutDashboard, end: true }] },
    { section: 'Property', items: [{ to: '/vendor/properties', label: 'Properties & rooms', icon: Building2 }, { to: '/vendor/inventory', label: 'Inventory & rates', icon: CalendarDays }, { to: '/vendor/deals', label: 'Deals & offers', icon: Percent }] },
    { section: 'Business', items: [{ to: '/vendor/bookings', label: 'Bookings', icon: CalendarCheck }, { to: '/vendor/earnings', label: 'Earnings & payouts', icon: Wallet }, { to: '/vendor/reports', label: 'Reports', icon: BarChart3 }] },
    { section: 'Account', items: [{ to: '/vendor/profile', label: 'Business profile', icon: User }, { to: '/vendor/notifications', label: 'Notifications', icon: Bell }] },
  ];
  return <PanelLayout nav={nav} account={vendor} roleLabel="Partner" homeTo="/vendor" notificationsTo="/vendor/notifications" onLogout={() => { logout('vendor'); navigate('/vendor/login'); }} />;
}

// ───────────── Dashboard ─────────────
export function VendorDashboard() {
  const { data, loading } = useApi(() => api.get('/vendor/dashboard'), []);
  if (loading) return <PageLoader />;
  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Today at a glance" actions={<Button icon={Plus} to="/vendor/properties/new">Add property</Button>} />
      {data.accountStatus !== 'approved' && <Alert tone="warning" className="mb-6" title={`Account ${data.accountStatus}`}>Complete your business profile, bank details and upload documents. Admin will verify and approve your account before properties go live.</Alert>}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Arrivals today" value={data.today.arrivals} icon={LogIn} />
        <StatCard label="Departures today" value={data.today.departures} icon={LogOutIcon} tone="navy" />
        <StatCard label="Awaiting approval" value={data.today.pendingApproval} icon={Clock} tone="warning" />
        <StatCard label="Occupancy (next 30d)" value={`${data.occupancyNext30}%`} icon={Percent} tone="success" />
      </div>
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Bookings this month" value={data.month.bookings} icon={CalendarCheck} />
        <StatCard label="Gross this month" value={money(data.month.gross)} icon={Receipt} tone="navy" />
        <StatCard label="Net earnings (after commission)" value={money(data.month.net)} icon={Wallet} tone="success" sub={`Commission ${money(data.month.commission)}`} />
      </div>
      <div className="card">
        <div className="flex items-center justify-between border-b border-line px-5 py-3"><p className="font-bold">Recent bookings</p><Link to="/vendor/bookings" className="text-sm font-bold text-primary">View all</Link></div>
        <DataTable rows={data.recent} columns={[{ key: 'bookingCode', label: 'Booking' }, { key: 'g', label: 'Guest', render: (b) => b.primaryGuest?.name }, { key: 's', label: 'Stay', render: (b) => `${b.snapshot?.propertyName} · ${dateLabel(b.checkIn)}` }, { key: 'a', label: 'Amount', render: (b) => money(b.pricing?.totalAmount) }, { key: 'status', label: 'Status', render: (b) => <StatusBadge status={b.status} /> }]} />
      </div>
    </div>
  );
}

// ───────────── Properties ─────────────
export function VendorProperties() {
  const { data, loading } = useApi(() => api.get('/vendor/properties'), []);
  const navigate = useNavigate();
  return (
    <div>
      <PageHeader title="Properties" subtitle="Add properties, rooms, rate plans and policies" actions={<Button icon={Plus} to="/vendor/properties/new">Add property</Button>} />
      <DataTable
        loading={loading}
        rows={data}
        onRowClick={(p) => navigate(`/vendor/properties/${p._id}`)}
        empty={<EmptyState icon={Building2} title="No properties yet" action={<Button to="/vendor/properties/new" icon={Plus}>Add your first property</Button>} />}
        columns={[
          { key: 'name', label: 'Property', render: (p) => <div className="flex items-center gap-3"><Img src={p.images?.[0]?.url} className="h-10 w-14 rounded-md" /><div><p className="font-semibold">{p.name}</p><p className="text-xs text-muted">{p.category?.name} · {p.address?.city?.name}</p></div></div> },
          { key: 'minPrice', label: 'From', render: (p) => money(p.minPrice) },
          { key: 'rating', label: 'Rating', render: (p) => (p.rating?.count ? `${p.rating.avg} (${p.rating.count})` : '—') },
          { key: 'status', label: 'Status', render: (p) => <StatusBadge status={p.status} /> },
          { key: 'u', label: 'Updated', render: (p) => timeAgo(p.updatedAt) },
        ]}
      />
    </div>
  );
}
export function VendorPropertyEdit() {
  const { id } = useParams();
  return <PropertyEditor apiBase="/vendor" id={id} listPath="/vendor/properties" />;
}
export const VendorInventory = () => <InventoryPage apiBase="/vendor" />;
export const VendorDeals = () => <DealsPage apiBase="/vendor" />;
export const VendorBookings = () => <div><PageHeader title="Bookings" subtitle="Upcoming, in-house, completed and cancelled reservations" /><BookingsPanel apiBase="/vendor" showRevenue /></div>;
export const VendorReports = () => <ReportsView endpoint="/vendor/reports" />;

// ───────────── Earnings ─────────────
export function VendorEarnings() {
  const { data, loading } = useApi(() => api.get('/vendor/earnings'), []);
  if (loading) return <PageLoader />;
  return (
    <div>
      <PageHeader title="Earnings & payouts" subtitle="Gross bookings, platform commission and your net payouts" />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Gross bookings" value={money(data.totals.gross)} icon={Receipt} />
        <StatCard label="Commission" value={money(data.totals.commission)} icon={Percent} tone="warning" />
        <StatCard label="Net earnings" value={money(data.totals.net)} icon={Wallet} tone="success" />
        <StatCard label="Pending payout" value={money(data.pendingPayout.amount)} icon={Clock} tone="navy" sub={`${data.pendingPayout.count} completed stays`} />
      </div>
      <DataTable rows={data.payouts} empty={<EmptyState icon={Wallet} title="No payouts yet" text="Payouts are generated for completed stays each cycle." />} columns={[
        { key: 'p', label: 'Period', render: (p) => `${dateLabel(p.periodStart)} – ${dateLabel(p.periodEnd)}` },
        { key: 'b', label: 'Bookings', render: (p) => p.bookings?.length },
        { key: 'g', label: 'Gross', render: (p) => money(p.grossAmount) },
        { key: 'c', label: 'Commission', render: (p) => money(p.commissionAmount) },
        { key: 'n', label: 'Net', render: (p) => <b>{money(p.netAmount)}</b> },
        { key: 'status', label: 'Status', render: (p) => <StatusBadge status={p.status} /> },
        { key: 'r', label: 'Reference', render: (p) => p.reference || '—' },
      ]} />
    </div>
  );
}

// ───────────── Profile (business, bank, documents) ─────────────
export function VendorProfile() {
  const { vendor, refresh } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState('business');
  const [biz, setBiz] = useState({ name: vendor.name, phone: vendor.phone, businessName: vendor.businessName || '', businessType: vendor.businessType || '', gstin: vendor.gstin || '', pan: vendor.pan || '', address: vendor.address || {} });
  const [bank, setBank] = useState(vendor.bank || {});
  const [docType, setDocType] = useState('gst_certificate');
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const saveBiz = async () => { try { await api.put('/vendor/profile', biz); toast.success('Saved'); refresh('vendor'); } catch (e) { toast.error(e); } };
  const saveBank = async () => { try { await api.put('/vendor/bank', bank); toast.success('Bank details saved'); refresh('vendor'); } catch (e) { toast.error(e); } };
  const uploadDoc = async (file) => { const fd = new FormData(); fd.append('file', file); fd.append('type', docType); try { await api.upload('/vendor/documents', fd); toast.success('Uploaded for verification'); refresh('vendor'); } catch (e) { toast.error(e); } };
  const changePw = async () => { try { await api.post('/auth/vendor/change-password', pw); toast.success('Password updated'); setPw({ currentPassword: '', newPassword: '' }); } catch (e) { toast.error(e); } };
  return (
    <div>
      <PageHeader title="Business profile" subtitle={<>Account status: <StatusBadge status={vendor.status} /></>} />
      <Tabs className="mb-6" value={tab} onChange={setTab} tabs={[{ value: 'business', label: 'Business details' }, { value: 'bank', label: 'Bank & payouts' }, { value: 'docs', label: `Documents (${vendor.documents?.length || 0})` }, { value: 'security', label: 'Security' }]} />
      {tab === 'business' && (
        <div className="card card-pad grid max-w-3xl gap-4 sm:grid-cols-2">
          <Input label="Contact name" value={biz.name} onChange={(e) => setBiz({ ...biz, name: e.target.value })} />
          <Input label="Mobile" value={biz.phone} onChange={(e) => setBiz({ ...biz, phone: e.target.value })} />
          <Input label="Business name" value={biz.businessName} onChange={(e) => setBiz({ ...biz, businessName: e.target.value })} />
          <Select label="Business type" placeholder="Select" value={biz.businessType} onChange={(e) => setBiz({ ...biz, businessType: e.target.value })} options={['individual', 'proprietorship', 'partnership', 'company'].map((v) => ({ value: v, label: titleCase(v) }))} />
          <Input label="GSTIN" value={biz.gstin} onChange={(e) => setBiz({ ...biz, gstin: e.target.value.toUpperCase() })} />
          <Input label="PAN" value={biz.pan} onChange={(e) => setBiz({ ...biz, pan: e.target.value.toUpperCase() })} />
          <Input label="Address" className="sm:col-span-2" value={biz.address.line1 || ''} onChange={(e) => setBiz({ ...biz, address: { ...biz.address, line1: e.target.value } })} />
          <Input label="City" value={biz.address.city || ''} onChange={(e) => setBiz({ ...biz, address: { ...biz.address, city: e.target.value } })} />
          <Input label="Pincode" value={biz.address.pincode || ''} onChange={(e) => setBiz({ ...biz, address: { ...biz.address, pincode: e.target.value } })} />
          <div className="sm:col-span-2"><Button onClick={saveBiz}>Save</Button></div>
        </div>
      )}
      {tab === 'bank' && (
        <div className="card card-pad grid max-w-3xl gap-4 sm:grid-cols-2">
          <Input label="Account holder" value={bank.accountHolder || ''} onChange={(e) => setBank({ ...bank, accountHolder: e.target.value })} />
          <Input label="Account number" value={bank.accountNumber || ''} onChange={(e) => setBank({ ...bank, accountNumber: e.target.value })} />
          <Input label="IFSC" value={bank.ifsc || ''} onChange={(e) => setBank({ ...bank, ifsc: e.target.value.toUpperCase() })} />
          <Input label="Bank name" value={bank.bankName || ''} onChange={(e) => setBank({ ...bank, bankName: e.target.value })} />
          <Input label="UPI ID (optional)" value={bank.upiId || ''} onChange={(e) => setBank({ ...bank, upiId: e.target.value })} />
          <div className="sm:col-span-2"><Button onClick={saveBank}>Save bank details</Button></div>
        </div>
      )}
      {tab === 'docs' && (
        <div className="max-w-3xl space-y-4">
          <div className="card card-pad flex flex-wrap items-end gap-3">
            <Select label="Document type" value={docType} onChange={(e) => setDocType(e.target.value)} options={[['gst_certificate', 'GST certificate'], ['pan', 'PAN card'], ['trade_licence', 'Trade licence'], ['property_proof', 'Property ownership / lease'], ['id_proof', 'Owner ID proof'], ['cancelled_cheque', 'Cancelled cheque']].map(([v, l]) => ({ value: v, label: l }))} />
            <label className="btn btn-primary cursor-pointer"><Upload size={18} />Upload<input type="file" hidden accept="image/*,application/pdf" onChange={(e) => e.target.files[0] && uploadDoc(e.target.files[0])} /></label>
          </div>
          <DataTable rows={vendor.documents} columns={[{ key: 'type', label: 'Document', render: (d) => titleCase(d.type) }, { key: 'url', label: 'File', render: (d) => <a href={d.url} target="_blank" rel="noreferrer" className="font-semibold text-primary">View</a> }, { key: 'status', label: 'Status', render: (d) => <StatusBadge status={d.status === 'verified' ? 'approved' : d.status} /> }, { key: 'note', label: 'Note', render: (d) => d.note || '—' }]} />
        </div>
      )}
      {tab === 'security' && (
        <div className="card card-pad grid max-w-md gap-4">
          <Input label="Current password" type="password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} />
          <Input label="New password" type="password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} hint="At least 8 characters" />
          <Button onClick={changePw}>Update password</Button>
        </div>
      )}
    </div>
  );
}

export function PanelNotifications({ endpoint }) {
  const { data, reload } = useApi(() => api.get(endpoint), [endpoint]);
  return (
    <div>
      <PageHeader title="Notifications" actions={<Button variant="outline" size="sm" onClick={async () => { await api.post(`${endpoint}/read`); reload(); }}>Mark all read</Button>} />
      <div className="card divide-y divide-line">
        {!data?.length && <EmptyState icon={Bell} title="No notifications" />}
        {data?.map((n) => <div key={n._id} className="flex items-start gap-3 p-4">{!n.read && <span className="mt-2 h-2 w-2 rounded-full bg-primary" />}<div className="flex-1"><p className="text-sm font-bold">{n.title}</p><p className="text-sm text-muted">{n.body}</p></div><span className="text-xs text-muted">{dateTime(n.createdAt)}</span></div>)}
      </div>
    </div>
  );
}


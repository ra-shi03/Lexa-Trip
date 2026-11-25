import { Link } from 'react-router';
import { Users, Store, Building2, CalendarCheck, Receipt, Percent, RotateCcw, BedDouble, Bus, Plane, ShieldAlert } from 'lucide-react';
import { PageHeader, StatCard, PageLoader, StatusBadge, ErrorState, Alert } from '../../components/ui';
import { TrendChart } from '../../components/panel/Charts';
import { useApi } from '../../hooks/useApi';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { money, num, timeAgo, titleCase } from '../../lib/format';

export default function AdminDashboard() {
  const { isMaster, admin } = useAuth();
  const { data: d, loading, error, reload } = useApi(() => api.get('/admin/dashboard'), []);
  if (loading) return <PageLoader />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  const pend = [
    ['/admin/vendors?status=pending', 'Vendors awaiting approval', d.pending.vendors],
    ['/admin/properties?status=pending', 'Properties awaiting approval', d.pending.properties],
    ['/admin/reviews?status=pending', 'Reviews to moderate', d.pending.reviews],
    ['/admin/support', 'Open support tickets', d.pending.tickets],
    ['/admin/seo/explorer?status=review', 'SEO pages in review', d.pending.seoReview],
  ];
  return (
    <div>
      <PageHeader title={`Welcome, ${admin.name.split(' ')[0]}`} subtitle={isMaster ? 'Platform overview' : 'Operations overview (revenue data is restricted to the master admin)'} />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Customers" value={num(d.totals.users)} icon={Users} />
        <StatCard label="Vendors" value={num(d.totals.vendors)} icon={Store} tone="navy" />
        <StatCard label="Properties" value={num(d.totals.properties)} icon={Building2} tone="success" />
        <StatCard label="Bookings" value={num(d.totals.bookings)} icon={CalendarCheck} tone="warning" />
      </div>
      {isMaster && d.revenue && (
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <StatCard label="Gross booking value" value={money(d.revenue.gross)} icon={Receipt} tone="navy" />
          <StatCard label="Platform commission" value={money(d.revenue.commission)} icon={Percent} tone="success" />
          <StatCard label="Refunds issued" value={money(d.revenue.refunds)} icon={RotateCcw} tone="danger" />
        </div>
      )}
      {!isMaster && <Alert className="mb-6" tone="info"><span className="flex items-center gap-2"><ShieldAlert size={16} />Revenue, commission, payouts and financial reports are hidden for sub-admins.</span></Alert>}

      <div className="mb-6 grid gap-6 xl:grid-cols-[2fr_1fr]">
        <div className="card card-pad">
          <div className="mb-3 flex items-center justify-between"><p className="font-bold">{isMaster ? 'Revenue — last 30 days' : 'Bookings — last 30 days'}</p></div>
          <TrendChart data={d.trend} dataKey={isMaster ? 'revenue' : 'bookings'} currency={isMaster} />
        </div>
        <div className="card card-pad">
          <p className="mb-3 font-bold">Pending actions</p>
          <div className="space-y-1">{pend.map(([to, l, n]) => <Link key={to} to={to} className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm hover:bg-surface"><span>{l}</span><span className={`rounded-full px-2 text-xs font-bold ${n ? 'bg-primary text-white' : 'bg-surface text-muted'}`}>{n}</span></Link>)}</div>
          <div className="divider my-4" />
          <p className="mb-2 font-bold">By service</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[['hotel', BedDouble], ['bus', Bus], ['flight', Plane]].map(([k, I]) => <div key={k} className="rounded-brand bg-surface p-3"><I size={18} className="mx-auto text-primary" /><p className="mt-1 text-lg font-extrabold">{d.bookingsByType[k] || 0}</p><p className="text-[11px] text-muted">{titleCase(k)}</p></div>)}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="card">
          <p className="border-b border-line px-5 py-3 font-bold">Recent bookings</p>
          <div className="divide-y divide-line">{d.recentBookings.map((b) => <Link key={b._id} to="/admin/bookings" className="flex items-center justify-between gap-3 px-5 py-3 text-sm hover:bg-surface"><div className="min-w-0"><p className="font-semibold">{b.bookingCode}</p><p className="truncate text-xs text-muted">{b.snapshot?.propertyName || `${b.trip?.from} → ${b.trip?.to}`} · {b.primaryGuest?.name}</p></div><div className="text-right"><StatusBadge status={b.status} />{b.pricing && <p className="text-xs font-bold">{money(b.pricing.totalAmount)}</p>}</div></Link>)}</div>
        </div>
        <div className="card">
          <p className="border-b border-line px-5 py-3 font-bold">Recent activity</p>
          <div className="divide-y divide-line">{d.recentActivity.map((a) => <div key={a._id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm"><div><p className="font-medium">{a.action}</p><p className="text-xs text-muted">{a.actorName} · {a.actorType}</p></div><span className="text-xs text-muted">{timeAgo(a.createdAt)}</span></div>)}{!d.recentActivity.length && <p className="p-5 text-sm text-muted">No activity yet.</p>}</div>
        </div>
      </div>
    </div>
  );
}

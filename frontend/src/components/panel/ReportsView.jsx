import { useState } from 'react';
import { Download, Percent, CalendarCheck, Receipt, Ban } from 'lucide-react';
import { api } from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { DataTable, StatCard, Input, Button, PageHeader } from '../ui';
import { TrendChart } from './Charts';
import { money, num, isoDate, addDays } from './panelUtils';

/** Booking / revenue / occupancy / cancellation reports (vendor scope or admin-wide). */
export function ReportsView({ endpoint, title = 'Reports', showRevenue = true }) {
  const [range, setRange] = useState({ from: isoDate(addDays(new Date(), -30)), to: isoDate(new Date()) });
  const { data, loading } = useApi(() => api.get(endpoint, range), [range.from, range.to]);
  const totals = (data?.byProperty || []).reduce((t, r) => ({ bookings: t.bookings + r.bookings, revenue: t.revenue + r.revenue, cancelled: t.cancelled + r.cancelled, roomNights: t.roomNights + r.roomNights, payout: t.payout + (r.payout || 0) }), { bookings: 0, revenue: 0, cancelled: 0, roomNights: 0, payout: 0 });
  return (
    <div>
      <PageHeader title={title} subtitle="Booking, revenue, occupancy and cancellation performance" actions={<>
        <Input type="date" size="sm" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
        <Input type="date" size="sm" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
        <Button variant="outline" size="sm" icon={Download} onClick={() => api.download(endpoint, { ...range, format: 'csv' }, `report-${range.from}-${range.to}.csv`)}>CSV</Button>
      </>} />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Bookings" value={num(totals.bookings)} icon={CalendarCheck} sub={`${num(totals.roomNights)} room-nights`} />
        {showRevenue && <StatCard label="Gross revenue" value={money(totals.revenue)} icon={Receipt} tone="navy" sub={totals.payout ? `Net payout ${money(totals.payout)}` : undefined} />}
        <StatCard label="Occupancy" value={`${data?.occupancy ?? 0}%`} icon={Percent} tone="success" />
        <StatCard label="Cancellations" value={num(totals.cancelled)} icon={Ban} tone="danger" sub={totals.bookings ? `${Math.round((totals.cancelled / totals.bookings) * 100)}% rate` : undefined} />
      </div>
      <div className="card card-pad mb-6"><p className="mb-3 font-bold">Daily {showRevenue ? 'revenue' : 'bookings'}</p><TrendChart data={data?.daily || []} dataKey={showRevenue ? 'revenue' : 'bookings'} currency={showRevenue} /></div>
      <div className="grid gap-6 xl:grid-cols-2">
        <div><p className="mb-2 font-bold">Property-wise</p><DataTable loading={loading} rows={data?.byProperty} rowKey="_id" columns={[{ key: 'name', label: 'Property' }, { key: 'bookings', label: 'Bookings' }, { key: 'roomNights', label: 'Room-nights' }, ...(showRevenue ? [{ key: 'revenue', label: 'Revenue', align: 'right', render: (r) => money(r.revenue) }] : []), { key: 'cancelled', label: 'Cancelled' }]} /></div>
        <div><p className="mb-2 font-bold">Room-wise</p><DataTable loading={loading} rows={data?.byRoom} rowKey="_id" columns={[{ key: 'name', label: 'Room', render: (r) => <div><p className="font-medium">{r.name}</p><p className="text-xs text-muted">{r.property}</p></div> }, { key: 'bookings', label: 'Bookings' }, { key: 'roomNights', label: 'Room-nights' }, ...(showRevenue ? [{ key: 'revenue', label: 'Revenue', align: 'right', render: (r) => money(r.revenue) }] : [])]} /></div>
      </div>
    </div>
  );
}

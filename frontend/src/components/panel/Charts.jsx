import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar } from 'recharts';
import { money } from '../../lib/format';

const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

/** Trend chart for dashboards (bookings or revenue over time). Colours follow the active theme. */
export function TrendChart({ data = [], dataKey = 'bookings', currency, height = 260 }) {
  const primary = css('--lt-primary') || '#F26B1D';
  const muted = css('--lt-muted') || '#5b6478';
  const border = css('--lt-border') || '#e6e8ee';
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs><linearGradient id={`g-${dataKey}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={primary} stopOpacity={0.28} /><stop offset="100%" stopColor={primary} stopOpacity={0} /></linearGradient></defs>
        <CartesianGrid stroke={border} vertical={false} />
        <XAxis dataKey="_id" tick={{ fontSize: 11, fill: muted }} tickFormatter={(d) => String(d).slice(5)} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: muted }} axisLine={false} tickLine={false} width={currency ? 64 : 32} tickFormatter={(v) => (currency ? `₹${v >= 1000 ? `${Math.round(v / 1000)}k` : v}` : v)} />
        <Tooltip formatter={(v) => (currency ? money(v) : v)} contentStyle={{ borderRadius: 10, border: `1px solid ${border}`, fontSize: 12 }} />
        <Area type="monotone" dataKey={dataKey} stroke={primary} strokeWidth={2.5} fill={`url(#g-${dataKey})`} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function BarsChart({ data = [], dataKey, nameKey = '_id', currency, height = 240 }) {
  const secondary = css('--lt-secondary') || '#14213D';
  const muted = css('--lt-muted') || '#5b6478';
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <XAxis dataKey={nameKey} tick={{ fontSize: 11, fill: muted }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: muted }} axisLine={false} tickLine={false} width={currency ? 64 : 32} tickFormatter={(v) => (currency ? `₹${v >= 1000 ? `${Math.round(v / 1000)}k` : v}` : v)} />
        <Tooltip formatter={(v) => (currency ? money(v) : v)} />
        <Bar dataKey={dataKey} fill={secondary} radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

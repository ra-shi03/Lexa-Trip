import { useState } from 'react';
import { Star, ImageOff } from 'lucide-react';
import { cx } from '../../lib/format';
import { Skeleton, EmptyState, ErrorState } from './Feedback';
import { Pagination } from './Navigation';

/**
 * columns: [{ key, label, render?(row), className?, align? }]
 * Used by every admin/vendor list (consistent look, horizontal scroll on mobile).
 */
export function DataTable({ columns, rows, loading, error, onRetry, empty, meta, onPage, onRowClick, rowKey = '_id' }) {
  return (
    <div className="card overflow-hidden">
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>{columns.map((c) => <th key={c.key} className={cx(c.align === 'right' && 'text-right', c.className)}>{c.label}</th>)}</tr>
          </thead>
          <tbody>
            {loading && !rows?.length
              ? Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>{columns.map((c) => <td key={c.key}><Skeleton className="h-4 w-full max-w-[160px]" /></td>)}</tr>
              ))
              : rows?.map((r) => (
                <tr key={r[rowKey]} onClick={onRowClick ? () => onRowClick(r) : undefined} className={onRowClick ? 'cursor-pointer' : ''}>
                  {columns.map((c) => <td key={c.key} className={cx(c.align === 'right' && 'text-right', c.className)}>{c.render ? c.render(r) : r[c.key] ?? '—'}</td>)}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {error && <ErrorState error={error} onRetry={onRetry} />}
      {!loading && !error && !rows?.length && (empty || <EmptyState title="Nothing here yet" />)}
      {onPage && <div className="border-t border-line px-4"><Pagination meta={meta} onPage={onPage} /></div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, back }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {back}
        <h1 className="text-2xl font-extrabold sm:text-[26px]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, icon: Icon, tone = 'primary', sub }) {
  const tones = { primary: 'bg-primary-soft text-primary', navy: 'bg-secondary text-white', success: 'bg-success/10 text-success', warning: 'bg-warning/10 text-warning', danger: 'bg-danger/10 text-danger' };
  return (
    <div className="card card-pad flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
        <p className="mt-1.5 truncate text-2xl font-extrabold text-ink">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
      </div>
      {Icon && <span className={cx('grid h-10 w-10 flex-none place-items-center rounded-brand', tones[tone])}><Icon size={20} /></span>}
    </div>
  );
}

/** Image with graceful fallback (seed images are remote) */
export function Img({ src, alt = '', className, ...rest }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className={cx('grid place-items-center bg-gradient-to-br from-primary-soft to-surface text-primary/50', className)} role="img" aria-label={alt}>
        <ImageOff size={22} />
      </div>
    );
  }
  return <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} className={cx('object-cover', className)} {...rest} />;
}

export function Stars({ value = 0, size = 13 }) {
  if (!value) return null;
  return (
    <span className="inline-flex items-center gap-0.5 text-[#f5a524]" aria-label={`${value} star`}>
      {Array.from({ length: value }).map((_, i) => <Star key={i} size={size} fill="currentColor" strokeWidth={0} />)}
    </span>
  );
}

/** Kayak-style rating pill: 8.6 Excellent */
export function RatingPill({ rating, count }) {
  if (!rating?.count && !count) return null;
  const avg = rating?.avg ?? rating;
  const score = Math.round(avg * 2 * 10) / 10; // 5-point → 10-point display
  const word = score >= 9 ? 'Exceptional' : score >= 8.5 ? 'Excellent' : score >= 8 ? 'Very good' : score >= 7 ? 'Good' : 'Okay';
  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <span className="rounded-md bg-secondary px-1.5 py-0.5 text-xs font-bold text-white">{score.toFixed(1)}</span>
      <span className="font-semibold text-ink">{word}</span>
      <span className="text-muted">({rating?.count ?? count})</span>
    </span>
  );
}

export function Avatar({ name = '', size = 36, src }) {
  const initials = name.split(' ').map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'G';
  if (src) return <img src={src} alt={name} className="flex-none rounded-full object-cover" style={{ width: size, height: size }} />;
  return <span className="grid flex-none place-items-center rounded-full bg-secondary font-bold text-white" style={{ width: size, height: size, fontSize: size * 0.38 }}>{initials}</span>;
}

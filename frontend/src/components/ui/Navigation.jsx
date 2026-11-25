import { ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { cx } from '../../lib/format';

/** tabs: [{ value, label, count?, icon? }] — underline style; `pill` for segmented */
export function Tabs({ tabs, value, onChange, pill, className }) {
  return (
    <div className={cx('no-scrollbar flex gap-1 overflow-x-auto', pill ? 'rounded-brand bg-surface p-1' : 'border-b border-line', className)} role="tablist">
      {tabs.map((t) => {
        const active = t.value === value;
        const Icon = t.icon;
        return (
          <button
            key={t.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.value)}
            className={cx(
              'flex flex-none items-center gap-2 whitespace-nowrap px-3.5 text-sm font-semibold transition',
              pill
                ? cx('h-9 rounded-[calc(var(--lt-radius)-3px)]', active ? 'bg-card text-ink shadow-card' : 'text-muted hover:text-ink')
                : cx('-mb-px h-11 border-b-2', active ? 'border-primary text-ink' : 'border-transparent text-muted hover:text-ink'),
            )}
          >
            {Icon && <Icon size={16} />}
            {t.label}
            {t.count !== undefined && <span className={cx('rounded-full px-1.5 text-[11px]', active ? 'bg-primary text-white' : 'bg-surface text-muted')}>{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function Pagination({ meta, onPage }) {
  if (!meta || meta.pages <= 1) return null;
  const { page, pages, total } = meta;
  return (
    <div className="flex items-center justify-between gap-4 px-1 py-3 text-sm">
      <span className="text-muted">Page {page} of {pages} · {total} total</span>
      <div className="flex gap-2">
        <button className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}><ChevronLeft size={16} /> Prev</button>
        <button className="btn btn-outline btn-sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next <ChevronRight size={16} /></button>
      </div>
    </div>
  );
}

/** Checkout progress */
export function Stepper({ steps, current }) {
  return (
    <ol className="flex items-center gap-2 text-xs font-semibold sm:text-sm">
      {steps.map((s, i) => (
        <li key={s} className="flex items-center gap-2">
          <span className={cx('grid h-6 w-6 place-items-center rounded-full text-[11px]', i < current ? 'bg-success text-white' : i === current ? 'bg-primary text-white' : 'bg-surface text-muted')}>
            {i < current ? <Check size={13} /> : i + 1}
          </span>
          <span className={cx(i === current ? 'text-ink' : 'text-muted', 'hidden sm:inline')}>{s}</span>
          {i < steps.length - 1 && <span className="h-px w-6 bg-line sm:w-10" />}
        </li>
      ))}
    </ol>
  );
}

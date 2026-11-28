import { useState } from 'react';
import { Search, X, Loader2, RotateCcw } from 'lucide-react';
import { Button, Select } from '../ui';
import { useDebounce } from '../../hooks/useApi';
import { addDays, isoDate, today } from '../../lib/format';

/**
 * Filter state for panel lists. Typing in search is debounced, and any filter change goes back to page 1
 * without an extra request.
 *   const f = useFilters({ q: '', status: '' });  f.set({ q })  ·  api.get(url, f.params)
 */
export function useFilters(initial) {
  const [values, setValues] = useState(initial);
  const q = useDebounce(values.q.trim(), 450);
  const clean = Object.fromEntries(Object.entries({ ...values, q }).filter(([, v]) => v !== ''));
  const key = JSON.stringify(clean);
  const [pageState, setPageState] = useState({ key, page: 1 });
  const page = pageState.key === key ? pageState.page : 1;
  return {
    values,
    set: (patch) => setValues((v) => ({ ...v, ...patch })),
    setPage: (n) => setPageState({ key, page: n }),
    params: { ...clean, page },
    deps: [key, page],
    typing: q !== values.q.trim(),
  };
}

export function SearchField({ value, onChange, busy, placeholder = 'Search' }) {
  return (
    <div className="relative min-w-[240px] flex-1">
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
      <input className="input !pl-9 !pr-10" placeholder={placeholder} aria-label={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
      {busy ? <Loader2 size={16} className="spin absolute right-3 top-1/2 -mt-2 text-muted" />
        : value && <button type="button" onClick={() => onChange('')} aria-label="Clear search" className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-muted hover:bg-surface hover:text-ink"><X size={15} /></button>}
    </div>
  );
}

/** Dropdown whose first option means "no filter" */
export const FilterSelect = ({ label, all, value, onChange, options }) => (
  <Select label={label} className="min-w-0" value={value} onChange={(e) => onChange(e.target.value)} placeholder={all} options={options} />
);

const shift = (n) => isoDate(addDays(today(), n));
const PRESETS = () => [
  ['today', 'Today', today(), today()],
  ['yesterday', 'Yesterday', shift(-1), shift(-1)],
  ['last7', 'Last 7 days', shift(-6), today()],
  ['last30', 'Last 30 days', shift(-29), today()],
  ['month', 'This month', `${today().slice(0, 8)}01`, today()],
];
// Check-in / check-out dates are often in the future
const AHEAD = () => [['tomorrow', 'Tomorrow', shift(1), shift(1)], ['next7', 'Next 7 days', today(), shift(6)], ['next30', 'Next 30 days', today(), shift(29)]];

/** Quick range + From / To (platform-timezone days) */
export function DateRange({ from, to, onChange, ahead }) {
  const presets = ahead ? [...PRESETS().slice(0, 1), ...AHEAD(), ...PRESETS().slice(1)] : PRESETS();
  const current = !from && !to ? '' : presets.find((p) => p[2] === from && p[3] === to)?.[0] || 'custom';
  const pick = (k) => {
    const p = presets.find((x) => x[0] === k);
    if (p) onChange({ from: p[2], to: p[3] });
    else if (!k) onChange({ from: '', to: '' });
  };
  const date = (label, value, patch, limits) => (
    <label className="min-w-0">
      <span className="field-label">{label}</span>
      <input type="date" className="input" value={value} {...limits} onChange={(e) => onChange(patch(e.target.value))} />
    </label>
  );
  return (
    <>
      <FilterSelect label="Date range" all="Any date" value={current} onChange={pick}
        options={[...presets.map((p) => ({ value: p[0], label: p[1] })), ...(current === 'custom' ? [{ value: 'custom', label: 'Custom range' }] : [])]} />
      {date('From', from, (v) => ({ from: v, to: to && v > to ? v : to }), {})}
      {date('To', to, (v) => ({ to: v, from: from && v && v < from ? v : from }), { min: from || undefined })}
    </>
  );
}

export function ClearFilters({ show, onClear, className }) {
  if (!show) return null;
  return <Button variant="ghost" size="sm" icon={RotateCcw} className={className} onClick={onClear}>Clear filters</Button>;
}

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router';
import { Search as SearchIcon, SlidersHorizontal, Sparkles, TrendingDown, X, Flame } from 'lucide-react';
import { StaySearchForm } from '@/components/search/SearchForms';
import { PropertyRow, FilterSplit } from '@/components/stay/StayComponents';
import { Button, EmptyState, ErrorState, Pagination } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { useToast } from '@/context/ToastContext';
import { PropertyRowSkeleton } from '../Skeletons';
import { money, plural, dateLabel, cx } from '@/lib/format';

const SORTS = [
  { value: 'recommended', label: 'Best' },
  { value: 'price_asc', label: 'Cheapest' },
  { value: 'rating', label: 'Top rated' },
  { value: 'price_desc', label: 'Price: high to low' },
];

/** Bottom sheet for filters: drag handle, reset, sticky "show results" footer, Esc / backdrop to close */
function FilterSheet({ open, onClose, count, total, loading, onClear, children }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center" role="dialog" aria-modal="true" aria-label="Filters">
      <div className="absolute inset-0 animate-fade-up bg-secondary/55" onClick={onClose} />
      <div className="sheet-up relative flex h-[88dvh] w-full max-w-[480px] flex-col overflow-hidden rounded-t-[28px] bg-card shadow-pop">
        <div className="rounded-t-[28px] bg-card px-5 pb-3 pt-2.5">
          <span className="mx-auto mb-2 block h-1.5 w-11 rounded-full bg-line" />
          <div className="flex items-center justify-between">
            <div><h2 className="text-xl font-extrabold">Filters</h2><p className="text-[13px] text-muted">{count ? `${count} applied` : 'Narrow down your stays'}</p></div>
            <div className="flex items-center gap-1">
              {count > 0 && <button onClick={onClear} className="h-10 rounded-full px-3 text-[15px] font-bold text-primary transition active:scale-95">Reset</button>}
              <button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full bg-surface transition active:scale-90" aria-label="Close filters"><X size={20} /></button>
            </div>
          </div>
        </div>
        {children}
        <div className="safe-bottom flex items-center gap-3 border-t border-line bg-card p-4">
          {count > 0 && <button type="button" onClick={onClear} className="h-12 flex-none rounded-full border border-line px-5 text-[15px] font-bold transition active:scale-95">Clear all</button>}
          <Button className="flex-1" size="lg" onClick={onClose}>{loading ? 'Updating…' : total === 0 ? 'No stays match' : `Show ${total ?? ''} ${total === 1 ? 'stay' : 'stays'}`}</Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Stays results — Kayak-like layout: compact search, sort tabs, filter rail, horizontal cards */
export default function Search() {
  const [params, setParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { user, update } = useAuth();
  const { feature } = useSettings();
  const toast = useToast();
  const key = params.toString();
  const { data, meta, loading, error, reload } = useApi(() => api.get('/public/properties', Object.fromEntries(params)), [key]);
  const { data: categories } = useApi(() => api.get('/public/categories'), [], { live: 'content' });
  const { data: amenities } = useApi(() => api.get('/public/amenities'), [], { live: 'content' });

  const set = (k, v) => setParams((p) => { const n = new URLSearchParams(p); if (v === '' || v === undefined || v === null) n.delete(k); else n.set(k, v); n.delete('page'); return n; }, { replace: true });
  const sort = params.get('sort') || 'recommended';
  const query = useMemo(() => {
    const q = Object.fromEntries(['checkIn', 'checkOut', 'adults', 'children', 'rooms'].filter((k) => params.get(k)).map((k) => [k, params.get(k)]));
    // Deals default to tonight on the server — carry those dates to the stay page so the deal price follows the guest
    if (meta?.deals && !q.checkIn) { q.checkIn = String(meta.checkIn).slice(0, 10); q.checkOut = String(meta.checkOut).slice(0, 10); }
    return q;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, meta?.deals, meta?.checkIn]);
  const activeFilters = ['category', 'amenities', 'minPrice', 'maxPrice', 'rating', 'stars'].filter((k) => params.get(k));
  const saved = new Set((user?.wishlist || []).map(String));

  const toggleSave = async (id) => {
    if (!user) return toast.info('Sign in to save stays');
    try {
      const { data: r } = await api.post(`/me/wishlist/${id}`);
      update('user', { wishlist: r.wishlist });
      toast.success(r.saved ? 'Saved to your list' : 'Removed from saved');
    } catch (e) { toast.error(e); }
  };

  const cheapest = data?.filter((p) => p.available).reduce((m, p) => (!m || p.nightlyFrom < m.nightlyFrom ? p : m), null);
  const topRated = data?.filter((p) => p.available).reduce((m, p) => (!m || (p.rating?.avg || 0) > (m.rating?.avg || 0) ? p : m), null);
  const sortPrice = { recommended: data?.find((p) => p.available)?.nightlyFrom, price_asc: cheapest?.nightlyFrom, rating: topRated?.nightlyFrom };

  // Real, data-backed insight (no invented numbers): compares current cheapest to city average base rate
  const insight = feature('priceInsights') && meta?.priceStats && cheapest && meta.city
    ? cheapest.nightlyFrom < meta.priceStats.avg
      ? `Good time to book — stays in ${meta.city.name} start at ${money(cheapest.nightlyFrom)}, below the typical ${money(meta.priceStats.avg)}/night.`
      : `Prices in ${meta.city.name} for your dates are around ${money(cheapest.nightlyFrom)}+/night. Flexible? Try weekdays for lower rates.`
    : null;

  // "Deals of the day" (a category of kind "deals", or ?deals=today): tonight's vendor offers
  const isDeals = Boolean(meta?.deals);
  const dealsCat = categories?.find((c) => c.kind === 'deals' && String(params.get('category') || '').split(',').includes(c.slug));
  const catName = (slugs) => String(slugs).split(',').map((s) => categories?.find((c) => c.slug === s)?.name || s).join(', ');
  const FILTER_LABEL = { category: 'Type', amenities: 'Amenities', minPrice: 'Min ₹', maxPrice: 'Max ₹', rating: 'Rating', stars: 'Stars' };

  const [editing, setEditing] = useState(false);
  const guests = (Number(params.get('adults')) || 2) + (Number(params.get('children')) || 0);
  const title = isDeals ? (dealsCat?.name || 'Deals of the day') : meta?.city ? meta.city.name : params.get('city') || 'All stays';
  const summary = [meta ? `${dateLabel(meta.checkIn)} – ${dateLabel(meta.checkOut)}` : 'Any dates', plural(guests, 'guest')].join(' · ');

  return (
    <div className="bg-surface/60 pb-10">
      {/* Sticky summary pill: tap to edit the search */}
      <div className="sticky top-16 z-20 border-b border-line bg-bg/95 px-4 py-3 backdrop-blur">
        <button onClick={() => setEditing((v) => !v)} aria-expanded={editing} className="flex w-full items-center gap-3 rounded-full border border-line bg-card px-4 py-2.5 text-left shadow-sm transition active:scale-[.99]">
          <SearchIcon size={20} className="flex-none text-primary" />
          <span className="min-w-0 flex-1 leading-tight"><span className="block truncate text-base font-bold">{title}</span><span className="block truncate text-[13px] text-muted">{summary}</span></span>
          <span className="rounded-full bg-primary-soft px-3 py-1 text-[13px] font-bold text-primary">{editing ? 'Close' : 'Edit'}</span>
        </button>
        {editing && <div className="animate-fade-up mt-3"><StaySearchForm compact /></div>}
      </div>

      <div className="px-4 pt-5">
        <div className="mb-4">
          <h1 className="flex items-center gap-2 text-2xl font-extrabold leading-tight">
            {isDeals ? `${dealsCat?.name || 'Deals of the day'}${meta?.city ? ` in ${meta.city.name}` : ''}` : meta?.city ? `Stays in ${meta.city.name}` : params.get('city') ? `Results for “${params.get('city')}”` : 'All stays'}
          </h1>
          <p className="mt-1 text-[15px] text-muted">{meta ? `${plural(meta.total, isDeals ? 'stay on offer' : 'property', isDeals ? 'stays on offer' : 'properties')} · ${plural(meta.nights, 'night')}` : ' '}</p>
          {params.get('ai') && <span className="badge badge-primary mt-2 h-7"><Sparkles size={13} />Filters set by Lexa AI from your request</span>}
        </div>

        {/* Sort chips + filter button */}
        <div className="hscroll chip-row -mx-4 mb-4 items-center !px-4">
          <button onClick={() => setFiltersOpen(true)} className={cx('flex h-11 flex-none items-center gap-2 rounded-full border px-4 text-[15px] font-bold transition active:scale-95', activeFilters.length ? 'border-primary bg-primary text-white' : 'border-line bg-card')}>
            <SlidersHorizontal size={17} />Filters{activeFilters.length ? ` · ${activeFilters.length}` : ''}
          </button>
          {SORTS.map((s) => (
            <button key={s.value} onClick={() => set('sort', s.value)} className={cx('h-11 flex-none rounded-full border px-4 text-[15px] font-semibold transition active:scale-95', sort === s.value ? 'border-secondary bg-secondary text-white' : 'border-line bg-card text-ink')}>
              {s.label}{sortPrice[s.value] && sort === s.value ? <span className="ml-1.5 text-[13px] font-medium text-white/75">from {money(sortPrice[s.value])}</span> : null}
            </button>
          ))}
        </div>

        <div className="min-w-0 space-y-4">
          {activeFilters.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {activeFilters.map((k) => <button key={k} className="chip h-9 text-[13px]" onClick={() => set(k, '')}>{k === 'category' ? catName(params.get(k)) : `${FILTER_LABEL[k] || k}: ${params.get(k)}`} <X size={13} /></button>)}
              <button className="h-9 px-2 text-[13px] font-bold text-primary" onClick={() => setParams((p) => { const n = new URLSearchParams(p); activeFilters.forEach((k) => n.delete(k)); return n; })}>Clear all</button>
            </div>
          )}

          {insight && !isDeals && (
            <div className="flex items-start gap-3 rounded-brand-lg border border-primary/25 bg-primary-soft/60 p-4 text-[15px] leading-snug">
              <TrendingDown size={20} className="mt-0.5 flex-none text-primary" />
              <p><b className="text-secondary">Price insight · </b>{insight}</p>
            </div>
          )}

          {loading && !data && Array.from({ length: 3 }).map((_, i) => <PropertyRowSkeleton key={i} />)}
          {error && <ErrorState error={error} onRetry={reload} />}
          {!loading && data?.length === 0 && (isDeals
            ? <div className="card"><EmptyState icon={Flame} title="No deals live right now" text="Hotels add fresh offers through the day — check back later, or browse all stays." action={<Button onClick={() => setParams((p) => { const n = new URLSearchParams(p); n.delete('category'); n.delete('deals'); return n; })}>Browse all stays</Button>} /></div>
            : <div className="card"><EmptyState title="No stays match your search" text="Try another destination, different dates or fewer filters." /></div>)}
          {data?.map((p) => <PropertyRow key={p._id} p={p} query={query} saved={saved.has(String(p._id))} onToggleSave={feature('wishlist') ? toggleSave : undefined} />)}
          <Pagination meta={meta} onPage={(pg) => setParams((p) => { const n = new URLSearchParams(p); n.set('page', pg); return n; })} />
        </div>
      </div>

      <FilterSheet open={filtersOpen} onClose={() => setFiltersOpen(false)} count={activeFilters.length} total={meta?.total} loading={loading}
        onClear={() => setParams((p) => { const n = new URLSearchParams(p); activeFilters.forEach((k) => n.delete(k)); n.delete('page'); return n; }, { replace: true })}>
        <FilterSplit params={params} set={set} categories={categories} amenities={amenities} priceStats={meta?.priceStats} />
      </FilterSheet>
    </div>
  );
}

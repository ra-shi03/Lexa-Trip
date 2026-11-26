import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { SlidersHorizontal, Sparkles, TrendingDown, X } from 'lucide-react';
import { StaySearchForm } from '../../components/search/SearchForms';
import { PropertyRow, FilterPanel } from '../../components/stay/StayComponents';
import { Container } from '../../components/layout/UserLayout';
import { Drawer, Button, Skeleton, EmptyState, ErrorState, Pagination } from '../../components/ui';
import { useApi } from '../../hooks/useApi';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { useToast } from '../../context/ToastContext';
import { money, plural, dateLabel, cx } from '../../lib/format';

const SORTS = [
  { value: 'recommended', label: 'Best' },
  { value: 'price_asc', label: 'Cheapest' },
  { value: 'rating', label: 'Top rated' },
  { value: 'price_desc', label: 'Price: high to low' },
];

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
  const query = useMemo(() => Object.fromEntries(['checkIn', 'checkOut', 'adults', 'children', 'rooms'].filter((k) => params.get(k)).map((k) => [k, params.get(k)])), [key]);
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

  return (
    <div className="bg-surface/60 pb-10">
      <div className="border-b border-line bg-bg py-4"><Container><StaySearchForm compact /></Container></div>
      <Container className="pt-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-extrabold sm:text-2xl">{meta?.city ? `Stays in ${meta.city.name}` : params.get('city') ? `Results for “${params.get('city')}”` : 'All stays'}</h1>
            <p className="text-sm text-muted">{meta ? `${plural(meta.total, 'property', 'properties')} · ${dateLabel(meta.checkIn)} – ${dateLabel(meta.checkOut)} · ${plural(meta.nights, 'night')}` : ' '}</p>
          </div>
          {params.get('ai') && <span className="badge badge-primary h-7"><Sparkles size={13} />Filters set by Lexa AI from your request</span>}
        </div>

        <div className="grid gap-6 lg:grid-cols-[270px_1fr]">
          <aside className="hidden lg:block">
            <div className="card card-pad sticky top-20">
              <div className="mb-4 flex items-center justify-between"><h2 className="font-bold">Filters</h2>{activeFilters.length > 0 && <button className="text-xs font-bold text-primary" onClick={() => setParams((p) => { const n = new URLSearchParams(p); activeFilters.forEach((k) => n.delete(k)); return n; })}>Clear all</button>}</div>
              <FilterPanel params={params} set={set} categories={categories} amenities={amenities} priceStats={meta?.priceStats} />
            </div>
          </aside>

          <div className="min-w-0 space-y-4">
            {/* Sort tabs with prices (Kayak pattern) */}
            <div className="grid grid-cols-3 overflow-hidden rounded-brand-lg border border-line bg-card">
              {SORTS.slice(0, 3).map((s) => (
                <button key={s.value} onClick={() => set('sort', s.value)} className={cx('border-r border-line px-3 py-3 text-left transition last:border-r-0', sort === s.value ? 'bg-secondary text-white' : 'hover:bg-surface')}>
                  <span className="block text-sm font-bold">{s.label}</span>
                  <span className={cx('block text-xs', sort === s.value ? 'text-white/70' : 'text-muted')}>{sortPrice[s.value] ? `from ${money(sortPrice[s.value])}` : '—'}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 lg:hidden">
              <Button variant="outline" size="sm" icon={SlidersHorizontal} onClick={() => setFiltersOpen(true)}>Filters{activeFilters.length ? ` (${activeFilters.length})` : ''}</Button>
              <select className="input input-sm w-auto" value={sort} onChange={(e) => set('sort', e.target.value)}>{SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select>
            </div>

            {activeFilters.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {activeFilters.map((k) => <button key={k} className="chip h-8 text-xs" onClick={() => set(k, '')}>{k}: {params.get(k)} <X size={12} /></button>)}
              </div>
            )}

            {insight && (
              <div className="flex items-start gap-3 rounded-brand-lg border border-primary/25 bg-primary-soft/60 p-4 text-sm">
                <TrendingDown size={20} className="mt-0.5 flex-none text-primary" />
                <p><b className="text-secondary">Price insight · </b>{insight}</p>
              </div>
            )}

            {loading && !data && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-52" />)}
            {error && <ErrorState error={error} onRetry={reload} />}
            {!loading && data?.length === 0 && <div className="card"><EmptyState title="No stays match your search" text="Try another destination, different dates or fewer filters." /></div>}
            {data?.map((p) => <PropertyRow key={p._id} p={p} query={query} saved={saved.has(String(p._id))} onToggleSave={feature('wishlist') ? toggleSave : undefined} />)}
            <Pagination meta={meta} onPage={(pg) => setParams((p) => { const n = new URLSearchParams(p); n.set('page', pg); return n; })} />
          </div>
        </div>
      </Container>

      <Drawer open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filters" side="left" footer={<Button block onClick={() => setFiltersOpen(false)}>Show {meta?.total ?? ''} results</Button>}>
        <FilterPanel params={params} set={set} categories={categories} amenities={amenities} priceStats={meta?.priceStats} />
      </Drawer>
    </div>
  );
}

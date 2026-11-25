import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Globe, Hotel, Route, FileText, FolderOpen, Folder, ChevronRight, ChevronDown, Plus, MapPin, Layers, Sparkles, AlertTriangle, ExternalLink, Search, Wand2 } from 'lucide-react';
import { PageHeader, StatCard, Button, DataTable, StatusBadge, Tabs, EmptyState, PageLoader, Badge, Alert, Select } from '../../../components/ui';
import { useApi, useDebounce } from '../../../hooks/useApi';
import { api } from '../../../lib/api';
import { useToast } from '../../../context/ToastContext';
import { timeAgo, cx, titleCase } from '../../../lib/format';

export function SeoOverview() {
  const { data, loading } = useApi(() => api.get('/admin/seo/overview'), []);
  const { data: pilot } = useApi(() => api.get('/admin/seo/hotels', { q: 'bamboo', limit: 1 }), []);
  if (loading) return <PageLoader />;
  const sum = (o = {}) => Object.values(o).reduce((a, b) => a + b, 0);
  return (
    <div>
      <PageHeader title="SEO CMS" subtitle="Hierarchical content: India → State → City → Hotel category → Hotels → Itineraries, plus articles. Pages are public & crawlable but not linked from the main navigation." actions={<><Button variant="outline" icon={FolderOpen} to="/admin/seo/explorer">Open explorer</Button><Button icon={Plus} to="/admin/seo/hotels/new">New hotel</Button></>} />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Hotel profiles" value={sum(data.hotels)} icon={Hotel} sub={`${data.hotels.published || 0} published · ${data.hotels.review || 0} in review`} />
        <StatCard label="Itineraries" value={sum(data.itineraries)} icon={Route} tone="navy" sub={`${data.itineraries.published || 0} published`} />
        <StatCard label="Articles" value={sum(data.articles)} icon={FileText} tone="success" sub={`${data.articles.published || 0} published`} />
        <StatCard label="Category pages" value={sum(data.categories)} icon={Layers} tone="warning" />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="card card-pad">
          <p className="mb-3 flex items-center gap-2 font-extrabold"><AlertTriangle size={18} className="text-warning" />Content health</p>
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between"><span>Hotels missing SEO title or meta description</span><Badge tone={data.issues.missingMeta ? 'warning' : 'success'}>{data.issues.missingMeta}</Badge></li>
            <li className="flex justify-between"><span>Published hotels set to noindex</span><Badge tone={data.issues.noindex ? 'warning' : 'success'}>{data.issues.noindex}</Badge></li>
            <li className="flex justify-between"><span>Scheduled to auto-publish</span><Badge tone="primary">{data.issues.scheduled}</Badge></li>
          </ul>
        </div>
        <div className="card card-pad">
          <p className="mb-3 flex items-center gap-2 font-extrabold"><Sparkles size={18} className="text-primary" />Pilot: Rajasthan → Udaipur → Bamboo Saa Resort &amp; Spa</p>
          {pilot?.[0] ? (
            <div className="space-y-3 text-sm">
              <p className="text-muted">Pilot content is seeded as <b>published + noindex</b> with placeholder copy. Replace with verified hotel details, then switch indexing on.</p>
              <div className="flex flex-wrap gap-2"><Button size="sm" to={`/admin/seo/hotels/${pilot[0]._id}`}>Edit pilot hotel</Button><Button size="sm" variant="outline" icon={ExternalLink} href={pilot[0].publicUrl} target="_blank">View public page</Button></div>
            </div>
          ) : <p className="text-sm text-muted">Run the seed to load the pilot hotel.</p>}
        </div>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[['/admin/seo/media', 'Media library', 'Images with alt text, per-folder'], ['/admin/seo/import', 'Bulk import', 'CSV / Excel with dry-run validation'], ['/admin/seo/sitemap', 'Sitemap & Search Console', 'XML sitemaps, GSC submit, verification'], ['/admin/seo/redirects', 'Redirects', 'Automatic 301s on slug changes']].map(([to, t, d]) => <Link key={to} to={to} className="card card-pad transition hover:shadow-card"><p className="font-bold">{t}</p><p className="text-sm text-muted">{d}</p></Link>)}
      </div>
    </div>
  );
}

/** Explorer: India → State → City → Categories / Hotels / Articles */
export function SeoExplorer() {
  const { data: tree, loading, reload } = useApi(() => api.get('/admin/seo/tree'), []);
  const [sp, setSp] = useSearchParams();
  const [openStates, setOpenStates] = useState({});
  const sel = { state: sp.get('state'), city: sp.get('city'), category: sp.get('category') };
  const select = (o) => setSp(Object.fromEntries(Object.entries(o).filter(([, v]) => v)), { replace: true });
  const state = tree?.states.find((s) => s._id === sel.state);
  const city = state?.cities.find((c) => c._id === sel.city);
  useEffect(() => { if (sel.state) setOpenStates((o) => ({ ...o, [sel.state]: true })); }, [sel.state]);

  if (loading) return <PageLoader />;
  return (
    <div>
      <PageHeader title="Content explorer" subtitle="Browse and manage SEO content by location" actions={<Button variant="outline" icon={MapPin} to="/admin/catalog/destinations">Manage states & cities</Button>} />
      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <aside className="card h-fit p-2 lg:sticky lg:top-20 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
          <button onClick={() => select({})} className={cx('flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold', !sel.state && 'bg-primary-soft text-primary')}><Globe size={16} />{tree.country}</button>
          {tree.states.map((s) => (
            <div key={s._id} className="ml-2">
              <button onClick={() => { setOpenStates((o) => ({ ...o, [s._id]: !o[s._id] })); select({ state: s._id }); }} className={cx('flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold', sel.state === s._id && !sel.city && 'bg-primary-soft text-primary')}>
                {openStates[s._id] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}{openStates[s._id] ? <FolderOpen size={15} /> : <Folder size={15} />}<span className="flex-1 truncate text-left">{s.name}</span><span className="text-[11px] text-muted">{s.cities.reduce((a, c) => a + c.hotelCount, 0)}</span>
              </button>
              {openStates[s._id] && s.cities.map((c) => (
                <div key={c._id} className="ml-5">
                  <button onClick={() => select({ state: s._id, city: c._id })} className={cx('flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm', sel.city === c._id && !sel.category ? 'bg-primary-soft font-semibold text-primary' : 'text-ink')}>
                    <MapPin size={14} /><span className="flex-1 truncate text-left">{c.name}</span><span className="text-[11px] text-muted">{c.hotelCount}</span>
                  </button>
                  {sel.city === c._id && c.categories.map((k) => (
                    <button key={k._id} onClick={() => select({ state: s._id, city: c._id, category: k._id })} className={cx('ml-5 flex w-[calc(100%-1.25rem)] items-center gap-1.5 rounded-lg px-2 py-1 text-xs', sel.category === k._id ? 'bg-primary-soft font-semibold text-primary' : 'text-muted')}><Layers size={12} />{k.name}</button>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </aside>
        <section className="min-w-0">
          {!state ? <AllContent /> : !city ? <StatePanel state={state} /> : <CityPanel state={state} city={city} categoryId={sel.category} onChanged={reload} />}
        </section>
      </div>
    </div>
  );
}

function ContentList({ endpoint, params, columns, editPath, empty }) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState(useSearchParams()[0].get('status') || '');
  const [page, setPage] = useState(1);
  const dq = useDebounce(q);
  const key = JSON.stringify(params);
  const { data, meta, loading } = useApi(() => api.get(endpoint, { ...params, q: dq || undefined, status: status || undefined, page }), [key, dq, status, page]);
  const navigate = useNavigate();
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        <div className="relative min-w-[200px] flex-1"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input className="input input-sm pl-9" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <Select size="sm" className="w-40" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} placeholder="All statuses" options={['draft', 'review', 'published', 'archived'].map((s) => ({ value: s, label: titleCase(s) }))} />
      </div>
      <DataTable rows={data} meta={meta} onPage={setPage} loading={loading} onRowClick={(r) => navigate(`${editPath}/${r._id}`)} empty={empty} columns={columns} />
    </div>
  );
}

const hotelCols = [
  { key: 'name', label: 'Hotel', render: (h) => <div><p className="font-semibold">{h.name}</p><p className="text-xs text-muted">{h.city?.name} · {h.categories?.map((c) => c.name).join(', ') || 'No category'}</p></div> },
  { key: 'kw', label: 'Primary keyword', render: (h) => <span className="text-xs">{h.seo?.primaryKeyword || '—'}</span> },
  { key: 'idx', label: 'Index', render: (h) => (h.seo?.robots?.index === false ? <Badge tone="warning">noindex</Badge> : <Badge tone="success">index</Badge>) },
  { key: 'status', label: 'Status', render: (h) => <StatusBadge status={h.status} /> },
  { key: 'updatedAt', label: 'Updated', render: (h) => timeAgo(h.updatedAt) },
  { key: 'url', label: '', render: (h) => h.status === 'published' && <a href={h.publicUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-primary"><ExternalLink size={15} /></a> },
];
const articleCols = [
  { key: 'title', label: 'Article', render: (a) => <div><p className="font-semibold">{a.title}</p><p className="text-xs text-muted">{a.city?.name || a.state?.name}</p></div> },
  { key: 'status', label: 'Status', render: (a) => <StatusBadge status={a.status} /> },
  { key: 'updatedAt', label: 'Updated', render: (a) => timeAgo(a.updatedAt) },
  { key: 'url', label: '', render: (a) => a.status === 'published' && <a href={a.publicUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-primary"><ExternalLink size={15} /></a> },
];

function AllContent() {
  const [tab, setTab] = useState('hotels');
  return (
    <div className="card card-pad">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-extrabold">All content · India</h2><div className="flex gap-2"><Button size="sm" icon={Plus} to="/admin/seo/hotels/new">Hotel</Button><Button size="sm" variant="outline" icon={Plus} to="/admin/seo/articles/new">Article</Button></div></div>
      <Tabs className="mb-4" value={tab} onChange={setTab} tabs={[{ value: 'hotels', label: 'Hotels' }, { value: 'articles', label: 'Articles' }]} />
      {tab === 'hotels' ? <ContentList endpoint="/admin/seo/hotels" params={{}} columns={hotelCols} editPath="/admin/seo/hotels" /> : <ContentList endpoint="/admin/seo/articles" params={{}} columns={articleCols} editPath="/admin/seo/articles" />}
    </div>
  );
}

function StatePanel({ state }) {
  return (
    <div className="space-y-6">
      <div className="card card-pad flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-wide text-muted">State</p><h2 className="text-xl font-extrabold">{state.name}</h2><p className="text-sm text-muted">{state.cities.length} cities · public hub: <a className="text-primary" href={`/blog/${state.slug}/`} target="_blank" rel="noreferrer">/blog/{state.slug}/</a></p></div>
        <div className="flex gap-2"><Button size="sm" variant="outline" to={`/admin/seo/locations/State/${state._id}`}>Edit state SEO</Button><Button size="sm" icon={Plus} to={`/admin/seo/articles/new?state=${state._id}`}>State article</Button></div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{state.cities.map((c) => <Link key={c._id} to={`?state=${state._id}&city=${c._id}`} className="card card-pad transition hover:shadow-card"><p className="font-bold">{c.name}</p><p className="text-sm text-muted">{c.hotelCount} hotels · {c.categoryCount} categories · {c.articleCount} articles</p></Link>)}</div>
      <div className="card card-pad"><p className="mb-3 font-bold">Articles in {state.name}</p><ContentList endpoint="/admin/seo/articles" params={{ state: state._id }} columns={articleCols} editPath="/admin/seo/articles" /></div>
    </div>
  );
}

function CityPanel({ state, city, categoryId, onChanged }) {
  const [tab, setTab] = useState('hotels');
  const toast = useToast();
  const category = city.categories.find((c) => c._id === categoryId);
  const generate = async () => { try { const r = await api.post(`/admin/seo/cities/${city._id}/generate-categories`); toast.success(r.message); onChanged(); } catch (e) { toast.error(e); } };
  return (
    <div className="space-y-4">
      <div className="card card-pad flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-wide text-muted">{state.name} › {category ? `${city.name} › Category` : 'City'}</p><h2 className="text-xl font-extrabold">{category ? category.name : city.name}</h2><p className="text-sm text-muted">Public: <a className="text-primary" target="_blank" rel="noreferrer" href={category ? `/hotels/${state.slug}/${city.slug}/${category.slug}/` : `/hotels/${state.slug}/${city.slug}/`}>{category ? `/hotels/${state.slug}/${city.slug}/${category.slug}/` : `/hotels/${state.slug}/${city.slug}/`}</a></p></div>
        <div className="flex flex-wrap gap-2">
          {category ? <Button size="sm" variant="outline" to={`/admin/seo/locations/HotelCategory/${category._id}`}>Edit category page</Button> : <Button size="sm" variant="outline" to={`/admin/seo/locations/City/${city._id}`}>Edit city SEO</Button>}
          <Button size="sm" icon={Plus} to={`/admin/seo/hotels/new?state=${state._id}&city=${city._id}${category ? `&category=${category._id}` : ''}`}>Add hotel</Button>
        </div>
      </div>
      {!category && (
        <Tabs value={tab} onChange={setTab} tabs={[{ value: 'hotels', label: `Hotels (${city.hotelCount})` }, { value: 'categories', label: `Categories (${city.categoryCount})` }, { value: 'articles', label: `Articles (${city.articleCount})` }]} />
      )}
      <div className="card card-pad">
        {(category || tab === 'hotels') && <ContentList endpoint="/admin/seo/hotels" params={{ city: city._id, ...(category ? { categories: category._id } : {}) }} columns={hotelCols} editPath="/admin/seo/hotels" empty={<EmptyState icon={Hotel} title="No hotels yet" action={<Button to={`/admin/seo/hotels/new?state=${state._id}&city=${city._id}`} icon={Plus}>Add hotel</Button>} />} />}
        {!category && tab === 'categories' && (
          <div>
            <div className="mb-3 flex justify-end gap-2"><Button size="sm" variant="outline" icon={Wand2} onClick={generate}>Generate default categories</Button><Button size="sm" icon={Plus} to={`/admin/seo/locations/HotelCategory/new?state=${state._id}&city=${city._id}`}>Custom category</Button></div>
            <div className="divide-y divide-line rounded-brand border border-line">{city.categories.map((k) => <Link key={k._id} to={`/admin/seo/locations/HotelCategory/${k._id}`} className="flex items-center justify-between px-4 py-3 text-sm hover:bg-surface"><span className="font-semibold">{k.name}</span><StatusBadge status={k.status} /></Link>)}{!city.categories.length && <p className="p-4 text-sm text-muted">No categories — generate 5-Star / 4-Star / 3-Star / Luxury Resorts with one click.</p>}</div>
          </div>
        )}
        {!category && tab === 'articles' && <><div className="mb-3 flex justify-end"><Button size="sm" icon={Plus} to={`/admin/seo/articles/new?state=${state._id}&city=${city._id}`}>New article</Button></div><ContentList endpoint="/admin/seo/articles" params={{ city: city._id }} columns={articleCols} editPath="/admin/seo/articles" /></>}
      </div>
    </div>
  );
}

export function useLocations(stateId) {
  const { data: states } = useApi(() => api.get('/admin/seo/states', { limit: 200, sort: 'name' }), []);
  const { data: cities } = useApi(() => api.get('/admin/seo/cities', { limit: 200, state: stateId, sort: 'name' }), [stateId], { enabled: Boolean(stateId) });
  return useMemo(() => ({ states: states || [], cities: stateId ? cities || [] : [] }), [states, cities, stateId]);
}

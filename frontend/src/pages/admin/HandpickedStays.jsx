import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Save, Plus, Trash2, ChevronUp, ChevronDown, Search, BedDouble, EyeOff } from 'lucide-react';
import { PageHeader, Button, Input, Toggle, PageLoader, Badge, Alert, IconButton, EmptyState, Img } from '../../components/ui';
import { SortOrder } from '../../components/editor/SortOrder';
import { api } from '../../lib/api';
import { money } from '../../lib/format';
import { useSettings } from '../../context/SettingsContext';
import { useToast } from '../../context/ToastContext';

const MAX = 12; // same limit as the server

const row = (p) => ({ _id: p._id, name: p.name, city: p.address?.city?.name, type: p.category?.name, image: p.images?.[0]?.url, price: p.minPrice, live: p.status === 'approved' && p.isVisible !== false });

/**
 * Admin → Catalogue → Handpicked stays (master admin + sub-admins with `properties`).
 * Which stays the app / website home shows in that row, in what order and under what title.
 */
export function HandpickedStays() {
  const { homeSections, reload } = useSettings();
  const toast = useToast();
  const [saved, setSaved] = useState(null);
  const [form, setForm] = useState(null);
  const [q, setQ] = useState('');
  const [found, setFound] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([api.get('/admin/settings'), api.get('/admin/properties', { flag: 'featured', limit: 50 }), api.get('/public/home')])
      .then(([settings, list, home]) => {
        const cfg = settings.data.featuredStays;
        const order = cfg.order || [];
        const live = home.data.featured.map((p) => p._id);
        // saved order first; anything not in it follows the order guests see today
        const rank = (p) => {
          const i = order.indexOf(p._id);
          if (i >= 0) return i;
          const j = live.indexOf(p._id);
          return order.length + (j >= 0 ? j : live.length);
        };
        const value = { enabled: cfg.enabled !== false, title: cfg.title || '', subtitle: cfg.subtitle || '', items: [...list.data].sort((a, b) => rank(a) - rank(b)).map(row) };
        setSaved(value);
        setForm(value);
      })
      .catch((e) => toast.error(e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // search approved properties to add (debounced)
  useEffect(() => {
    let off = false;
    const t = setTimeout(() => {
      api.get('/admin/properties', { status: 'approved', limit: 24, ...(q.trim() && { q: q.trim() }) })
        .then(({ data }) => { if (!off) setFound(data.map(row)); })
        .catch((e) => toast.error(e));
    }, q ? 450 : 0);
    return () => { off = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  if (!form) return <PageLoader />;

  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const { items } = form;
  const full = items.length >= MAX;
  const moveTo = (from, to) => { const next = [...items]; const [r] = next.splice(from, 1); next.splice(to, 0, r); set({ items: next }); };
  const chosen = new Set(items.map((i) => i._id));
  const available = (found || []).filter((p) => p.live && !chosen.has(p._id));
  const shown = items.filter((i) => i.live).slice(0, MAX);
  const shownIds = new Set(shown.map((i) => i._id));
  const hiddenByLayout = homeSections?.find((s) => s.key === 'featured_properties')?.enabled === false;

  const save = async () => {
    setBusy(true);
    try {
      const { data } = await api.put('/admin/settings/featuredStays', { ...form, items: items.map((i) => i._id) });
      const value = { ...form, title: data.featuredStays.title, subtitle: data.featuredStays.subtitle };
      setSaved(value);
      setForm(value);
      toast.success('Saved — the app and website update right away');
      reload();
    } catch (e) { toast.error(e); } finally { setBusy(false); }
  };

  return (
    <div>
      <PageHeader
        title="Handpicked stays"
        subtitle="Choose the stays shown on the customer app and website home screen, and the order they appear in."
        actions={(
          <div className="flex items-center gap-2 whitespace-nowrap">
            {dirty && <Badge tone="warning">Unsaved</Badge>}
            {dirty && <Button variant="ghost" onClick={() => setForm(saved)}>Discard</Button>}
            <Button icon={Save} loading={busy} disabled={!dirty} onClick={save}>Save changes</Button>
          </div>
        )}
      />

      {hiddenByLayout && <Alert tone="warning" title="Hidden by the home page layout">“Featured stays” is switched off in Settings → Home page content, so guests don’t see it even when it is on here.</Alert>}

      <div className="mt-4 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <section className="card card-pad space-y-4">
            <Toggle label="Show this section" description="Turn off to hide the whole row from the home screen." checked={form.enabled} onChange={(enabled) => set({ enabled })} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="Title" maxLength={40} value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder="Handpicked stays" />
              <Input label="Subtitle (website only)" maxLength={80} value={form.subtitle} onChange={(e) => set({ subtitle: e.target.value })} />
            </div>
          </section>

          <section className="card card-pad">
            <h2 className="font-extrabold">Shown on home <span className="text-sm font-semibold text-muted">{items.length} of {MAX}</span></h2>
            <p className="text-xs text-muted">Type a sort order number (1 = first) or use the arrows. These stays also carry the “Featured” badge.</p>

            {!items.length && <EmptyState icon={BedDouble} title="No stays yet" text="Add stays from the list below. With none selected the section is hidden." />}
            <ul className="mt-3 divide-y divide-line">
              {items.map((p, i) => (
                <li key={p._id} className="flex items-center gap-3 py-2">
                  <SortOrder position={i + 1} count={items.length} label={`Sort order of ${p.name}`} onMove={(n) => moveTo(i, n - 1)} />
                  <Img src={p.image} alt="" className="h-12 w-16 flex-none rounded-brand" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{p.name}</p>
                    <p className="truncate text-xs text-muted">{[p.city, p.type, p.price ? `from ${money(p.price)}` : ''].filter(Boolean).join(' · ')}</p>
                    {!shownIds.has(p._id) && <Badge tone="warning">{p.live ? `Not shown — only the first ${MAX} appear` : 'Not live — not shown'}</Badge>}
                  </div>
                  <div className="flex flex-none items-center">
                    <IconButton icon={ChevronUp} label="Move up" disabled={i === 0} className="disabled:opacity-30" onClick={() => moveTo(i, i - 1)} />
                    <IconButton icon={ChevronDown} label="Move down" disabled={i === items.length - 1} className="disabled:opacity-30" onClick={() => moveTo(i, i + 1)} />
                    <IconButton icon={Trash2} label={`Remove ${p.name}`} className="hover:text-danger" onClick={() => set({ items: items.filter((x) => x._id !== p._id) })} />
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="card card-pad">
            <h2 className="font-extrabold">Add a stay</h2>
            <label className="mt-3 flex h-11 items-center gap-2 rounded-brand border border-line bg-surface px-3 text-sm focus-within:border-primary">
              <Search size={15} className="text-muted" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by property, city, area or vendor" aria-label="Search properties" className="min-w-0 flex-1 bg-transparent outline-none" />
            </label>
            {full && <p className="mt-2 text-xs text-warning">You’ve reached {MAX}. Remove one to add another.</p>}
            <ul className="mt-2 max-h-72 divide-y divide-line overflow-y-auto">
              {available.map((p) => (
                <li key={p._id} className="flex items-center gap-3 py-2">
                  <Img src={p.image} alt="" className="h-10 w-14 flex-none rounded-brand" />
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{p.name}</p><p className="truncate text-xs text-muted">{[p.city, p.type].filter(Boolean).join(' · ')}</p></div>
                  <Button size="xs" variant="outline" icon={Plus} disabled={full} aria-label={`Add ${p.name}`} onClick={() => set({ items: [...items, p] })}>Add</Button>
                </li>
              ))}
            </ul>
            {found && !available.length && <p className="mt-2 text-sm text-muted">{q.trim() ? `No other approved property matches “${q}”.` : 'Every approved property is already added.'}</p>}
            <p className="mt-3 text-xs text-muted">Only approved, visible properties can be added. Manage them in <Link to="/admin/properties" className="font-semibold text-primary">Properties</Link>.</p>
          </section>
        </div>

        <aside className="card card-pad xl:sticky xl:top-20">
          <h2 className="font-extrabold">App preview</h2>
          {form.enabled && !hiddenByLayout && shown.length ? (
            <div className="mt-3">
              <p className="text-lg font-extrabold">{form.title || 'Handpicked stays'}</p>
              <div className="mt-2 flex gap-3 overflow-x-auto pb-1">
                {shown.map((p) => (
                  <div key={p._id} className="w-40 flex-none">
                    <Img src={p.image} alt="" className="h-28 w-full rounded-brand-lg" />
                    <p className="mt-1.5 truncate text-sm font-bold">{p.name}</p>
                    <p className="truncate text-xs text-muted">{p.city}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-3 flex items-center gap-2 text-sm text-muted"><EyeOff size={16} />This section is hidden from guests.</p>
          )}
        </aside>
      </div>
    </div>
  );
}

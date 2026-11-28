import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Save, Plus, Trash2, ChevronUp, ChevronDown, Search, MapPin, EyeOff } from 'lucide-react';
import { PageHeader, Button, Input, Toggle, PageLoader, Badge, Alert, IconButton, EmptyState, Img } from '../../components/ui';
import { SquareImage } from '../../components/panel/ImageUploader';
import { SortOrder } from '../../components/editor/SortOrder';
import { api } from '../../lib/api';
import { useSettings } from '../../context/SettingsContext';
import { useToast } from '../../context/ToastContext';

const MAX = 12; // same limit as the server

/**
 * Admin → Catalogue → Popular destinations (master admin + sub-admins with `catalog`).
 * Which cities the app / website home shows, in what order, under what title and with which card photo.
 */
export function PopularDestinations() {
  const { homeSections, reload } = useSettings();
  const toast = useToast();
  const [cities, setCities] = useState([]);
  const [saved, setSaved] = useState(null);
  const [form, setForm] = useState(null);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([api.get('/admin/settings'), api.get('/admin/seo/cities', { limit: 200, sort: 'name' })])
      .then(([settings, list]) => {
        const cfg = settings.data.popularDestinations;
        // never curated yet → start from what guests see today (cities flagged popular)
        const items = cfg.items || list.data.filter((c) => c.isPopular && c.isActive).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)).slice(0, MAX).map((c) => ({ city: c._id, image: '' }));
        const known = new Set(list.data.map((c) => c._id));
        const value = { enabled: cfg.enabled !== false, title: cfg.title || '', subtitle: cfg.subtitle || '', items: items.filter((i) => known.has(i.city)) };
        setCities(list.data);
        setSaved(value);
        setForm(value);
      })
      .catch((e) => toast.error(e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const byId = useMemo(() => Object.fromEntries(cities.map((c) => [c._id, c])), [cities]);
  if (!form) return <PageLoader />;

  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const { items } = form;
  const full = items.length >= MAX;
  // sort order = place in the list; moving to a position shifts the others along
  const moveTo = (from, to) => { const next = [...items]; const [row] = next.splice(from, 1); next.splice(to, 0, row); set({ items: next }); };
  const chosen = new Set(items.map((i) => i.city));
  const term = q.trim().toLowerCase();
  const available = cities.filter((c) => c.isActive && !chosen.has(c._id) && (!term || `${c.name} ${c.state?.name || ''}`.toLowerCase().includes(term)));
  const photo = (i) => i.image || byId[i.city]?.image;
  const hiddenByLayout = homeSections?.find((s) => s.key === 'popular_destinations')?.enabled === false;

  const save = async () => {
    setBusy(true);
    try {
      const { data } = await api.put('/admin/settings/popularDestinations', form);
      const value = { ...form, ...data.popularDestinations };
      setSaved(value);
      setForm(value);
      toast.success('Saved — the app and website update right away');
      reload();
    } catch (e) { toast.error(e); } finally { setBusy(false); }
  };

  return (
    <div>
      <PageHeader
        title="Popular destinations"
        subtitle="Choose the cities shown on the customer app and website home screen, and the order they appear in."
        actions={(
          <div className="flex items-center gap-2 whitespace-nowrap">
            {dirty && <Badge tone="warning">Unsaved</Badge>}
            {dirty && <Button variant="ghost" onClick={() => setForm(saved)}>Discard</Button>}
            <Button icon={Save} loading={busy} disabled={!dirty} onClick={save}>Save changes</Button>
          </div>
        )}
      />

      {hiddenByLayout && <Alert tone="warning" title="Hidden by the home page layout">“Popular destinations” is switched off in Settings → Home page content, so guests don’t see it even when it is on here.</Alert>}

      <div className="mt-4 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <section className="card card-pad space-y-4">
            <Toggle label="Show this section" description="Turn off to hide the whole row from the home screen." checked={form.enabled} onChange={(enabled) => set({ enabled })} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="Title" maxLength={40} value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder="Popular destinations" />
              <Input label="Subtitle (website only)" maxLength={80} value={form.subtitle} onChange={(e) => set({ subtitle: e.target.value })} />
            </div>
          </section>

          <section className="card card-pad">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-extrabold">Shown on home <span className="text-sm font-semibold text-muted">{items.length} of {MAX}</span></h2>
              <p className="w-full text-xs text-muted">Type a sort order number (1 = first) or use the arrows. Card photo: 800 × 1000 px (4:5). Leave empty to use the city photo.</p>
            </div>

            {!items.length && <EmptyState icon={MapPin} title="No destinations yet" text="Add cities from the list below. With none selected the section is hidden." />}
            <ul className="mt-3 divide-y divide-line">
              {items.map((item, i) => {
                const city = byId[item.city];
                return (
                  <li key={item.city} className="flex items-center gap-3 py-2">
                    <SortOrder position={i + 1} count={items.length} label={`Sort order of ${city?.name}`} onMove={(n) => moveTo(i, n - 1)} />
                    <SquareImage compact size={48} aspect={1.25} value={photo(item)} uploadUrl="/admin/uploads/images"
                      onChange={(image) => set({ items: items.map((x, n) => (n === i ? { ...x, image } : x)) })} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold">{city?.name}</p>
                      <p className="truncate text-xs text-muted">{city?.state?.name}</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {city && !city.isActive && <Badge tone="warning">Inactive city — not shown</Badge>}
                        {item.image && <Badge tone="primary">Custom photo</Badge>}
                      </div>
                    </div>
                    <div className="flex flex-none items-center">
                      <IconButton icon={ChevronUp} label="Move up" disabled={i === 0} className="disabled:opacity-30" onClick={() => moveTo(i, i - 1)} />
                      <IconButton icon={ChevronDown} label="Move down" disabled={i === items.length - 1} className="disabled:opacity-30" onClick={() => moveTo(i, i + 1)} />
                      <IconButton icon={Trash2} label={`Remove ${city?.name}`} className="hover:text-danger" onClick={() => set({ items: items.filter((_, n) => n !== i) })} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="card card-pad">
            <h2 className="font-extrabold">Add a destination</h2>
            <label className="mt-3 flex h-11 items-center gap-2 rounded-brand border border-line bg-surface px-3 text-sm focus-within:border-primary">
              <Search size={15} className="text-muted" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search city or state" aria-label="Search city or state" className="min-w-0 flex-1 bg-transparent outline-none" />
            </label>
            {full && <p className="mt-2 text-xs text-warning">You’ve reached {MAX}. Remove one to add another.</p>}
            <div className="mt-3 flex max-h-64 flex-wrap gap-2 overflow-y-auto">
              {available.map((c) => (
                <button key={c._id} type="button" disabled={full} onClick={() => set({ items: [...items, { city: c._id, image: '' }] })}
                  className="flex items-center gap-2 rounded-full border border-line py-1.5 pl-3 pr-3.5 text-sm font-semibold transition hover:border-primary hover:text-primary disabled:pointer-events-none disabled:opacity-40">
                  <Plus size={14} />{c.name}<span className="text-xs font-normal text-muted">{c.state?.name}</span>
                </button>
              ))}
              {!available.length && <p className="text-sm text-muted">{term ? `No other city matches “${q}”.` : 'Every active city is already added.'}</p>}
            </div>
            <p className="mt-3 text-xs text-muted">City missing? Add it in <Link to="/admin/catalog/destinations" className="font-semibold text-primary">Destinations</Link> first.</p>
          </section>
        </div>

        <aside className="card card-pad xl:sticky xl:top-20">
          <h2 className="font-extrabold">App preview</h2>
          {form.enabled && !hiddenByLayout && items.some((i) => byId[i.city]?.isActive) ? (
            <div className="mt-3">
              <p className="text-lg font-extrabold">{form.title || 'Popular destinations'}</p>
              <div className="mt-2 flex gap-3 overflow-x-auto pb-1">
                {items.filter((i) => byId[i.city]?.isActive).map((i) => (
                  <div key={i.city} className="relative h-44 w-32 flex-none overflow-hidden rounded-brand-lg">
                    <Img src={photo(i)} alt="" className="absolute inset-0 h-full w-full" />
                    <div className="absolute inset-0 bg-gradient-to-t from-secondary/90 via-transparent to-transparent" />
                    <p className="absolute bottom-0 p-2.5 text-sm font-extrabold text-white">{byId[i.city].name}</p>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted">Guests also see the number of stays and the starting price on each card.</p>
            </div>
          ) : (
            <p className="mt-3 flex items-center gap-2 text-sm text-muted"><EyeOff size={16} />This section is hidden from guests.</p>
          )}
        </aside>
      </div>
    </div>
  );
}

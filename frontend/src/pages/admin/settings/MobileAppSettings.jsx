import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Save, Plus, Trash2, ChevronUp, ChevronDown, Pencil, LayoutGrid, Smartphone, GalleryHorizontalEnd, ArrowUpRight, Undo2, Search, Bell, EyeOff, Images } from 'lucide-react';
import { PageHeader, Button, Input, Textarea, Toggle, ColorField, PageLoader, Badge, Tabs, IconButton, EmptyState } from '../../../components/ui';
import { SquareImage } from '../../../components/panel/ImageUploader';
import { IconPicker } from '../../../components/editor/IconPicker';
import { DynIcon } from '../../../components/stay/StayComponents';
import { api } from '../../../lib/api';
import { cx } from '../../../lib/format';
import { SERVICE_TYPES, serviceType, serviceOn, tileLabel, visibleServices } from '../../../lib/quickServices';
import { useSettings } from '../../../context/SettingsContext';
import { useToast } from '../../../context/ToastContext';

const MAX_TILES = 8;
const MAX_SLIDES = 6;
const UPLOAD = '/admin/uploads/images';
const LINKS = [
  ['/admin/settings/appearance', 'Logo, colours & fonts'],
  ['/admin/settings/features', 'Turn services on / off'],
  ['/admin/settings/home', 'Hero slideshow & AI banner'],
  ['/admin/banners', 'Offer banners'],
  ['/admin/catalog/categories', 'Category photos'],
  ['/admin/catalog/destinations', 'Destination photos'],
];

const move = (arr, i, d) => { const a = [...arr]; [a[i], a[i + d]] = [a[i + d], a[i]]; return a; };

/** Tile artwork: uploaded image, else the chosen icon on the soft brand square — same as the app. */
function TileArt({ t, size = 44, iconSize = 22 }) {
  return t.image
    ? <img src={t.image} alt="" className="flex-none rounded-2xl object-cover" style={{ width: size, height: size }} />
    : <span className="grid flex-none place-items-center rounded-2xl bg-primary-soft text-primary" style={{ width: size, height: size }}><DynIcon name={t.icon} size={iconSize} /></span>;
}

/** Admin → Settings → Mobile app: quick services, splash, onboarding — tabbed editor + live phone preview. */
export function MobileAppSettings() {
  const { reload, feature, ai, brand } = useSettings();
  const toast = useToast();
  const [app, setApp] = useState(null);
  const [saved, setSaved] = useState('');
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('services');
  const [openTile, setOpenTile] = useState(null);
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    api.get('/admin/settings').then(({ data }) => { setApp(data.app || {}); setSaved(JSON.stringify(data.app || {})); }).catch((e) => toast.error(e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // load once — re-running would overwrite unsaved edits
  const dirty = app !== null && JSON.stringify(app) !== saved;
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  if (!app) return <PageLoader />;

  const tiles = app.quickServices || [];
  const splash = app.splash || {};
  const ob = app.onboarding || { enabled: true, slides: [] };
  const slides = ob.slides || [];
  const sectionOn = app.quickServicesEnabled !== false;
  const setTiles = (quickServices) => setApp({ ...app, quickServices });
  const setTile = (i, patch) => setTiles(tiles.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const setSplash = (patch) => setApp({ ...app, splash: { ...splash, ...patch } });
  const setOb = (patch) => setApp({ ...app, onboarding: { ...ob, ...patch } });
  const setSlides = (next) => setOb({ slides: next });

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/admin/settings/app', app);
      setSaved(JSON.stringify(app));
      toast.success('Saved — live in the app now');
      reload();
    } catch (e) { toast.error(e); } finally { setSaving(false); }
  };

  const tabs = [
    { value: 'services', label: 'Quick services', icon: LayoutGrid, count: sectionOn ? tiles.length : 'Off' },
    { value: 'splash', label: 'Splash screen', icon: Smartphone },
    { value: 'onboarding', label: 'Onboarding', icon: GalleryHorizontalEnd, count: slides.length },
  ];

  return (
    <div>
      <PageHeader
        title="Mobile app"
        subtitle="What guests see in the customer app. Saved changes appear instantly — no app update or refresh needed."
        actions={(
          <div className="flex items-center gap-2 whitespace-nowrap">
            {dirty && <Badge tone="warning">Unsaved</Badge>}
            <Button variant="ghost" icon={Undo2} disabled={!dirty || saving} onClick={() => { setApp(JSON.parse(saved)); setOpenTile(null); }}>Discard</Button>
            <Button icon={Save} loading={saving} disabled={!dirty} onClick={save}>Save changes</Button>
          </div>
        )}
      />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_330px]">
        <section className="card overflow-visible">
          <Tabs tabs={tabs} value={tab} onChange={setTab} className="px-4 sm:px-5" />
          <div className="p-4 sm:p-5">
            {tab === 'services' && (
              <ServicesTab sectionOn={sectionOn} setSectionOn={(v) => setApp({ ...app, quickServicesEnabled: v })} tiles={tiles} setTiles={setTiles} setTile={setTile} openTile={openTile} setOpenTile={setOpenTile} feature={feature} aiName={ai?.assistantName} />
            )}
            {tab === 'splash' && <SplashTab splash={splash} setSplash={setSplash} brandTagline={brand?.tagline} />}
            {tab === 'onboarding' && <OnboardingTab ob={ob} slides={slides} setOb={setOb} setSlides={setSlides} slide={slide} setSlide={setSlide} />}
          </div>
        </section>

        <aside className="space-y-4 xl:sticky xl:top-6">
          <div className="card card-pad">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-extrabold">Live preview</h2>
              <span className="text-xs font-semibold text-muted">{dirty ? 'Not saved yet' : 'Live'}</span>
            </div>
            <Phone>
              {tab === 'services' && <ServicesPreview tiles={sectionOn ? visibleServices(tiles, feature, ai?.assistantName) : []} off={!sectionOn} brand={brand} />}
              {tab === 'splash' && <SplashPreview splash={splash} brand={brand} />}
              {tab === 'onboarding' && <OnboardingPreview ob={ob} slides={slides} index={Math.min(slide, Math.max(slides.length - 1, 0))} />}
            </Phone>
          </div>
          <div className="card card-pad">
            <h2 className="mb-2 text-sm font-extrabold">Also shapes the app</h2>
            <div className="grid grid-cols-2 gap-1.5 xl:grid-cols-1">
              {LINKS.map(([to, t]) => (
                <Link key={to} to={to} className="group flex items-center justify-between gap-2 rounded-brand px-2.5 py-2 text-sm font-semibold text-ink transition hover:bg-surface hover:text-primary">
                  {t}<ArrowUpRight size={15} className="flex-none text-muted transition group-hover:text-primary" />
                </Link>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

// ───────────────────────── Quick services ─────────────────────────
function ServicesTab({ sectionOn, setSectionOn, tiles, setTiles, setTile, openTile, setOpenTile, feature, aiName }) {
  const add = () => {
    setTiles([...tiles, { key: 'custom', label: '', link: '', icon: 'compass', image: '', enabled: true }]);
    setOpenTile(tiles.length);
  };
  return (
    <div className="space-y-4">
      <div className={cx('flex flex-col gap-3 rounded-brand border p-3.5 sm:flex-row sm:items-center sm:justify-between', sectionOn ? 'border-line' : 'border-warning/40 bg-warning/5')}>
        <Toggle label="Show quick services in the app" description={sectionOn ? 'The tile row under the home search bar is visible to guests' : 'Hidden — guests don’t see this row. Your tiles are kept.'} checked={sectionOn} onChange={setSectionOn} />
        <Button size="sm" variant="soft" icon={Plus} disabled={tiles.length >= MAX_TILES} onClick={add} className="flex-none">Add tile</Button>
      </div>
      <p className="text-sm text-muted">Up to 4 tiles per row. Click a tile to edit it; use the arrows to reorder; the switch on each tile shows or hides just that tile.</p>

      {!tiles.length && <EmptyState icon={LayoutGrid} title="No tiles yet" text="Add Stays, Buses, Flights or a custom link." action={<Button size="sm" icon={Plus} onClick={add}>Add tile</Button>} />}

      <div className={cx('space-y-2.5 transition', !sectionOn && 'opacity-60')}>
        {tiles.map((t, i) => {
          const open = openTile === i;
          const off = !serviceOn(t, feature);
          const type = serviceType(t.key);
          return (
            <div key={i} className={cx('rounded-brand border bg-card transition', open ? 'border-primary shadow-card' : 'border-line hover:border-ink/20', t.enabled === false && !open && 'opacity-60')}>
              <div className="flex items-center gap-2 p-2.5 sm:gap-3 sm:p-3">
                <div className="flex flex-col">
                  <button type="button" disabled={i === 0} onClick={() => { setTiles(move(tiles, i, -1)); if (open) setOpenTile(i - 1); }} className="rounded p-0.5 text-muted hover:text-ink disabled:opacity-25" aria-label="Move up"><ChevronUp size={15} /></button>
                  <button type="button" disabled={i === tiles.length - 1} onClick={() => { setTiles(move(tiles, i, 1)); if (open) setOpenTile(i + 1); }} className="rounded p-0.5 text-muted hover:text-ink disabled:opacity-25" aria-label="Move down"><ChevronDown size={15} /></button>
                </div>
                <button type="button" onClick={() => setOpenTile(open ? null : i)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  <TileArt t={t} />
                  <span className="min-w-0">
                    <span className="block truncate font-bold">{tileLabel(t, aiName)}</span>
                    <span className="block truncate text-xs text-muted">{type.label} · {t.link || <span className="text-danger">no link — hidden</span>}</span>
                  </span>
                </button>
                {off && <span className="hidden sm:inline"><Badge tone="warning"><EyeOff size={12} />Service off</Badge></span>}
                <Toggle checked={t.enabled !== false} onChange={(v) => setTile(i, { enabled: v })} />
                <IconButton icon={open ? ChevronUp : Pencil} size={16} label={open ? 'Close' : 'Edit'} onClick={() => setOpenTile(open ? null : i)} />
                <IconButton icon={Trash2} size={16} label="Remove" className="hover:!text-danger" onClick={() => { setTiles(tiles.filter((_, j) => j !== i)); setOpenTile(null); }} />
              </div>

              {open && (
                <div className="grid gap-4 border-t border-line p-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <p className="field-label">Opens</p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                      {SERVICE_TYPES.map((st) => {
                        const active = (t.key || 'custom') === st.value;
                        return (
                          <button key={st.value} type="button" onClick={() => setTile(i, { key: st.value, link: st.link || (active ? t.link : ''), icon: st.icon })}
                            className={cx('flex items-center justify-center gap-2 rounded-brand border px-3 py-2.5 text-sm font-semibold transition',
                              active ? 'border-primary bg-primary-soft text-primary' : 'border-line text-ink hover:border-primary/50')}>
                            <DynIcon name={st.icon} size={16} />{st.label}
                          </button>
                        );
                      })}
                    </div>
                    {off && <p className="mt-2 text-xs font-semibold text-warning">This service is switched off in App features, so guests don’t see this tile.</p>}
                  </div>
                  <Input label="Label" maxLength={14} placeholder={tileLabel({ ...t, label: '' }, aiName)} hint={`${(t.label || '').length}/14 · empty = “${tileLabel({ ...t, label: '' }, aiName)}”`} value={t.label || ''} onChange={(e) => setTile(i, { label: e.target.value })} />
                  <Input label="Link" placeholder="/search?city=Goa" hint="App path (/offers, /search?city=Goa) or a full https:// URL" value={t.link || ''} onChange={(e) => setTile(i, { link: e.target.value.trim() })} />
                  <div>
                    <IconPicker label="Icon" value={t.icon} onChange={(icon) => setTile(i, { icon })} />
                    {t.image && <p className="mt-1.5 text-xs text-muted">Not shown while a custom image is set.</p>}
                  </div>
                  <div>
                    <p className="field-label">Custom image <span className="font-medium text-muted">(optional)</span></p>
                    <SquareImage value={t.image} onChange={(image) => setTile(i, { image })} uploadUrl={UPLOAD} size={56} hint="1:1 · 176 × 176 px · transparent PNG" />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ───────────────────────── Splash ─────────────────────────
function SplashTab({ splash, setSplash, brandTagline }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <p className="text-sm text-muted sm:col-span-2">Shown for a moment while the app opens: your logo on a background colour or photo.</p>
      <div>
        <ColorField label="Background colour" placeholder="Brand gradient" value={splash.background || ''} onChange={(v) => setSplash({ background: v })} />
        <p className="mt-1.5 text-xs text-muted">{splash.background ? <button type="button" className="font-semibold text-primary" onClick={() => setSplash({ background: '' })}>Use brand gradient instead</button> : 'Empty = brand gradient from Theme & branding'}</p>
      </div>
      <Input label="Show for (seconds)" type="number" min={1} max={6} step={0.2} hint="1 – 6 seconds" value={splash.seconds ?? 1.8} onChange={(e) => setSplash({ seconds: Number(e.target.value) })} />
      <div>
        <p className="field-label">Background photo <span className="font-medium text-muted">(optional)</span></p>
        <SquareImage value={splash.image} onChange={(image) => setSplash({ image })} uploadUrl={UPLOAD} size={54} aspect={16 / 9} hint="Portrait 9:16 · 1080 × 1920 px · shown at 50% over the colour" />
      </div>
      <div className="space-y-3 rounded-brand border border-line p-3.5">
        <Toggle label="Show tagline" description="A short line under the logo" checked={splash.showTagline !== false} onChange={(v) => setSplash({ showTagline: v })} />
        {splash.showTagline !== false && (
          <Input label="Tagline" maxLength={60} placeholder={brandTagline || 'Book. Explore. Repeat.'} value={splash.tagline || ''} onChange={(e) => setSplash({ tagline: e.target.value })}
            hint={`${(splash.tagline || '').length}/60 · empty = brand tagline${brandTagline ? ` (“${brandTagline}”)` : ''}`} />
        )}
      </div>
    </div>
  );
}

// ───────────────────────── Onboarding ─────────────────────────
function OnboardingTab({ ob, slides, setOb, setSlides, slide, setSlide }) {
  const setSl = (i, patch) => setSlides(slides.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const add = () => { setSlides([...slides, { image: '', title: '', text: '' }]); setSlide(slides.length); };
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-brand border border-line p-3.5 sm:flex-row sm:items-center sm:justify-between">
        <Toggle label="Show onboarding" description="Swipeable intro shown once, on first launch, before login" checked={ob.enabled !== false} onChange={(v) => setOb({ enabled: v })} />
        <Button size="sm" variant="soft" icon={Plus} disabled={slides.length >= MAX_SLIDES} onClick={add} className="flex-none">Add slide</Button>
      </div>

      <p className="text-sm text-muted">Click a photo to upload. Use <b className="text-ink">3:4 portrait photos, 1080 × 1440 px</b> — the top of the screen shows the photo, the text sits below it.</p>

      {!slides.length && <EmptyState icon={Images} title="No slides" text="Add up to 6 slides with a photo, a title and one line of text." />}

      <div className={cx('space-y-2.5', ob.enabled === false && 'opacity-60')}>
        {slides.map((sl, i) => (
          <div key={i} onFocusCapture={() => setSlide(i)} onClick={() => setSlide(i)}
            className={cx('grid grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-brand border p-3 transition sm:grid-cols-[auto_auto_minmax(0,1fr)_auto]', slide === i ? 'border-primary shadow-card' : 'border-line')}>
            <span className={cx('grid h-7 w-7 place-items-center self-start rounded-full text-xs font-extrabold', slide === i ? 'bg-primary text-white' : 'bg-surface text-muted')}>{i + 1}</span>
            <div className="sm:order-none">
              <SquareImage compact value={sl.image} onChange={(image) => setSl(i, { image })} uploadUrl={UPLOAD} size={72} aspect={4 / 3} />
            </div>
            <div className="col-span-2 grid gap-2 sm:col-span-1">
              <Input placeholder="Title — e.g. Discover stays you’ll love" maxLength={40} value={sl.title || ''} onChange={(e) => setSl(i, { title: e.target.value })} aria-label={`Slide ${i + 1} title`} />
              <Textarea rows={2} placeholder="One short line about this benefit" maxLength={110} value={sl.text || ''} onChange={(e) => setSl(i, { text: e.target.value })} aria-label={`Slide ${i + 1} text`} />
            </div>
            <div className="col-span-2 flex justify-end gap-0.5 sm:col-span-1 sm:flex-col sm:justify-start">
              <IconButton icon={ChevronUp} size={16} label="Move up" disabled={i === 0} className="disabled:opacity-25" onClick={(e) => { e.stopPropagation(); setSlides(move(slides, i, -1)); setSlide(i - 1); }} />
              <IconButton icon={ChevronDown} size={16} label="Move down" disabled={i === slides.length - 1} className="disabled:opacity-25" onClick={(e) => { e.stopPropagation(); setSlides(move(slides, i, 1)); setSlide(i + 1); }} />
              <IconButton icon={Trash2} size={16} label="Remove" className="hover:!text-danger" onClick={(e) => { e.stopPropagation(); setSlides(slides.filter((_, j) => j !== i)); setSlide(Math.max(0, i - 1)); }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ───────────────────────── Preview ─────────────────────────
function Phone({ children }) {
  return (
    <div className="mx-auto w-[260px] rounded-[38px] bg-ink p-[7px] shadow-pop">
      <div className="relative h-[500px] overflow-hidden rounded-[31px] bg-bg">
        <span className="absolute left-1/2 top-2 z-20 h-[18px] w-20 -translate-x-1/2 rounded-full bg-ink" />
        {children}
      </div>
    </div>
  );
}

function ServicesPreview({ tiles, off, brand }) {
  const cols = Math.min(tiles.length, 4) || 1;
  return (
    <div className="h-full overflow-hidden">
      <div className="rounded-b-[22px] bg-secondary px-3.5 pb-4 pt-9 text-white">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <img src={brand?.markUrl || '/lexatrip-mark.jpg'} alt="" className="h-7 w-7 rounded-full bg-white object-cover" />
            <span className="leading-tight"><span className="block text-[9px] text-white/70">Welcome 👋</span><span className="block text-[10px] font-bold">All India</span></span>
          </span>
          <span className="grid h-6 w-6 place-items-center rounded-full bg-white/20"><Bell size={11} /></span>
        </div>
        <p className="mt-4 text-[15px] font-extrabold">Where to next?</p>
        <div className="mt-2.5 flex h-8 items-center gap-2 rounded-full bg-white px-3 text-[10px] text-muted"><Search size={11} />Search by city</div>
      </div>
      {tiles.length ? (
        <div className="grid gap-1.5 px-3 pt-3.5" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {tiles.map((t, n) => (
            <div key={n} className="flex flex-col items-center gap-1 rounded-xl border border-line bg-card py-2 shadow-sm">
              <TileArt t={t} size={28} iconSize={14} />
              <span className="line-clamp-1 px-0.5 text-[9px] font-bold">{t.label}</span>
            </div>
          ))}
        </div>
      ) : <p className="mx-3 mt-3.5 rounded-xl border border-dashed border-line px-3 py-3 text-center text-[10px] text-muted">{off ? 'Quick services are switched off' : 'No visible tiles — the row is hidden'}</p>}
      <div className="px-3 pt-4">
        <p className="mb-2 text-[11px] font-extrabold">Browse by type</p>
        <div className="flex gap-2">{[0, 1, 2, 3].map((n) => <span key={n} className="h-11 w-11 flex-none rounded-xl bg-surface" />)}</div>
        <p className="mb-2 mt-4 text-[11px] font-extrabold">Offers for you</p>
        <div className="flex gap-2"><span className="h-16 w-36 flex-none rounded-xl bg-surface" /><span className="h-16 w-20 flex-none rounded-xl bg-surface" /></div>
      </div>
    </div>
  );
}

function SplashPreview({ splash, brand }) {
  return (
    <div className="relative grid h-full place-items-center text-white" style={{ background: splash.background || 'linear-gradient(160deg, var(--lt-secondary) 0%, color-mix(in srgb, var(--lt-secondary) 70%, var(--lt-primary)) 100%)' }}>
      {splash.image && <img src={splash.image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-50" />}
      <div className="relative flex flex-col items-center px-6 text-center">
        <img src={brand?.markUrl || '/lexatrip-mark.jpg'} alt="" className="h-20 w-20 rounded-full bg-white object-cover p-1 shadow-pop" />
        <p className="mt-4 font-display text-xl font-extrabold">{brand?.appName}</p>
        {splash.showTagline !== false && <p className="mt-1 text-[11px] text-white/80">{splash.tagline || brand?.tagline}</p>}
      </div>
      <span className="absolute bottom-4 text-[10px] text-white/60">{splash.seconds ?? 1.8}s</span>
    </div>
  );
}

function OnboardingPreview({ ob, slides, index }) {
  const s = slides[index];
  if (ob.enabled === false || !s) {
    return <div className="grid h-full place-items-center px-6 text-center text-xs text-muted">{ob.enabled === false ? 'Onboarding is off — the app goes straight to login.' : 'Add a slide to preview it.'}</div>;
  }
  return (
    <div className="flex h-full flex-col">
      <div className="relative flex-1 overflow-hidden">
        {s.image ? <img src={s.image} alt="" className="absolute inset-0 h-full w-full object-cover" /> : <div className="absolute inset-0 grid place-items-center bg-surface text-xs text-muted">No photo</div>}
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/10 to-transparent" />
        <span className="absolute right-3 top-8 rounded-full bg-black/35 px-2.5 py-1 text-[10px] font-semibold text-white">Skip</span>
      </div>
      <div className="px-5 pb-5 pt-1 text-center">
        <p className="text-[15px] font-extrabold leading-tight">{s.title || 'Slide title'}</p>
        <p className="mt-1.5 min-h-[2.2rem] text-[11px] text-muted">{s.text || 'Slide text'}</p>
        <div className="my-3 flex justify-center gap-1">{slides.map((_, n) => <span key={n} className={cx('h-1 rounded-full', n === index ? 'w-5 bg-primary' : 'w-1 bg-line')} />)}</div>
        <span className="block rounded-full bg-primary py-2 text-[11px] font-bold text-white">{index === slides.length - 1 ? 'Get started' : 'Next'}</span>
      </div>
    </div>
  );
}

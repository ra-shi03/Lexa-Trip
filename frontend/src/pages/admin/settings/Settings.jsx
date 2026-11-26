import { useEffect, useState } from 'react';
import { ArrowUp, ArrowDown, Save, RotateCcw, CheckCircle2, XCircle, Search, BedDouble, Sparkles } from 'lucide-react';
import { PageHeader, Button, Input, Select, Toggle, ColorField, PageLoader, Alert, Badge } from '../../../components/ui';
import { SingleImage } from '../../../components/panel/ImageUploader';
import { Repeater } from '../../../components/editor/Repeater';
import { Link } from 'react-router';
import { api } from '../../../lib/api';
import { useSettings, applyTheme } from '../../../context/SettingsContext';
import { useToast } from '../../../context/ToastContext';
import { useAuth } from '../../../context/AuthContext';
import { titleCase } from '../../../lib/format';

function useAdminSettings() {
  const [s, setS] = useState(null);
  const load = () => api.get('/admin/settings').then(({ data }) => setS(data));
  useEffect(() => { load(); }, []);
  return [s, setS, load];
}
async function saveSection(section, value, toast, reloadPublic) {
  try { await api.put(`/admin/settings/${section}`, value); toast.success('Saved — live for all users'); reloadPublic(); } catch (e) { toast.error(e); }
}

const PRESETS = {
  'LexaTrip (logo)': { primary: '#F26B1D', primaryHover: '#D9560B', primarySoft: '#FFF1E8', secondary: '#14213D', accent: '#F7931E' },
  'Sunset coral': { primary: '#FF5A36', primaryHover: '#E2431F', primarySoft: '#FFEFEA', secondary: '#1B1F3B', accent: '#FFB020' },
  'Ocean blue': { primary: '#0A6CFF', primaryHover: '#0052D6', primarySoft: '#EAF2FF', secondary: '#0B1B3F', accent: '#00B3A4' },
  'Forest': { primary: '#17915A', primaryHover: '#0F7748', primarySoft: '#E8F6EF', secondary: '#12261E', accent: '#F2A900' },
};
const FONTS = ['Plus Jakarta Sans', 'Inter', 'Manrope', 'DM Sans', 'Poppins', 'Montserrat', 'Outfit', 'Nunito Sans', 'Work Sans'];

export function AppearanceSettings() {
  const [s, setS] = useAdminSettings();
  const { reload } = useSettings();
  const toast = useToast();
  if (!s) return <PageLoader />;
  const theme = s.theme;
  const setTheme = (patch) => { const t = { ...theme, ...patch }; setS({ ...s, theme: t }); applyTheme(t); };
  const setBrand = (k, v) => setS({ ...s, brand: { ...s.brand, [k]: v } });
  const moveSection = (i, d) => { const arr = [...s.homeSections]; [arr[i], arr[i + d]] = [arr[i + d], arr[i]]; setS({ ...s, homeSections: arr }); };

  return (
    <div>
      <PageHeader title="Theme & branding" subtitle="Changes apply instantly to the website, guest app, vendor and admin panels" actions={<Button icon={Save} onClick={async () => { await saveSection('theme', theme, toast, reload); await saveSection('brand', s.brand, toast, reload); await saveSection('homeSections', s.homeSections, toast, reload); }}>Save all</Button>} />
      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <div className="space-y-6">
          <section className="card card-pad">
            <h2 className="mb-1 font-extrabold">Colour presets</h2>
            <p className="mb-4 text-sm text-muted">Start from a preset, then fine-tune below.</p>
            <div className="flex flex-wrap gap-3">
              {Object.entries(PRESETS).map(([name, p]) => (
                <button key={name} onClick={() => setTheme(p)} className="flex items-center gap-2 rounded-brand border border-line px-3 py-2 text-sm font-semibold hover:border-ink">
                  <span className="flex"><span className="h-5 w-5 rounded-full" style={{ background: p.primary }} /><span className="-ml-1.5 h-5 w-5 rounded-full border-2 border-white" style={{ background: p.secondary }} /></span>{name}
                </button>
              ))}
            </div>
          </section>
          <section className="card card-pad">
            <h2 className="mb-4 font-extrabold">Colours</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[['primary', 'Primary (buttons, links)'], ['primaryHover', 'Primary hover'], ['primarySoft', 'Primary tint'], ['secondary', 'Secondary (headings, navy)'], ['accent', 'Accent'], ['background', 'Page background'], ['surface', 'Surface'], ['text', 'Text'], ['muted', 'Muted text'], ['border', 'Borders'], ['success', 'Success'], ['danger', 'Danger']].map(([k, l]) => <ColorField key={k} label={l} value={theme[k]} onChange={(v) => setTheme({ [k]: v })} />)}
            </div>
          </section>
          <section className="card card-pad grid gap-4 sm:grid-cols-2">
            <h2 className="font-extrabold sm:col-span-2">Typography & shape</h2>
            <Select label="Body font" value={theme.fontFamily} onChange={(e) => setTheme({ fontFamily: e.target.value })} options={FONTS} />
            <Select label="Heading font" value={theme.headingFontFamily} onChange={(e) => setTheme({ headingFontFamily: e.target.value })} options={FONTS} />
            <Input label={`Corner radius (${theme.radius}px)`} type="range" min={0} max={24} value={theme.radius} onChange={(e) => setTheme({ radius: Number(e.target.value) })} />
            <Select label="Mode" value={theme.mode} onChange={(e) => setTheme({ mode: e.target.value })} options={[{ value: 'light', label: 'Light (white background)' }, { value: 'dark', label: 'Dark' }, { value: 'system', label: 'Follow device' }]} />
          </section>
          <section className="card card-pad grid gap-4 sm:grid-cols-2">
            <h2 className="font-extrabold sm:col-span-2">Brand</h2>
            <Input label="App name" value={s.brand.appName} onChange={(e) => setBrand('appName', e.target.value)} />
            <Input label="Tagline" value={s.brand.tagline} onChange={(e) => setBrand('tagline', e.target.value)} />
            <Input label="Support email" value={s.brand.supportEmail} onChange={(e) => setBrand('supportEmail', e.target.value)} />
            <Input label="Support phone" value={s.brand.supportPhone} onChange={(e) => setBrand('supportPhone', e.target.value)} />
            <SingleImage label="Logo mark (square)" value={s.brand.markUrl ? { url: s.brand.markUrl } : null} onChange={(v) => setBrand('markUrl', v?.url || '')} uploadUrl="/admin/uploads/images" />
            <SingleImage label="Favicon / app icon source (square, 512×512 PNG recommended)" value={s.brand.faviconUrl ? { url: s.brand.faviconUrl } : null} onChange={(v) => setBrand('faviconUrl', v?.url || '')} uploadUrl="/admin/uploads/images" />
            <SingleImage label="Full logo" value={s.brand.logoUrl ? { url: s.brand.logoUrl } : null} onChange={(v) => setBrand('logoUrl', v?.url || '')} uploadUrl="/admin/uploads/images" />
          </section>
          <section className="card card-pad">
            <h2 className="mb-1 font-extrabold">Home screen layout</h2>
            <p className="mb-4 text-sm text-muted">Order and visibility of home sections on web and app.</p>
            <div className="divide-y divide-line rounded-brand border border-line">
              {s.homeSections.map((sec, i) => (
                <div key={sec.key} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="flex flex-col"><button disabled={i === 0} onClick={() => moveSection(i, -1)} className="text-muted disabled:opacity-30" aria-label="Move up"><ArrowUp size={14} /></button><button disabled={i === s.homeSections.length - 1} onClick={() => moveSection(i, 1)} className="text-muted disabled:opacity-30" aria-label="Move down"><ArrowDown size={14} /></button></div>
                  <span className="flex-1 text-sm font-semibold">{sec.label}</span>
                  <Toggle checked={sec.enabled} onChange={(v) => setS({ ...s, homeSections: s.homeSections.map((x, j) => (j === i ? { ...x, enabled: v } : x)) })} />
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Live preview */}
        <aside className="xl:sticky xl:top-20 xl:h-fit">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Live preview</p>
          <div className="overflow-hidden rounded-[28px] border-[6px] border-secondary bg-bg shadow-pop">
            <div className="flex items-center gap-2 border-b border-line px-4 py-3"><img src={s.brand.markUrl} alt="" className="h-7 w-7 rounded-full" /><span className="font-display text-sm font-extrabold"><span className="text-secondary">{s.brand.appName?.slice(0, 4).toUpperCase()}</span> <span className="text-primary">{s.brand.appName?.slice(4).toUpperCase()}</span></span></div>
            <div className="space-y-4 p-4">
              <h3 className="text-2xl font-extrabold">Where to next<span className="text-primary">?</span></h3>
              <div className="search-bar flex-col"><div className="search-cell"><label>Where</label><span className="text-sm font-bold">Udaipur</span></div><button className="search-go h-11 w-full"><Search size={18} /></button></div>
              <div className="flex gap-2"><span className="chip active">Stays</span><span className="chip">Buses</span></div>
              <div className="card flex gap-3 p-3"><span className="grid h-14 w-16 place-items-center rounded-lg bg-primary-soft text-primary"><BedDouble /></span><div className="flex-1"><p className="text-sm font-bold">Lakeside Haveli</p><p className="text-xs text-muted">Udaipur · 4★</p><p className="text-sm font-extrabold">₹4,200 <span className="text-xs font-normal text-muted">/night</span></p></div></div>
              <button className="btn btn-primary btn-block">View deal</button>
              <div className="flex items-center gap-2 rounded-brand bg-secondary p-3 text-sm font-semibold text-white"><Sparkles size={16} className="text-accent" />Plan with Lexa AI</div>
            </div>
          </div>
          <Button variant="ghost" size="sm" icon={RotateCcw} className="mt-3" onClick={() => setTheme(PRESETS['LexaTrip (logo)'])}>Reset to LexaTrip logo colours</Button>
        </aside>
      </div>
    </div>
  );
}

const FEATURE_GROUPS = [
  ['Services', [['hotels', 'Hotels & stays booking'], ['buses', 'Bus booking (subject to API)'], ['flights', 'Flight booking (subject to API)']]],
  ['Lexa AI', [['aiAssistant', 'AI chat assistant (guest web & app)'], ['aiSmartSearch', 'Natural-language smart search'], ['aiTripPlanner', 'AI trip / itinerary planner'], ['aiReviewSummary', 'AI review summaries on property pages']]],
  ['Guest experience', [['wishlist', 'Saved stays / wishlist'], ['reviews', 'Ratings & reviews'], ['coupons', 'Coupons & offers'], ['savedTravellers', 'Saved travellers'], ['priceInsights', 'Price insights on search'], ['mapView', 'Map on property page'], ['supportTickets', 'In-app support tickets']]],
  ['Booking model', [['requestToBook', 'Request-to-book (vendor approval for every booking)'], ['payAtHotel', 'Pay at hotel (coming soon)'], ['maintenanceMode', 'Maintenance mode (guest site offline)']]],
];

export function FeatureSettings() {
  const [s, setS] = useAdminSettings();
  const { reload } = useSettings();
  const toast = useToast();
  if (!s) return <PageLoader />;
  const f = s.features;
  return (
    <div>
      <PageHeader title="App features" subtitle="Turn modules on/off for the website and the guest app — no release needed" actions={<Button icon={Save} onClick={() => saveSection('features', f, toast, reload)}>Save</Button>} />
      <div className="grid gap-6 lg:grid-cols-2">
        {FEATURE_GROUPS.map(([g, items]) => (
          <section key={g} className="card card-pad space-y-4"><h2 className="font-extrabold">{g}</h2>{items.map(([k, l]) => <Toggle key={k} label={l} checked={f[k] !== false && Boolean(f[k] ?? true)} onChange={(v) => setS({ ...s, features: { ...f, [k]: v } })} />)}</section>
        ))}
        <section className="card card-pad space-y-4">
          <h2 className="font-extrabold">Booking rules</h2>
          <Input label="Payment hold (minutes)" type="number" value={s.booking.holdMinutes} onChange={(e) => setS({ ...s, booking: { ...s.booking, holdMinutes: Number(e.target.value) } })} hint="Rooms/seats are held while the guest pays" />
          <Input label="Max rooms per booking" type="number" value={s.booking.maxRoomsPerBooking} onChange={(e) => setS({ ...s, booking: { ...s.booking, maxRoomsPerBooking: Number(e.target.value) } })} />
          <Input label="Max nights per stay" type="number" value={s.booking.maxNights} onChange={(e) => setS({ ...s, booking: { ...s.booking, maxNights: Number(e.target.value) } })} />
          <Input label="Convenience fee (₹ per booking)" type="number" value={s.booking.convenienceFee} onChange={(e) => setS({ ...s, booking: { ...s.booking, convenienceFee: Number(e.target.value) } })} />
          <Button size="sm" onClick={() => saveSection('booking', s.booking, toast, reload)}>Save booking rules</Button>
        </section>
      </div>
    </div>
  );
}

export function IntegrationSettings() {
  const [s, setS] = useAdminSettings();
  const { reload } = useSettings();
  const toast = useToast();
  if (!s) return <PageLoader />;
  const st = s.integrationStatus;
  const i = s.integrations;
  const setI = (k, patch) => setS({ ...s, integrations: { ...i, [k]: { ...i[k], ...patch } } });
  const Row = ({ name, ok, detail }) => <div className="flex items-center justify-between gap-3 py-2.5 text-sm"><span className="font-semibold">{name}</span><span className="flex items-center gap-2 text-muted">{detail}{ok ? <CheckCircle2 size={17} className="text-success" /> : <XCircle size={17} className="text-warning" />}</span></div>;
  return (
    <div>
      <PageHeader title="Integrations" subtitle="Third-party providers. API keys are stored in the server .env file — never in the database or browser." actions={<Button icon={Save} onClick={() => saveSection('integrations', i, toast, reload)}>Save</Button>} />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card card-pad">
          <h2 className="mb-2 font-extrabold">Connection status</h2>
          <div className="divide-y divide-line">
            <Row name="Payment gateway" ok={st.payment.configured} detail={st.payment.provider} />
            <Row name="AI (Gemini)" ok={st.ai.configured} detail={st.ai.configured ? 'connected' : 'rule-based fallback'} />
            <Row name="SMS / OTP" ok={st.sms.configured} detail={st.sms.provider} />
            <Row name="Email (SMTP)" ok={st.email.configured} detail={st.email.configured ? 'configured' : 'console log'} />
            <Row name="Bus API" ok={!st.bus.sandbox} detail={st.bus.provider} />
            <Row name="Flight API" ok={!st.flight.sandbox} detail={st.flight.provider} />
            <Row name="Channel manager" ok={!st.channelManager.sandbox} detail={st.channelManager.provider} />
            <Row name="Google Search Console" ok={st.searchConsole.configured} detail={st.searchConsole.configured ? 'service account' : 'not configured'} />
          </div>
          <Alert className="mt-4">Sandbox providers let you test complete flows. Live APIs (Razorpay, MSG91, STAAH/AxisRooms, bus & flight aggregators) are enabled by adding credentials to <code>backend/.env</code> once the client’s accounts are approved.</Alert>
        </section>
        <section className="card card-pad space-y-4">
          <h2 className="font-extrabold">Lexa AI</h2>
          <Input label="Assistant name" value={i.ai?.assistantName || ''} onChange={(e) => setI('ai', { assistantName: e.target.value })} />
          <Select label="Provider" value={i.ai?.provider || 'gemini'} onChange={(e) => setI('ai', { provider: e.target.value })} options={[{ value: 'gemini', label: 'Google Gemini' }, { value: 'none', label: 'Off (rule-based only)' }]} />
          <Input label="Model" value={i.ai?.model || ''} onChange={(e) => setI('ai', { model: e.target.value })} hint="e.g. gemini-2.5-flash — key: GEMINI_API_KEY in .env" />
          <h2 className="pt-2 font-extrabold">Payments</h2>
          <div><p className="field-label">Enabled payment methods</p><div className="flex flex-wrap gap-2">{['upi', 'card', 'netbanking', 'wallet'].map((m) => { const on = (i.payment?.enabledMethods || []).includes(m); return <button key={m} type="button" className={`chip h-8 text-xs ${on ? 'active' : ''}`} onClick={() => setI('payment', { enabledMethods: on ? i.payment.enabledMethods.filter((x) => x !== m) : [...(i.payment?.enabledMethods || []), m] })}>{titleCase(m)}</button>; })}</div></div>
          <h2 className="pt-2 font-extrabold">Maps</h2>
          <Select label="Map provider" value={i.maps?.provider || 'osm'} onChange={(e) => setI('maps', { provider: e.target.value })} options={[{ value: 'osm', label: 'OpenStreetMap (free)' }, { value: 'google', label: 'Google Maps' }]} />
        </section>
      </div>
    </div>
  );
}

export function BusinessSettings() {
  const [s, setS] = useAdminSettings();
  const { reload } = useSettings();
  const { isMaster } = useAuth();
  const toast = useToast();
  if (!s) return <PageLoader />;
  if (!isMaster) return <Alert tone="warning">Restricted to the master admin.</Alert>;
  const tax = s.tax;
  return (
    <div>
      <PageHeader title="Tax & commission" subtitle="GST slabs and default platform commission" />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card card-pad space-y-4">
          <h2 className="font-extrabold">Hotel GST slabs</h2>
          <Alert tone="warning">Verify current GST rates with your CA before going live.</Alert>
          {tax.hotelSlabs.map((sl, idx) => (
            <div key={idx} className="grid grid-cols-2 gap-3">
              <Input label="Tariff per room-night up to (₹, empty = above)" type="number" value={sl.upTo ?? ''} onChange={(e) => setS({ ...s, tax: { ...tax, hotelSlabs: tax.hotelSlabs.map((x, j) => (j === idx ? { ...x, upTo: e.target.value === '' ? null : Number(e.target.value) } : x)) } })} />
              <Input label="GST %" type="number" value={sl.rate} onChange={(e) => setS({ ...s, tax: { ...tax, hotelSlabs: tax.hotelSlabs.map((x, j) => (j === idx ? { ...x, rate: Number(e.target.value) } : x)) } })} />
            </div>
          ))}
          <div className="grid grid-cols-2 gap-3"><Input label="Bus GST %" type="number" value={tax.busRate} onChange={(e) => setS({ ...s, tax: { ...tax, busRate: Number(e.target.value) } })} /><Input label="Flight GST % (on fare)" type="number" value={tax.flightRate} onChange={(e) => setS({ ...s, tax: { ...tax, flightRate: Number(e.target.value) } })} /></div>
          <Toggle label="Prices entered by vendors already include tax" checked={tax.pricesIncludeTax} onChange={(v) => setS({ ...s, tax: { ...tax, pricesIncludeTax: v } })} />
          <Button size="sm" onClick={() => saveSection('tax', tax, toast, reload)}>Save tax settings</Button>
        </section>
        <section className="card card-pad space-y-4">
          <h2 className="font-extrabold">Default commission</h2>
          <Input label="Default commission % (fallback when no rule matches)" type="number" value={s.commission.defaultRate} onChange={(e) => setS({ ...s, commission: { defaultRate: Number(e.target.value) } })} />
          <Button size="sm" onClick={() => saveSection('commission', s.commission, toast, reload)}>Save</Button>
          <p className="text-sm text-muted">Fine-grained rules (per category, vendor or service) live in <Badge>Revenue → Commission rules</Badge>.</p>
        </section>
      </div>
    </div>
  );
}

export function HomeContentSettings() {
  const [s, setS] = useAdminSettings();
  const { reload } = useSettings();
  const toast = useToast();
  if (!s) return <PageLoader />;
  const home = s.home || {};
  const hero = home.hero || {};
  const setHero = (patch) => setS({ ...s, home: { ...home, hero: { ...hero, ...patch } } });
  const setAi = (patch) => setS({ ...s, home: { ...home, aiBanner: { ...(home.aiBanner || {}), ...patch } } });
  return (
    <div>
      <PageHeader title="Home page content" subtitle="Hero slideshow, headline and AI banner images — live on the website and app after saving" actions={<Button icon={Save} onClick={() => saveSection('home', home, toast, reload)}>Save</Button>} />
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <section className="card card-pad grid gap-4 sm:grid-cols-2">
            <h2 className="font-extrabold sm:col-span-2">Hero text</h2>
            <Input label="Headline" value={hero.headline || ''} onChange={(e) => setHero({ headline: e.target.value })} className="sm:col-span-2" />
            <Input label="Sub-headline" value={hero.subheadline || ''} onChange={(e) => setHero({ subheadline: e.target.value })} className="sm:col-span-2" />
            <Input label={`Image darkness (${Math.round((hero.overlayOpacity ?? 0.55) * 100)}%)`} type="range" min={0.2} max={0.85} step={0.05} value={hero.overlayOpacity ?? 0.55} onChange={(e) => setHero({ overlayOpacity: Number(e.target.value) })} />
            <Input label="Seconds per slide" type="number" min={3} max={20} value={hero.autoplaySeconds || 6} onChange={(e) => setHero({ autoplaySeconds: Number(e.target.value) })} />
          </section>
          <section className="card card-pad grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><h2 className="font-extrabold">Offers carousel</h2><p className="text-sm text-muted">“Offers for you” on the app home slides on its own. Cards come from Banners (placement “Home offers”) and active Coupons.</p></div>
            <label className="flex items-center gap-2.5 text-sm font-semibold"><input type="checkbox" className="h-4 w-4 accent-[var(--lt-primary)]" checked={home.offers?.autoplay !== false} onChange={(e) => setS({ ...s, home: { ...home, offers: { ...home.offers, autoplay: e.target.checked } } })} />Auto-scroll offers</label>
            <Input label="Seconds per card" type="number" min={2} max={15} value={home.offers?.autoplaySeconds || 3} onChange={(e) => setS({ ...s, home: { ...home, offers: { ...home.offers, autoplaySeconds: Number(e.target.value) } } })} />
          </section>
          <section className="card card-pad">
            <h2 className="mb-1 font-extrabold">Hero slideshow</h2>
            <p className="mb-4 text-sm text-muted">Wide landscape photos work best (1920×1080+). Leave empty for the plain gradient hero.</p>
            <Repeater items={hero.slides || []} onChange={(slides) => setHero({ slides })} newItem={() => ({ url: '', title: '', subtitle: '', link: '/search' })} addLabel="Add slide" max={8} render={(sl, u) => (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2"><SingleImage label="Image" value={sl.url ? { url: sl.url } : null} onChange={(v) => u({ url: v?.url || '' })} uploadUrl="/admin/uploads/images" /></div>
                <Input label="Caption" value={sl.title || ''} onChange={(e) => u({ title: e.target.value })} />
                <Input label="Caption (small)" value={sl.subtitle || ''} onChange={(e) => u({ subtitle: e.target.value })} />
                <Input label="Link when clicked" className="sm:col-span-2" value={sl.link || ''} onChange={(e) => u({ link: e.target.value })} placeholder="/search?city=Goa" />
              </div>
            )} />
          </section>
          <section className="card card-pad grid gap-4">
            <h2 className="font-extrabold">Lexa AI banner</h2>
            <Input label="Title" value={home.aiBanner?.title || ''} onChange={(e) => setAi({ title: e.target.value })} />
            <Input label="Text" value={home.aiBanner?.text || ''} onChange={(e) => setAi({ text: e.target.value })} />
            <SingleImage label="Background image" value={home.aiBanner?.image ? { url: home.aiBanner.image } : null} onChange={(v) => setAi({ image: v?.url || '' })} uploadUrl="/admin/uploads/images" />
          </section>
        </div>
        <aside className="card card-pad h-fit space-y-3 text-sm">
          <h2 className="font-extrabold">Other home images</h2>
          {[['/admin/banners', 'Offer banners', 'Deal cards under the hero'], ['/admin/catalog/categories', 'Category images', 'Round photos on category chips'], ['/admin/catalog/destinations', 'Destination photos', 'Popular destination tiles'], ['/admin/settings/appearance', 'Logo & section order', 'Brand logos, show/hide sections']].map(([to, t, d]) => (
            <Link key={to} to={to} className="block rounded-brand border border-line p-3 transition hover:border-primary"><p className="font-bold">{t}</p><p className="text-xs text-muted">{d}</p></Link>
          ))}
        </aside>
      </div>
    </div>
  );
}

// Mobile app editor lives in its own file (tabs + live preview)
export { MobileAppSettings } from './MobileAppSettings';
export { RegionSettings } from './RegionSettings';

export function LoginPageSettings() {
  const [s, setS] = useAdminSettings();
  const { reload } = useSettings();
  const toast = useToast();
  if (!s) return <PageLoader />;
  const a = s.auth || {};
  const set = (patch) => setS({ ...s, auth: { ...a, ...patch } });
  const T = ({ k, label, ...rest }) => <Input label={label} value={a[k] || ''} onChange={(e) => set({ [k]: e.target.value })} {...rest} />;
  return (
    <div>
      <PageHeader title="Login page" subtitle="The Login / Sign up screen of the customer app" actions={<><Button variant="outline" href="/app" target="_blank" rel="noreferrer">Preview</Button><Button icon={Save} onClick={() => saveSection('auth', a, toast, reload)}>Save</Button></>} />
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <section className="card card-pad grid gap-4">
            <h2 className="font-extrabold">Hero photo & logo</h2>
            <SingleImage label="Background photo (portrait works best on phones, landscape on desktop)" value={a.image ? { url: a.image } : null} onChange={(v) => set({ image: v?.url || '' })} uploadUrl="/admin/uploads/images" />
            <Input label={`Photo overlay darkness (${Math.round((a.overlayOpacity ?? 0.3) * 100)}%)`} type="range" min={0} max={0.7} step={0.05} value={a.overlayOpacity ?? 0.3} onChange={(e) => set({ overlayOpacity: Number(e.target.value) })} hint="Higher = better text contrast on bright photos" />
            <Toggle label="Show logo badge on the photo" description="Uses the logo mark from Theme & branding" checked={a.showLogo !== false} onChange={(v) => set({ showLogo: v })} />
          </section>
          <section className="card card-pad grid gap-4 sm:grid-cols-2">
            <h2 className="font-extrabold sm:col-span-2">Welcome screen</h2>
            <T k="welcomeTitle" label="Title" />
            <T k="welcomeText" label="Text" />
            <T k="loginLabel" label="Login button label" />
            <T k="signupLabel" label="Sign up button label" />
          </section>
          <section className="card card-pad grid gap-4 sm:grid-cols-2">
            <h2 className="font-extrabold sm:col-span-2">Form screens</h2>
            <T k="loginHeading" label="Login heading" />
            <T k="loginText" label="Login sub-text" />
            <T k="signupHeading" label="Sign up heading" />
            <T k="signupText" label="Sign up sub-text" />
            <Select label="Email field on Sign up" value={a.emailField || 'optional'} onChange={(e) => set({ emailField: e.target.value })} options={[{ value: 'optional', label: 'Optional' }, { value: 'required', label: 'Required' }, { value: 'hidden', label: 'Hidden' }]} />
          </section>
          <section className="card card-pad">
            <h2 className="mb-1 font-extrabold">Desktop highlights</h2>
            <p className="mb-4 text-sm text-muted">Bullet points shown over the photo on large screens.</p>
            <Repeater compact items={(a.highlights || []).map((v) => ({ v }))} onChange={(arr) => set({ highlights: arr.map((x) => x.v) })} newItem={() => ({ v: '' })} addLabel="Add highlight" max={5} render={(x, u) => <input className="input input-sm" value={x.v} onChange={(e) => u({ v: e.target.value })} />} />
          </section>
        </div>
        <aside className="card card-pad h-fit space-y-3 text-sm">
          <h2 className="font-extrabold">Also controls this page</h2>
          {[['/admin/settings/appearance', 'Logo, app name, tagline, colours, fonts'], ['/admin/pages', 'Terms & Privacy pages linked in Sign up']].map(([to, t]) => <Link key={to} to={to} className="block rounded-brand border border-line p-3 font-semibold transition hover:border-primary">{t}</Link>)}
        </aside>
      </div>
    </div>
  );
}

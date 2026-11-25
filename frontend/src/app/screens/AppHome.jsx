import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Bell, BedDouble, Bus, Plane, Sparkles, Copy, ArrowRight, MapPin, Search, SlidersHorizontal } from 'lucide-react';
import { HeroSlider } from '@/components/home/HeroSlider';
import { PropertyCard, DynIcon } from '@/components/stay/StayComponents';
import { Img, Skeleton, Reveal, Avatar } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { useSettings } from '@/context/SettingsContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { money } from '@/lib/format';

const Head = ({ title, link }) => (
  <div className="mb-3 flex items-end justify-between px-4"><h2 className="text-lg font-extrabold">{title}</h2>{link && <Link to={link} className="flex items-center gap-1 text-sm font-bold text-primary">See all <ArrowRight size={14} /></Link>}</div>
);

const SEARCH_WORDS = ['city', 'destination', 'area', 'property name'];

/** Fixed "Search by" + a word that rotates in a loop; hidden once the user types. */
function RotatingHint({ hidden }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setN((x) => (x + 1) % SEARCH_WORDS.length), 2200);
    return () => clearInterval(t);
  }, []);
  if (hidden) return null;
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 flex items-center gap-1 whitespace-nowrap text-sm text-muted">
      Search by <span key={n} className="hint-word font-semibold text-ink/70">{SEARCH_WORDS[n]}</span>
    </span>
  );
}

/** App home: hero + search card, quick services, categories, offers, destinations, featured stays — all admin-driven. */
export default function AppHome() {
  const { home: cfg, homeSections, feature, ai, brand } = useSettings();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const { data, loading } = useApi(() => api.get('/public/home'), []);
  const hero = cfg?.hero || {};
  // Admin → Banners (placement "home_hero") wins; otherwise fall back to the slides in Settings → Home page
  const bannerSlides = (data?.heroBanners || []).filter((b) => b.image).map((b) => ({ url: b.image, title: b.title, subtitle: b.subtitle, link: b.link }));
  const slides = bannerSlides.length ? bannerSlides : hero.slides?.filter((s) => s.url) || [];
  const on = (k) => homeSections?.find((s) => s.key === k)?.enabled !== false;

  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  // Offers: banners and coupons are interleaved into ONE carousel (so coupons aren't hidden behind a wall of banners)
  const offerCards = useMemo(() => {
    const banners = (data?.offerBanners || []).map((b) => ({ kind: 'banner', id: `b${b._id}`, b }));
    const coupons = feature('coupons') ? (data?.offers || []).map((o) => ({ kind: 'coupon', id: `c${o._id}`, o })) : [];
    const out = [];
    for (let i = 0; i < Math.max(banners.length, coupons.length); i += 1) { if (banners[i]) out.push(banners[i]); if (coupons[i]) out.push(coupons[i]); }
    return out;
  }, [data, feature]);
  const offersRef = useRef(null);
  const pausedUntil = useRef(0);
  const offersCfg = cfg?.offers || {};
  const pauseOffers = () => { pausedUntil.current = Date.now() + 4000; }; // user is interacting: hold still for 4s, then keep flowing
  // Continuous, endless slide: the list is rendered twice and scrollLeft wraps by exactly one set's width
  useEffect(() => {
    const el = offersRef.current;
    if (!el || offersCfg.autoplay === false || offerCards.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    let raf; let last = 0; let pos = el.scrollLeft;
    const step = (t) => {
      const dt = last ? Math.min(t - last, 64) : 0; last = t;
      const first = el.children[0]; const dup = el.children[offerCards.length];
      const loop = first && dup ? dup.offsetLeft - first.offsetLeft : 0;
      if (loop > el.clientWidth) {
        if (Date.now() < pausedUntil.current || document.hidden) pos = el.scrollLeft;
        else {
          const perCard = Math.max(2, Number(offersCfg.autoplaySeconds) || 3); // admin: seconds per card
          pos += (first.offsetWidth + 12) / perCard * (dt / 1000);
        }
        if (pos >= loop) pos -= loop;
        if (el.scrollLeft >= loop) { el.scrollLeft -= loop; pos = el.scrollLeft; }
        el.scrollLeft = pos;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [offerCards, offersCfg.autoplay, offersCfg.autoplaySeconds]);

  const services = [
    feature('hotels') && ['/search', 'Stays', BedDouble],
    feature('buses') && ['/bus', 'Buses', Bus],
    feature('flights') && ['/flights', 'Flights', Plane],
    (feature('aiAssistant') || feature('aiTripPlanner')) && ['/ai', ai?.assistantName?.split(' ')[0] || 'AI', Sparkles],
  ].filter(Boolean);

  return (
    <div className="pb-6">
      <section className="relative isolate overflow-hidden rounded-b-[32px] bg-secondary pb-6 text-white">
        {slides.length > 0 && <HeroSlider captions={false} fade={false} slides={slides} overlay={hero.overlayOpacity ?? 0.6} seconds={hero.autoplaySeconds || 6} />}
        <div className="pt-safe relative px-4 pt-6">
          <div className="mt-5 flex items-center justify-between gap-3">
            <Link to={user ? '/profile' : '/login'} aria-label="Profile" className="flex min-w-0 items-center gap-3">
              <span className="avatar-ring rounded-full"><Avatar name={user?.name || 'Guest'} src={user?.avatar} size={46} /></span>
              <span className="min-w-0 leading-tight">
                <span className="block truncate text-[13px] text-white/80">{user?.name ? `${greet}, ${user.name.split(' ')[0]} 👋` : 'Welcome 👋'}</span>
                <span className="mt-0.5 flex items-center gap-1 text-sm font-bold"><MapPin size={14} className="flex-none" /><span className="truncate">{hero.locationLabel || 'All India'}</span></span>
              </span>
            </Link>
            <Link to={user ? '/account/notifications' : '/login'} aria-label="Notifications" className="bell-btn relative grid h-10 w-10 flex-none place-items-center rounded-full bg-white/20 backdrop-blur transition active:scale-90"><Bell size={18} /><span className="pulse-ring absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-primary" /></Link>
          </div>
          <h1 className="animate-fade-up mt-8 text-[28px] font-extrabold leading-tight !text-white">{hero.headline || 'Where to next?'}</h1>
          <p className="mt-1 text-sm text-white/80">{hero.subheadline || 'Discover stays, buses and flights across India'}</p>
          <form onSubmit={(e) => { e.preventDefault(); const q = new FormData(e.currentTarget).get('q')?.toString().trim(); navigate(q ? `/search?city=${encodeURIComponent(q)}` : '/search'); }} className="search-pill mt-5 flex h-[52px] items-center gap-3 rounded-full bg-white pl-5 pr-2 text-ink shadow-pop">
            <Search size={19} className="flex-none text-muted" />
            <div className="relative min-w-0 flex-1 self-stretch"><RotatingHint hidden={!!q} /><input name="q" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search by city, destination, area or property name" className="h-full w-full bg-transparent text-sm outline-none" /></div>
            <Link to="/search" aria-label="Filters & dates" className="grid h-10 w-10 flex-none place-items-center rounded-full bg-primary-soft text-primary"><SlidersHorizontal size={17} /></Link>
          </form>
        </div>
      </section>

      {services.length > 0 && (
        <div className="relative z-10 grid gap-2.5 px-4 pt-5" style={{ gridTemplateColumns: `repeat(${services.length}, 1fr)` }}>
          {services.map(([to, label, Icon], n) => (
            <Link key={to} to={to} style={{ animationDelay: `${n * 80}ms` }} className="svc-tile chip-pop group flex flex-col items-center gap-2 rounded-brand-lg border border-line bg-card py-3.5 text-xs font-bold shadow-sm transition active:scale-95">
              <span className="svc-icon grid h-11 w-11 place-items-center rounded-2xl bg-primary-soft text-primary transition duration-300 group-hover:rotate-6 group-hover:scale-110 group-hover:bg-primary group-hover:text-white group-active:scale-95"><Icon size={22} /></span>
              <span className="transition group-hover:text-primary">{label}</span>
            </Link>
          ))}
        </div>
      )}

      {on('categories') && data?.categories?.length > 0 && (
        <Reveal><section className="pt-7"><Head title="Browse by type" /><div className="hscroll px-4">
          {data.categories.map((c) => (
            <Link key={c._id} to={`/search?category=${c.slug}`} className="group flex w-[92px] flex-col items-center gap-2 text-center text-xs font-semibold transition active:scale-95">
              {c.image ? <Img src={c.image} alt={c.name} className="h-[72px] w-[72px] rounded-2xl transition duration-300 group-hover:-translate-y-1 group-hover:shadow-pop" /> : <span className="grid h-[72px] w-[72px] place-items-center rounded-2xl bg-primary-soft text-primary transition duration-300 group-hover:-translate-y-1 group-hover:bg-primary group-hover:text-white group-hover:shadow-pop"><DynIcon name={c.icon} size={28} /></span>}
              {c.name}
            </Link>
          ))}
        </div></section></Reveal>
      )}

      {on('offers') && offerCards.length > 0 && (
        <Reveal><section className="pt-7"><Head title="Offers for you" link="/offers" />
          <div ref={offersRef} className="hscroll offers-flow px-4" onPointerDown={pauseOffers} onTouchStart={pauseOffers} onMouseEnter={pauseOffers} onFocus={pauseOffers}>
            {(offerCards.length > 1 && offersCfg.autoplay !== false ? [...offerCards, ...offerCards.map((c) => ({ ...c, id: `${c.id}-dup`, dup: true }))] : offerCards).map((c) => c.kind === 'banner' ? (
              <Link key={c.id} aria-hidden={c.dup || undefined} tabIndex={c.dup ? -1 : undefined} to={c.b.link || '/search'} className="hover-lift group relative block h-40 w-[280px] overflow-hidden rounded-brand-lg">
                <Img src={c.b.image} alt={c.b.title} className="absolute inset-0 h-full w-full transition duration-700 group-hover:scale-110" />
                <div className="absolute inset-0 bg-gradient-to-t from-secondary/90 via-secondary/20 to-transparent" />
                <div className="absolute bottom-0 p-4 text-white"><p className="font-extrabold leading-tight">{c.b.title}</p><p className="text-xs text-white/80">{c.b.subtitle}</p></div>
              </Link>
            ) : (
              <button key={c.id} aria-hidden={c.dup || undefined} tabIndex={c.dup ? -1 : undefined} onClick={() => { navigator.clipboard?.writeText(c.o.code); toast.success(`Code ${c.o.code} copied`); }} className="flex h-40 w-[230px] flex-col justify-between rounded-brand-lg border border-dashed border-primary/60 bg-primary-soft/50 p-4 text-left transition active:scale-[.98]">
                <div><p className="font-extrabold text-secondary">{c.o.title}</p><p className="mt-1 line-clamp-2 text-xs text-muted">{c.o.description}</p></div>
                <span className="flex items-center justify-between rounded-lg bg-card px-3 py-2 text-sm font-bold tracking-wider text-primary">{c.o.code}<Copy size={14} /></span>
              </button>
            ))}
          </div>
        </section></Reveal>
      )}

      {on('popular_destinations') && (
        <section className="pt-7"><Head title="Popular destinations" /><div className="hscroll px-4">
          {loading && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-52 w-40" />)}
          {data?.destinations?.map((c, n) => (
            <Reveal key={c._id} delay={n * 60} scale>
              <Link to={`/search?city=${encodeURIComponent(c.name)}`} className="hover-lift group relative block h-52 w-40 overflow-hidden rounded-brand-lg">
                <Img src={c.image} alt={c.name} className="absolute inset-0 h-full w-full transition duration-700 group-hover:scale-110" />
                <div className="absolute inset-0 bg-gradient-to-t from-secondary/90 via-transparent to-transparent" />
                <div className="absolute bottom-0 p-3 text-white"><p className="font-extrabold">{c.name}</p><p className="text-[11px] text-white/80">{c.propertyCount ? `${c.propertyCount} stays` : c.state?.name}{c.priceFrom ? ` · ${money(c.priceFrom)}+` : ''}</p></div>
              </Link>
            </Reveal>
          ))}
        </div></section>
      )}

      {on('featured_properties') && data?.featured?.length > 0 && (
        <Reveal><section className="pt-7"><Head title="Handpicked stays" link="/search?sort=rating" /><div className="hscroll px-4">
          {data.featured.map((p) => <div key={p._id} className="w-[220px]"><PropertyCard p={p} /></div>)}
        </div></section></Reveal>
      )}
    </div>
  );
}

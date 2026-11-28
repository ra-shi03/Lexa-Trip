import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { Sparkles, ShieldCheck, BadgePercent, Headphones, ArrowRight, Copy, BedDouble, Bus, Plane, Search, CalendarCheck, Luggage, Smartphone, ChevronsDown } from 'lucide-react';
import { SearchHub } from '../../components/search/SearchForms';
import { AiSmartSearch } from '../../components/ai/AiSmartSearch';
import { PropertyCard, DynIcon } from '../../components/stay/StayComponents';
import { Container } from '../../components/layout/UserLayout';
import { Img, Skeleton, Reveal } from '../../components/ui';
import { HeroSlider } from '../../components/home/HeroSlider';
import { useApi } from '../../hooks/useApi';
import { api } from '../../lib/api';
import { useSettings } from '../../context/SettingsContext';
import { useToast } from '../../context/ToastContext';
import { money } from '../../lib/format';

export default function Home() {
  const { homeSections, feature, brand, ai, home: homeCfg, popularDestinations: popular, featuredStays: picks } = useSettings();
  const hero = homeCfg?.hero || {};
  const { data, loading } = useApi(() => api.get('/public/home'), [], { live: ['content', 'settings'] });
  const bannerSlides = (data?.heroBanners || []).filter((b) => b.image).map((b) => ({ url: b.image, title: b.title, subtitle: b.subtitle, link: b.link }));
  const heroSlides = bannerSlides.length ? bannerSlides : hero.slides || [];
  const hasSlides = heroSlides.some((sl) => sl.url);
  const toast = useToast();
  const heroRef = useRef(null);
  const headWords = (hero.headline || 'Where to next?').split(' ');
  // gentle parallax on the hero photo (skipped for reduced motion)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    let raf = 0;
    const onScroll = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => heroRef.current?.style.setProperty('--py', `${Math.min(64, window.scrollY * 0.18)}px`)); };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); };
  }, []);
  const sections = homeSections?.length ? homeSections.filter((s) => s.enabled) : [{ key: 'hero_search' }, { key: 'categories' }, { key: 'ai_banner' }, { key: 'offers' }, { key: 'popular_destinations' }, { key: 'featured_properties' }, { key: 'why_us' }];

  const blocks = {
    hero_search: (
      <section ref={heroRef} className={`relative isolate overflow-hidden ${hasSlides ? 'bg-secondary text-white' : 'bg-gradient-to-b from-primary-soft/70 via-bg to-bg'}`}>
        {hasSlides && (
          <div className="absolute inset-x-0 -top-16 bottom-0 -z-10 will-change-transform" style={{ transform: 'translate3d(0, var(--py, 0px), 0)' }} aria-hidden="true">
            <HeroSlider captions={false} fade={false} slides={heroSlides} overlay={hero.overlayOpacity ?? 0.55} seconds={hero.autoplaySeconds || 6} />
          </div>
        )}
        {hasSlides && <div className="absolute inset-0 -z-10 bg-gradient-to-t from-secondary/80 via-secondary/10 to-secondary/40" aria-hidden="true" />}
        <div className="orb -left-24 top-10 h-72 w-72 bg-primary/25" aria-hidden="true" />
        <div className="orb -right-20 bottom-0 h-80 w-80 bg-primary/15" style={{ animationDelay: '3s' }} aria-hidden="true" />

        <Container className="relative pb-10 pt-10 sm:pb-16 sm:pt-16 lg:pb-24 lg:pt-24">
          <span className={`animate-fade-up inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-bold tracking-wide sm:text-sm ${hasSlides ? 'glass text-white' : 'bg-primary-soft text-primary'}`}>
            <Sparkles size={15} className="text-primary" /> {brand.tagline || 'Book. Explore. Repeat.'}
          </span>
          <h1 className={`mt-5 max-w-4xl text-[38px] font-extrabold leading-[1.05] sm:text-6xl lg:text-7xl ${hasSlides ? '!text-white' : ''}`}>
            {headWords.map((w, n) => (
              <span key={n} className={`word-in mr-[0.28em] ${n === headWords.length - 1 ? 'text-primary' : ''}`} style={{ animationDelay: `${0.1 + n * 0.12}s` }}>{w}</span>
            ))}
          </h1>
          <p className={`animate-fade-up mt-4 max-w-2xl text-base sm:mt-5 sm:text-lg ${hasSlides ? 'text-white/85' : 'text-muted'}`} style={{ animationDelay: '.25s' }}>
            {hero.subheadline || 'Compare hotels, villas, resorts, buses and flights across India.'}
          </p>
          <div className="no-scrollbar animate-fade-up -mx-4 mt-5 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0" style={{ animationDelay: '.35s' }}>
            {[[ShieldCheck, 'Secure payments'], [BadgePercent, 'Prices with taxes upfront'], [Headphones, 'Help on every booking']].map(([Icon, t]) => (
              <span key={t} className={`flex flex-none items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold sm:text-[13px] ${hasSlides ? 'glass text-white' : 'border border-line bg-card text-ink'}`}><Icon size={14} className="text-primary" />{t}</span>
            ))}
          </div>

          <div className="panel-in hero-panel mt-7 rounded-[26px] bg-card/95 p-3 text-ink shadow-pop backdrop-blur sm:mt-9 sm:p-4 lg:p-5">
            <SearchHub />
            <AiSmartSearch />
          </div>
        </Container>

        {hasSlides && <a href="#after-hero" aria-label="Scroll to content" className="absolute bottom-3 left-1/2 hidden -translate-x-1/2 text-white/80 lg:block"><ChevronsDown size={26} className="scroll-cue" /></a>}
      </section>
    ),
    categories: data?.categories?.length > 0 && (
      <Container className="pt-10">
        <div className="no-scrollbar flex gap-3 overflow-x-auto pb-1">
          {data.categories.map((c) => (
            <Link key={c._id} to={`/search?category=${c.slug}`} className="hover-lift flex flex-none items-center gap-2.5 rounded-full border border-line bg-card py-2 pl-2 pr-4 text-sm font-semibold">
              {c.image ? <Img src={c.image} alt={c.name} className="h-9 w-9 rounded-full" /> : <span className="grid h-9 w-9 place-items-center rounded-full bg-primary-soft text-primary"><DynIcon name={c.icon} size={17} /></span>}
              {c.name}
            </Link>
          ))}
        </div>
      </Container>
    ),
    ai_banner: (feature('aiTripPlanner') || feature('aiAssistant')) && (
      <Container className="pt-10">
        <Link to="/ai" className="group relative flex flex-col items-start justify-between gap-4 overflow-hidden rounded-[22px] bg-secondary p-6 text-white sm:flex-row sm:items-center sm:p-10">
          {homeCfg?.aiBanner?.image && <><Img src={homeCfg.aiBanner.image} alt="" className="absolute inset-0 h-full w-full opacity-60 transition duration-700 group-hover:scale-105" /><div className="absolute inset-0 bg-gradient-to-r from-secondary via-secondary/80 to-secondary/30" /></>}
          <div className="relative flex items-start gap-4">
            <span className="float pulse-ring grid h-12 w-12 flex-none place-items-center rounded-2xl bg-primary"><Sparkles size={24} /></span>
            <div>
              <h2 className="text-xl font-extrabold !text-white sm:text-3xl">{homeCfg?.aiBanner?.title || `Plan smarter with ${ai?.assistantName || 'Lexa AI'}`}</h2>
              <p className="mt-1 max-w-xl text-sm text-white/80">{homeCfg?.aiBanner?.text || 'Describe your dream trip in plain words — get a day-wise itinerary and matching stays in seconds.'}</p>
            </div>
          </div>
          <span className="btn btn-primary shine relative flex-none">Try it now <ArrowRight size={18} className="transition group-hover:translate-x-1" /></span>
        </Link>
      </Container>
    ),
    offers: (data?.offerBanners?.length > 0 || (feature('coupons') && data?.offers?.length > 0)) && (
      <Container className="pt-12">
        <SectionHead title="Deals for you" link="/offers" />
        <div className="no-scrollbar -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
          {data.offerBanners?.map((b) => (
            <Link key={b._id} to={b.link || '/search'} className="hover-lift group relative h-48 w-[300px] flex-none snap-start overflow-hidden rounded-brand-lg sm:w-[360px]">
              <Img src={b.image} alt={b.title} className="absolute inset-0 h-full w-full transition duration-700 group-hover:scale-110" />
              <div className="absolute inset-0 bg-gradient-to-t from-secondary/90 via-secondary/30 to-transparent" />
              <div className="absolute bottom-0 p-5 text-white"><p className="text-lg font-extrabold leading-tight">{b.title}</p><p className="text-sm text-white/80">{b.subtitle}</p></div>
            </Link>
          ))}
          {feature('coupons') && data.offers?.map((o) => (
            <div key={o._id} className="flex w-[260px] flex-none snap-start flex-col justify-between rounded-brand-lg border border-dashed border-primary/50 bg-primary-soft/50 p-5">
              <div><p className="font-extrabold text-secondary">{o.title}</p><p className="mt-1 text-xs text-muted line-clamp-2">{o.description}</p></div>
              <button onClick={() => { navigator.clipboard?.writeText(o.code); toast.success(`Code ${o.code} copied`); }} className="mt-4 flex items-center justify-between rounded-lg bg-card px-3 py-2 text-sm font-bold tracking-wider text-primary">
                {o.code} <Copy size={14} />
              </button>
            </div>
          ))}
        </div>
      </Container>
    ),
    popular_destinations: popular?.enabled !== false && (loading || data?.destinations?.length > 0) && (
      <Container className="pt-12">
        <SectionHead title={popular?.title || 'Popular destinations'} subtitle={popular?.subtitle} />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {loading && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="aspect-[4/5]" />)}
          {data?.destinations.map((c, n) => (
            <Reveal key={c._id} delay={n * 70} scale>
              <Link to={`/search?city=${encodeURIComponent(c.name)}`} className="tilt-card group relative block aspect-[4/5] overflow-hidden rounded-brand-lg">
                <Img src={c.image} alt={c.name} className="absolute inset-0 h-full w-full transition duration-700 group-hover:scale-110" />
                <div className="absolute inset-0 bg-gradient-to-t from-secondary/90 via-secondary/10 to-transparent transition group-hover:from-secondary/95" />
                <div className="absolute bottom-0 p-4 text-white transition duration-300 group-hover:-translate-y-1">
                  <p className="text-lg font-extrabold">{c.name}</p>
                  <p className="text-xs text-white/80">{c.propertyCount ? `${c.propertyCount} ${c.propertyCount === 1 ? 'stay' : 'stays'}` : c.state?.name}{c.priceFrom ? ` · from ${money(c.priceFrom)}` : ''}</p>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </Container>
    ),
    featured_properties: picks?.enabled !== false && data?.featured?.length > 0 && (
      <Container className="pt-12">
        <SectionHead title={picks?.title || 'Handpicked stays'} subtitle={picks?.subtitle} link="/search?sort=rating" />
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {data.featured.map((p, n) => <Reveal key={p._id} delay={n * 70}><PropertyCard p={p} /></Reveal>)}
        </div>
      </Container>
    ),
    why_us: (
      <Container className="pt-14">
        <div className="grid gap-4 rounded-[22px] bg-surface p-6 sm:grid-cols-3 sm:p-8">
          {[[ShieldCheck, 'Secure payments', 'PCI-compliant gateway, instant confirmation and e-vouchers.'], [BadgePercent, 'Transparent prices', 'Taxes and fees shown upfront — no surprises at checkout.'], [Headphones, 'Help when you need it', 'Raise a request from any booking and track replies in-app.']].map(([Icon, t, d]) => (
            <div key={t} className="hover-lift flex gap-4 rounded-brand p-3">
              <span className="grid h-11 w-11 flex-none place-items-center rounded-brand bg-card text-primary shadow-card"><Icon size={22} /></span>
              <div><p className="font-bold">{t}</p><p className="mt-0.5 text-sm text-muted">{d}</p></div>
            </div>
          ))}
        </div>
      </Container>
    ),
    services: (
      <Container className="pt-10" id="after-hero">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            feature('hotels') && ['/search', 'Stays', 'Hotels, villas, resorts & homestays', BedDouble, 'from-primary/15'],
            feature('buses') && ['/bus', 'Buses', 'Seat-level booking across routes', Bus, 'from-sky-500/15'],
            feature('flights') && ['/flights', 'Flights', 'Compare fares & book in minutes', Plane, 'from-violet-500/15'],
            (feature('aiAssistant') || feature('aiTripPlanner')) && ['/ai', ai?.assistantName || 'Lexa AI', 'Plan a trip by just describing it', Sparkles, 'from-emerald-500/15'],
          ].filter(Boolean).map(([to, t, d, Icon, tint]) => (
            <Link key={to} to={to} className={`tilt-card group relative overflow-hidden rounded-brand-lg border border-line bg-gradient-to-br ${tint} to-card p-5`}>
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-card text-primary shadow-card transition group-hover:scale-110"><Icon size={24} /></span>
              <p className="mt-4 text-lg font-extrabold">{t}</p>
              <p className="mt-1 text-sm text-muted">{d}</p>
              <ArrowRight size={18} className="absolute right-5 top-5 text-muted transition group-hover:translate-x-1 group-hover:text-primary" />
            </Link>
          ))}
        </div>
      </Container>
    ),
    how_it_works: (
      <Container className="pt-14">
        <SectionHead title="Book in three easy steps" subtitle="From search to e-voucher in minutes" />
        <div className="grid gap-4 sm:grid-cols-3">
          {[[Search, '1', 'Search', 'Pick a city, dates and guests — or just tell Lexa AI what you want.'], [CalendarCheck, '2', 'Compare & book', 'See the full price with taxes upfront and pay securely.'], [Luggage, '3', 'Travel', 'Get an instant e-voucher and manage everything from My trips.']].map(([Icon, n, t, d]) => (
            <div key={n} className="relative rounded-brand-lg border border-line bg-card p-6">
              <span className="absolute right-5 top-4 text-5xl font-extrabold text-primary/10">{n}</span>
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary-soft text-primary"><Icon size={24} /></span>
              <p className="mt-4 text-lg font-extrabold">{t}</p><p className="mt-1 text-sm text-muted">{d}</p>
            </div>
          ))}
        </div>
      </Container>
    ),
    get_app: (
      <Container className="py-14">
        <div className="relative flex flex-col items-start justify-between gap-5 overflow-hidden rounded-[22px] bg-secondary p-7 text-white sm:flex-row sm:items-center sm:p-10">
          <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-primary/25 blur-2xl" aria-hidden="true" />
          <div className="relative flex items-start gap-4">
            <span className="grid h-12 w-12 flex-none place-items-center rounded-2xl bg-primary"><Smartphone size={24} /></span>
            <div><h2 className="text-xl font-extrabold !text-white sm:text-2xl">Take {brand.appName} with you</h2><p className="mt-1 max-w-xl text-sm text-white/80">Open the mobile app for faster booking, trip updates and exclusive app-only deals.</p></div>
          </div>
          <Link to="/app" className="btn btn-primary relative flex-none">Open the app <ArrowRight size={18} /></Link>
        </div>
      </Container>
    ),
  };

  const order = [...sections.map((x) => x.key)];
  ['services', 'how_it_works', 'get_app'].forEach((k) => { if (!order.includes(k)) order.splice(k === 'services' ? Math.min(1, order.length) : order.length, 0, k); });

  return <div>{order.map((k) => (k === 'hero_search' ? <div key={k}>{blocks[k]}</div> : <Reveal key={k}>{blocks[k] || null}</Reveal>))}</div>;
}

export function SectionHead({ title, subtitle, link }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div><span className="sec-bar" aria-hidden="true" /><h2 className="text-2xl font-extrabold sm:text-3xl">{title}</h2>{subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}</div>
      {link && <Link to={link} className="flex flex-none items-center gap-1 text-sm font-bold text-primary">View all <ArrowRight size={15} /></Link>}
    </div>
  );
}

import { useState } from 'react';
import { Link } from 'react-router';
import { Heart, MapPin, Check, Wifi, Waves, Flower2, Coffee, Car, Dumbbell, Utensils, Snowflake, Bell, PawPrint, Plane, Wine, Mountain, Umbrella, Baby, Zap, Clock, Accessibility, Cctv, ChefHat, Building2, Home, Palmtree, BedDouble, House, HeartHandshake, Building, Bus, Sparkles, Timer, Flame, TrainFront, CarTaxiFront, BadgePercent, Ticket, Gift, Tag, Tent, Ship, Compass, Map as MapIcon, Headphones, Hotel, Luggage, Camera, Star } from 'lucide-react';
import { Img, RatingPill, Badge, Checkbox } from '../ui';
import { money, cx, plural } from '../../lib/format';
import { dealRibbon, dealEnds, dealLabel } from '../../lib/deals';

/** Maps icon names stored in the DB (catalogue) to lucide components */
export const ICONS = {
  wifi: Wifi, waves: Waves, 'flower-2': Flower2, coffee: Coffee, car: Car, dumbbell: Dumbbell, utensils: Utensils, snowflake: Snowflake, bell: Bell,
  'paw-print': PawPrint, plane: Plane, wine: Wine, mountain: Mountain, umbrella: Umbrella, baby: Baby, zap: Zap, clock: Clock, accessibility: Accessibility,
  cctv: Cctv, 'chef-hat': ChefHat, 'building-2': Building2, home: Home, palmtree: Palmtree, 'bed-double': BedDouble, house: House, 'heart-handshake': HeartHandshake, building: Building, check: Check,
  bus: Bus, sparkles: Sparkles, 'train-front': TrainFront, 'car-taxi-front': CarTaxiFront, 'badge-percent': BadgePercent, ticket: Ticket, gift: Gift, tag: Tag,
  tent: Tent, ship: Ship, compass: Compass, map: MapIcon, headphones: Headphones, hotel: Hotel, luggage: Luggage, camera: Camera, 'map-pin': MapPin,
};
export const DynIcon = ({ name, size = 16, className }) => {
  const C = ICONS[name] || Check;
  return <C size={size} className={className} />;
};

/** Kayak-style horizontal result card */
export function PropertyRow({ p, query, saved, onToggleSave }) {
  const qs = query ? `?${new URLSearchParams(query)}` : '';
  return (
    <article className="card group grid overflow-hidden transition hover:shadow-pop sm:grid-cols-[260px_1fr_200px]">
      <Link to={`/stay/${p.slug}${qs}`} className="relative block">
        <Img src={p.images?.[0]?.url} alt={p.images?.[0]?.alt || p.name} className="h-52 w-full sm:h-full sm:min-h-[200px]" />
        {p.deal ? <DealRibbon deal={p.deal} className="absolute left-3 top-3" /> : p.isFeatured && <span className="absolute left-3 top-3 badge badge-navy">Featured</span>}
        {onToggleSave && (
          <button onClick={(e) => { e.preventDefault(); onToggleSave(p._id); }} className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/95 text-ink shadow-card" aria-label={saved ? 'Remove from saved' : 'Save'}>
            <Heart size={17} className={saved ? 'fill-primary text-primary' : ''} />
          </button>
        )}
      </Link>
      <div className="flex min-w-0 flex-col gap-2 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-muted">
          <span>{p.category?.name}</span>
        </div>
        <Link to={`/stay/${p.slug}${qs}`} className="text-lg font-extrabold leading-snug text-secondary hover:text-primary">{p.name}</Link>
        <p className="flex items-center gap-1 text-sm text-muted"><MapPin size={14} />{[p.area, p.city?.name].filter(Boolean).join(', ')}</p>
        <RatingPill rating={p.rating} />
        {p.deal && (
          <p className="flex items-center gap-1.5 text-[13px] font-semibold text-primary"><Timer size={14} />{p.deal.title !== p.deal.label ? `${p.deal.title} · ` : ''}{dealEnds(p.deal)}{p.nightlyOriginal ? '' : ' · pick dates in the offer window'}</p>
        )}
        <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
          {p.refundable && <Badge tone="success"><Check size={12} />Free cancellation</Badge>}
          {p.breakfastAvailable && <Badge tone="primary">Breakfast available</Badge>}
          {p.amenities?.slice(0, 3).map((a) => <Badge key={a._id} tone="neutral"><DynIcon name={a.icon} size={12} />{a.name}</Badge>)}
        </div>
      </div>
      <div className="flex flex-row items-end justify-between gap-3 border-t border-line p-4 sm:flex-col sm:items-stretch sm:justify-center sm:border-l sm:border-t-0 sm:p-5">
        <div className="sm:text-right">
          {p.available ? (
            <>
              {p.roomsLeft > 0 && p.roomsLeft <= 3 && <p className="mb-1 text-xs font-bold text-danger">Only {plural(p.roomsLeft, 'room')} left</p>}
              {p.nightlyOriginal > p.nightlyFrom && <p className="text-sm text-muted"><s>{money(p.nightlyOriginal)}</s> <span className="font-bold text-success">{Math.round((1 - p.nightlyFrom / p.nightlyOriginal) * 100)}% off</span></p>}
              <p className="text-2xl font-extrabold text-ink">{money(p.nightlyFrom)}</p>
              <p className="text-xs text-muted">per night{p.totalFrom ? ` · ${money(p.totalFrom)} total` : ''}</p>
              <p className="text-[11px] text-muted">+ taxes &amp; fees</p>
            </>
          ) : (
            <p className="text-sm font-bold text-danger">Sold out for these dates</p>
          )}
        </div>
        <Link to={`/stay/${p.slug}${qs}`} className={cx('btn', p.available ? 'btn-primary' : 'btn-outline')}>{p.available ? 'View deal' : 'Other dates'}</Link>
      </div>
    </article>
  );
}

/** Vertical card (home page carousels, wishlist) */
export function PropertyCard({ p }) {
  return (
    <Link to={`/stay/${p.slug}`} className="group block">
      <div className="relative overflow-hidden rounded-brand-lg">
        <Img src={p.images?.[0]?.url} alt={p.name} className="aspect-[4/3] w-full transition duration-300 group-hover:scale-105" />
        {p.deal && <DealRibbon deal={p.deal} compact className="absolute left-2 top-2" />}
      </div>
      <div className="mt-3">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate font-bold text-secondary">{p.name}</p>
          {p.rating?.count > 0 && <span className="flex-none rounded-md bg-secondary px-1.5 text-xs font-bold text-white"><Star size={10} fill="currentColor" strokeWidth={0} className="mr-0.5 inline align-[-1px]" aria-label="Rating" />{p.rating.avg.toFixed(1)}</span>}
        </div>
        <p className="text-sm text-muted">{p.city?.name || p.address?.city?.name}{p.category?.name ? ` · ${p.category.name}` : ''}</p>
        <p className="mt-1 text-sm">{p.nightlyOriginal > p.nightlyFrom && <s className="mr-1 text-muted">{money(p.nightlyOriginal)}</s>}<b className="text-ink">{money(p.nightlyFrom ?? p.minPrice)}</b> <span className="text-muted">/ night</span></p>
      </div>
    </Link>
  );
}

const PRICE_BUCKETS = [[0, 2000], [2000, 5000], [5000, 10000], [10000, 20000], [20000, null]];

/** Filters rail — every change is reflected in the URL so results are shareable */
const FSection = ({ title, count, hint, children }) => (
  <section className="rounded-brand-lg border border-line bg-card p-4">
    <div className="mb-3 flex items-center justify-between gap-2">
      <h3 className="text-base font-extrabold">{title}</h3>
      {count > 0 && <span className="grid h-6 min-w-6 place-items-center rounded-full bg-primary px-1.5 text-xs font-bold text-white">{count}</span>}
    </div>
    {hint && <p className="-mt-2 mb-3 text-[13px] text-muted">{hint}</p>}
    {children}
  </section>
);
const FChip = ({ active, onClick, children, icon: Icon }) => (
  <button type="button" aria-pressed={!!active} onClick={onClick} className={cx('flex h-11 items-center gap-1.5 rounded-full border px-4 text-[15px] font-semibold transition active:scale-95', active ? 'border-primary bg-primary-soft text-primary' : 'border-line bg-card text-ink hover:border-ink/40')}>
    {active ? <Check size={16} strokeWidth={3} /> : Icon ? <Icon size={16} className="text-muted" /> : null}{children}
  </button>
);

export function FilterPanel({ params, set, categories = [], amenities = [], priceStats }) {
  const [showAll, setShowAll] = useState(false);
  const list = (k) => (params.get(k) ? params.get(k).split(',') : []);
  const toggle = (k, v) => {
    const cur = list(k);
    set(k, (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]).join(','));
  };
  const priceKey = `${params.get('minPrice') || ''}-${params.get('maxPrice') || ''}`;
  const hasPrice = params.get('minPrice') || params.get('maxPrice');
  const shownAmenities = showAll ? amenities : amenities.slice(0, 8);
  return (
    <div className="space-y-4">
      <FSection title="Price per night" count={hasPrice ? 1 : 0} hint={priceStats ? `Typical: ${money(priceStats.min)} – ${money(priceStats.max)}` : undefined}>
        <div className="grid grid-cols-2 gap-2">
          {PRICE_BUCKETS.map(([a, b]) => {
            const key = `${a || ''}-${b || ''}`;
            const active = priceKey === key;
            return (
              <button key={key} type="button" aria-pressed={active} onClick={() => { set('minPrice', active ? '' : a || ''); set('maxPrice', active ? '' : b || ''); }} className={cx('h-12 rounded-brand border text-[15px] font-semibold transition active:scale-95', active ? 'border-primary bg-primary-soft text-primary' : 'border-line bg-card')}>
                {b ? `${money(a)} – ${money(b)}` : `${money(a)}+`}
              </button>
            );
          })}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {[['minPrice', 'Min ₹'], ['maxPrice', 'Max ₹']].map(([k, ph]) => (
            <input key={`${k}-${params.get(k) || ''}`} type="number" inputMode="numeric" min="0" defaultValue={params.get(k) || ''} placeholder={ph} aria-label={ph} onBlur={(e) => e.target.value !== (params.get(k) || '') && set(k, e.target.value)} className="input h-12 text-base" />
          ))}
        </div>
      </FSection>

      {categories.length > 0 && (
        <FSection title="Property type" count={list('category').length}>
          <div className="flex flex-wrap gap-2">{categories.map((c) => <FChip key={c._id} active={list('category').includes(c.slug)} onClick={() => toggle('category', c.slug)}>{c.name}</FChip>)}</div>
        </FSection>
      )}

      <FSection title="Guest rating" count={params.get('rating') ? 1 : 0}>
        <div className="flex flex-wrap gap-2">
          {RATINGS.map(([v, l]) => <FChip key={v} active={params.get('rating') === v} onClick={() => set('rating', params.get('rating') === v ? '' : v)}>{l}</FChip>)}
        </div>
      </FSection>

      {amenities.length > 0 && (
        <FSection title="Amenities" count={list('amenities').length}>
          <div className="flex flex-wrap gap-2">{shownAmenities.map((a) => <FChip key={a._id} active={list('amenities').includes(a.slug)} onClick={() => toggle('amenities', a.slug)}>{a.name}</FChip>)}</div>
          {amenities.length > 8 && <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-3 text-[15px] font-bold text-primary">{showAll ? 'Show less' : `Show all ${amenities.length}`}</button>}
        </FSection>
      )}
    </div>
  );
}

/** "4.5 ★ & up" filter labels */
const RATINGS = ['4.5', '4', '3.5'].map((v) => [v, <>{v}<Star size={12} fill="currentColor" strokeWidth={0} className="mx-0.5 inline align-[-1px]" aria-label="stars" /> & up</>]);

const CheckRow = ({ checked, onChange, label, sub, type = 'checkbox' }) => (
  <label className={cx('flex min-h-[52px] cursor-pointer items-center gap-3 border-b border-line/70 px-1 py-2.5 transition active:bg-surface', checked && 'font-bold')}>
    <input type={type} checked={checked} onChange={onChange} className="peer sr-only" />
    <span className={cx('grid h-6 w-6 flex-none place-items-center border-2 transition', type === 'radio' ? 'rounded-full' : 'rounded-md', checked ? 'border-primary bg-primary text-white' : 'border-line bg-card')}>{checked && <Check size={15} strokeWidth={3.5} />}</span>
    <span className="flex-1 text-base leading-tight">{label}{sub && <span className="block text-[13px] font-normal text-muted">{sub}</span>}</span>
  </label>
);

/** Myntra-style filters: category list on the left, checkbox options for the selected category on the right */
export function FilterSplit({ params, set, categories = [], amenities = [], priceStats }) {
  const list = (k) => (params.get(k) ? params.get(k).split(',') : []);
  const toggle = (k, v) => { const cur = list(k); set(k, (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]).join(',')); };
  const lo = params.get('minPrice') ? Number(params.get('minPrice')) : 0;
  const hi = params.get('maxPrice') ? Number(params.get('maxPrice')) : Infinity;
  const priceOn = Boolean(params.get('minPrice') || params.get('maxPrice'));
  const isOn = ([a, b]) => priceOn && a >= lo && (b ?? Infinity) <= hi;
  const togglePrice = (bucket) => {
    const next = PRICE_BUCKETS.filter((x) => (x === bucket ? !isOn(x) : isOn(x)));
    if (!next.length) { set('minPrice', ''); set('maxPrice', ''); return; }
    set('minPrice', Math.min(...next.map((x) => x[0])) || '');
    set('maxPrice', next.some((x) => x[1] === null) ? '' : Math.max(...next.map((x) => x[1])));
  };
  const sections = [
    { key: 'price', label: 'Price', count: priceOn ? 1 : 0 },
    categories.length > 0 && { key: 'type', label: 'Property type', count: list('category').length },
    { key: 'rating', label: 'Guest rating', count: params.get('rating') ? 1 : 0 },
    amenities.length > 0 && { key: 'amen', label: 'Amenities', count: list('amenities').length },
  ].filter(Boolean);
  const [active, setActive] = useState('price');
  const cur = sections.find((x) => x.key === active) || sections[0];
  return (
    <div className="flex min-h-0 flex-1">
      <nav className="w-[36%] flex-none overflow-y-auto bg-surface" aria-label="Filter categories">
        {sections.map((x) => (
          <button key={x.key} type="button" onClick={() => setActive(x.key)} aria-current={cur.key === x.key} className={cx('relative flex min-h-[58px] w-full items-center justify-between gap-1 px-4 py-3 text-left text-[15px] leading-tight transition', cur.key === x.key ? 'bg-card font-extrabold text-ink' : 'font-semibold text-muted')}>
            {cur.key === x.key && <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-primary" />}
            <span>{x.label}</span>
            {x.count > 0 && <span className="grid h-5 min-w-5 flex-none place-items-center rounded-full bg-primary px-1 text-[11px] font-bold text-white">{x.count}</span>}
          </button>
        ))}
      </nav>
      <div className="min-w-0 flex-1 overflow-y-auto overscroll-contain bg-card px-4 py-3" key={cur.key}>
        <h3 className="mb-1 text-lg font-extrabold">{cur.label}</h3>
        {cur.key === 'price' && (
          <>
            {priceStats && <p className="mb-1 text-[13px] text-muted">Typical: {money(priceStats.min)} – {money(priceStats.max)} per night</p>}
            {PRICE_BUCKETS.map((bk) => <CheckRow key={bk[0]} checked={isOn(bk)} onChange={() => togglePrice(bk)} label={bk[1] ? `${money(bk[0])} – ${money(bk[1])}` : `${money(bk[0])} and above`} />)}
            <p className="mb-2 mt-4 text-sm font-bold">Custom range</p>
            <div className="grid grid-cols-2 gap-2">
              {[['minPrice', 'Min ₹'], ['maxPrice', 'Max ₹']].map(([k, ph]) => (
                <input key={`${k}-${params.get(k) || ''}`} type="number" inputMode="numeric" min="0" defaultValue={params.get(k) || ''} placeholder={ph} aria-label={ph} onBlur={(e) => e.target.value !== (params.get(k) || '') && set(k, e.target.value)} className="input h-12 text-base" />
              ))}
            </div>
          </>
        )}
        {cur.key === 'type' && categories.map((c) => <CheckRow key={c._id} checked={list('category').includes(c.slug)} onChange={() => toggle('category', c.slug)} label={c.name} />)}
        {cur.key === 'rating' && RATINGS.map(([v, l]) => <CheckRow key={v} type="radio" checked={params.get('rating') === v} onChange={() => set('rating', params.get('rating') === v ? '' : v)} label={l} />)}
        {cur.key === 'amen' && amenities.map((a) => <CheckRow key={a._id} checked={list('amenities').includes(a.slug)} onChange={() => toggle('amenities', a.slug)} label={a.name} />)}
      </div>
    </div>
  );
}

/** Price breakdown used on property page, checkout and booking details */
/** "−20% · Today's deal" ribbon for photos */
export function DealRibbon({ deal, className, compact }) {
  if (!deal) return null;
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-xs font-extrabold text-white shadow-card', className)} title={dealLabel(deal)}>
      <Flame size={13} />{dealRibbon(deal)}{!compact && <span className="font-semibold text-white/90">· Today’s deal</span>}
    </span>
  );
}

export function PriceBreakdown({ pricing, nights, rooms }) {
  if (!pricing) return null;
  const rows = [
    [`Room charges${nights ? ` (${plural(rooms || 1, 'room')} × ${plural(nights, 'night')})` : ''}`, pricing.baseAmount + (pricing.dealSavings || 0)],
    pricing.dealSavings ? [`Hotel deal${pricing.deal?.label || pricing.dealTitle ? ` (${pricing.deal?.label || pricing.dealTitle})` : ''}`, -pricing.dealSavings, 'text-success'] : null,
    pricing.mealPlanAmount ? ['Meal plan', pricing.mealPlanAmount] : null,
    pricing.extraGuestAmount ? ['Extra guests', pricing.extraGuestAmount] : null,
    pricing.discount ? [`Discount${pricing.couponCode ? ` (${pricing.couponCode})` : ''}`, -pricing.discount, 'text-success'] : null,
    [`Taxes${pricing.taxRate !== undefined ? ` (GST ${pricing.taxRate}%)` : ''}`, pricing.taxes],
    pricing.fees ? ['Convenience fee', pricing.fees] : null,
  ].filter(Boolean);
  return (
    <div className="space-y-2 text-sm">
      {rows.map(([l, v, cls]) => (
        <div key={l} className={cx('flex justify-between gap-4', cls)}><span className={cls ? '' : 'text-muted'}>{l}</span><span className="font-semibold tabular-nums">{v < 0 ? `− ${money(-v, true)}` : money(v, true)}</span></div>
      ))}
      <div className="divider my-2" />
      <div className="flex justify-between gap-4 text-base font-extrabold"><span>Total</span><span className="tabular-nums">{money(pricing.totalAmount, true)}</span></div>
    </div>
  );
}

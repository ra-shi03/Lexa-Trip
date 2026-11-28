import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { MapPin, Clock, Check, X, Users, Maximize, BedDouble, Sparkles, Heart, Share2, ShieldCheck, Flame, Timer } from 'lucide-react';
import { Container } from '../Container';
import { StaySearchForm, useStayQuery } from '@/components/search/SearchForms';
import { DynIcon, PropertyCard } from '@/components/stay/StayComponents';
import { Img, RatingPill, Badge, Button, ErrorState, Modal, Skeleton } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { useToast } from '@/context/ToastContext';
import { PropertyDetailSkeleton } from '../Skeletons';
import { money, plural, dateLabel, cx, isoDate, addDays } from '@/lib/format';
import { ReviewsList } from '@/components/stay/Reviews';
import { dealLabel, dealEnds, dealWindow } from '@/lib/deals';

// Same four options the vendor picks per rate plan ("Meals"), worded for guests
const MEALS = [
  ['EP', 'Room only', 'No meals'],
  ['CP', 'Breakfast', 'Breakfast included'],
  ['MAP', 'Breakfast + 1 meal', 'Breakfast + lunch or dinner'],
  ['AP', 'All meals', 'Breakfast, lunch and dinner'],
];
const mealText = (k) => MEALS.find((m) => m[0] === k)?.[2] || 'No meals';

export default function PropertyDetail() {
  const { slug } = useParams();
  const [sp] = useSearchParams();
  const q = useStayQuery();
  const navigate = useNavigate();
  const toast = useToast();
  const { user, update } = useAuth();
  const { feature } = useSettings();
  const [gallery, setGallery] = useState(false);
  const [meal, setMeal] = useState('');
  const { data, loading, error, reload } = useApi(() => api.get(`/public/properties/${slug}`), [slug], { live: 'content' });
  const p = data?.property;
  const rateKey = `${p?._id}-${sp.toString()}`;
  const { data: rates, loading: ratesLoading } = useApi(() => api.get(`/public/properties/${p._id}/rates`, { checkIn: q.checkIn, checkOut: q.checkOut, rooms: q.rooms, adults: q.adults, children: q.children }), [rateKey], { enabled: Boolean(p?._id) });
  const { data: summary } = useApi(() => api.get(`/public/ai/review-summary/${p._id}`), [p?._id], { enabled: Boolean(p?._id) && feature('aiReviewSummary') && (p?.rating?.count || 0) >= 3 });

  if (loading) return <PropertyDetailSkeleton />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  const images = p.images || [];
  // Meal filter: only the meal plans this stay actually sells are offered
  const planMeal = (r) => r.ratePlan.mealPlan || data?.rooms?.find((x) => String(x._id) === String(r.roomTypeId))?.ratePlans?.find((x) => x.code === r.ratePlan.code)?.mealPlan || 'EP';
  const sold = new Set((data?.rooms || []).flatMap((rt) => (rt.ratePlans || []).filter((x) => x.isActive !== false).map((x) => x.mealPlan || 'EP')));
  // cheapest bookable price per meal plan, for the selector
  const fromPrice = {};
  for (const r of rates || []) {
    if (!r.available) continue;
    const k = planMeal(r);
    fromPrice[k] = Math.min(fromPrice[k] ?? Infinity, r.pricing.totalAmount);
  }
  const activeMeal = sold.has(meal) ? meal : '';
  const shownRates = activeMeal ? rates?.filter((r) => planMeal(r) === activeMeal) : rates;
  const shownRooms = (data?.rooms || []).filter((rt) => !activeMeal || (rt.ratePlans || []).some((x) => x.isActive !== false && (x.mealPlan || 'EP') === activeMeal));
  const cheapest = shownRates?.filter((r) => r.available).sort((a, b) => a.pricing.totalAmount - b.pricing.totalAmount)[0];
  const saved = (user?.wishlist || []).map(String).includes(String(p._id));

  const book = (roomTypeId, ratePlanCode) => {
    const params = new URLSearchParams({ propertyId: p._id, roomTypeId, ratePlanCode, checkIn: q.checkIn, checkOut: q.checkOut, rooms: q.rooms, adults: q.adults, children: q.children });
    navigate(user ? `/checkout?${params}` : `/login?next=${encodeURIComponent(`/checkout?${params}`)}`);
  };
  const toggleSave = async () => {
    if (!user) return toast.info('Sign in to save stays');
    const { data: r } = await api.post(`/me/wishlist/${p._id}`);
    update('user', { wishlist: r.wishlist });
    toast.success(r.saved ? 'Saved' : 'Removed');
  };

  return (
    <div className="pb-12">
      <title>{`${p.name}, ${p.address?.city?.name} | LexaTrip`}</title>
      <meta name="description" content={p.shortDescription || ''} />
      <div className="border-b border-line py-4"><Container><StaySearchForm compact initial={{ city: p.address?.city?.name }} /></Container></div>

      <Container className="pt-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted"><Badge tone="primary">{p.category?.name}</Badge></div>
            <h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">{p.name}</h1>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted"><MapPin size={15} />{[p.address?.line1, p.address?.area, p.address?.landmark && `Near ${p.address.landmark}`, p.address?.city?.name, p.address?.city?.state?.name, p.address?.pincode].filter(Boolean).join(', ')}</p>
            <div className="mt-2"><RatingPill rating={p.rating} /></div>
          </div>
          <div className="flex gap-2">
            {feature('wishlist') && <Button variant="outline" size="sm" icon={Heart} onClick={toggleSave} className={saved ? 'text-primary' : ''}>{saved ? 'Saved' : 'Save'}</Button>}
            <Button variant="outline" size="sm" icon={Share2} onClick={() => { navigator.clipboard?.writeText(window.location.href); toast.success('Link copied'); }}>Share</Button>
          </div>
        </div>

        {data.deal && (() => {
          const d = data.deal;
          const applies = rates?.some((r) => r.pricing?.dealSavings > 0);
          const applyDealDates = () => {
            const start = new Date(Math.max(Date.now(), +new Date(d.startDate)));
            const ci = isoDate(start);
            const n = new URLSearchParams(sp); n.set('checkIn', ci); n.set('checkOut', isoDate(addDays(ci, 1)));
            navigate({ search: n.toString() }, { replace: true });
          };
          return (
            <div className="mt-4 flex items-center gap-3 rounded-brand-lg border border-primary/25 bg-primary-soft p-3.5">
              <span className="grid h-11 w-11 flex-none place-items-center rounded-2xl bg-primary text-white"><Flame size={22} /></span>
              <div className="min-w-0 flex-1">
                <p className="font-extrabold leading-tight text-ink">{dealLabel(d)}{d.title && d.title !== d.label ? ` · ${d.title}` : ''}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[13px] text-muted"><span className="flex items-center gap-1 font-semibold text-primary"><Timer size={13} />{dealEnds(d)}</span><span>{dealWindow(d)}{d.allRooms ? '' : ' · selected rooms'}</span></p>
              </div>
              {!ratesLoading && rates && !applies && <Button size="sm" variant="soft" onClick={applyDealDates} className="flex-none">Use deal dates</Button>}
              {applies && <span className="flex-none rounded-full bg-success/10 px-2.5 py-1 text-xs font-bold text-success">Applied</span>}
            </div>
          );
        })()}

        {/* Gallery */}
        <div className="mt-5 grid h-[260px] grid-cols-4 grid-rows-2 gap-2 overflow-hidden rounded-[20px] sm:h-[420px]">
          <button onClick={() => setGallery(true)} className="col-span-4 row-span-2 sm:col-span-2"><Img src={images[0]?.url} alt={images[0]?.alt || p.name} className="h-full w-full" /></button>
          {images.slice(1, 5).map((im, i) => (
            <button key={im._id || i} onClick={() => setGallery(true)} className="relative hidden sm:block">
              <Img src={im.url} alt={im.alt || p.name} className="h-full w-full" />
              {i === 3 && images.length > 5 && <span className="absolute inset-0 grid place-items-center bg-secondary/60 font-bold text-white">+{images.length - 5} photos</span>}
            </button>
          ))}
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
          <div className="min-w-0 space-y-10">
            <section>
              <p className="text-lg text-ink">{p.shortDescription}</p>
              {p.description && <div className="prose-lt mt-3 text-[15px] text-muted" dangerouslySetInnerHTML={{ __html: p.description }} />}
              {p.tags?.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{p.tags.map((t) => <span key={t} className="rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold capitalize text-primary">{t}</span>)}</div>}
            </section>

            <section>
              <h2 className="mb-4 text-xl font-extrabold">Amenities</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {p.amenities?.map((a) => <div key={a._id} className="flex items-center gap-2.5 text-sm"><span className="grid h-9 w-9 place-items-center rounded-lg bg-surface text-primary"><DynIcon name={a.icon} size={17} /></span>{a.name}</div>)}
              </div>
            </section>

            <section id="rooms">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
                <h2 className="text-xl font-extrabold">Choose your room</h2>
                <p className="text-sm text-muted">{dateLabel(q.checkIn)} – {dateLabel(q.checkOut)} · {plural(q.adults + q.children, 'guest')} · {plural(q.rooms, 'room')}</p>
              </div>
              <fieldset className="mb-4">
                <legend className="mb-2 text-sm font-bold">Meals</legend>
                <div className="grid grid-cols-2 gap-2">
                  {[['', 'Any'], ...MEALS].map(([k, label]) => {
                    const offered = !k || sold.has(k);
                    const on = activeMeal === k;
                    const price = k ? fromPrice[k] : Math.min(...Object.values(fromPrice));
                    return (
                      <button key={k || 'any'} type="button" disabled={!offered} aria-pressed={on} onClick={() => setMeal(k)}
                        className={cx('flex min-h-[3.75rem] flex-col justify-center rounded-brand border px-3 py-2 text-left transition active:scale-[.98]', !k && 'col-span-2',
                          on ? 'border-primary bg-primary-soft' : 'border-line bg-card', !offered && 'cursor-not-allowed border-dashed opacity-55')}>
                        <span className={cx('flex items-center justify-between gap-2 text-sm font-bold', on && 'text-primary')}>{label}{on && <Check size={15} strokeWidth={3} />}</span>
                        <span className="text-xs text-muted">{!offered ? 'Not offered here' : ratesLoading ? 'Checking…' : Number.isFinite(price) ? `from ${money(price)}` : 'Sold out'}</span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>
              <div className="space-y-4">
                {shownRooms.map((rt) => {
                  const plans = shownRates?.filter((r) => String(r.roomTypeId) === String(rt._id)) || [];
                  return (
                    <div key={rt._id} className="card overflow-hidden">
                      <div className="grid sm:grid-cols-[220px_1fr]">
                        {rt.images?.length > 1 ? (
                          <div className="relative">
                            <div className="hscroll !gap-0 !px-0 !pb-0" style={{ scrollPaddingLeft: 0 }}>{rt.images.map((im, i) => <Img key={im._id || i} src={im.url} alt={im.alt || rt.name} className="h-44 w-full flex-none sm:h-full sm:min-h-[11rem]" />)}</div>
                            <span className="pointer-events-none absolute bottom-2 right-2 rounded-full bg-secondary/70 px-2 py-0.5 text-[11px] font-bold text-white">1/{rt.images.length} · swipe</span>
                          </div>
                        ) : <Img src={rt.images?.[0]?.url} alt={rt.name} className="h-44 w-full sm:h-full" />}
                        <div className="p-4">
                          <h3 className="text-lg font-bold">{rt.name}</h3>
                          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                            {rt.sizeSqft && <span className="flex items-center gap-1"><Maximize size={13} />{rt.sizeSqft} sq ft</span>}
                            {rt.bedType && <span className="flex items-center gap-1"><BedDouble size={13} />{rt.bedType}</span>}
                            <span className="flex items-center gap-1"><Users size={13} />Up to {rt.maxOccupancy} guests{rt.maxAdults ? ` (${plural(rt.maxAdults, 'adult')}${rt.maxChildren ? `, ${plural(rt.maxChildren, 'child', 'children')}` : ''})` : ''}</span>
                            {rt.view && <span>{rt.view} view</span>}
                          </div>
                          {rt.description && <p className="mt-2 text-sm text-muted">{rt.description}</p>}
                          {rt.amenities?.length > 0 && <div className="mt-2.5 flex flex-wrap gap-1.5">{rt.amenities.map((a) => <span key={a._id} className="inline-flex items-center gap-1 rounded-full bg-surface px-2.5 py-1 text-xs font-semibold text-ink"><DynIcon name={a.icon} size={12} className="text-primary" />{a.name}</span>)}</div>}
                          {(rt.extraAdultCharge > 0 || rt.extraChildCharge > 0) && <p className="mt-2 text-xs text-muted">Extra {[rt.extraAdultCharge > 0 && `adult ${money(rt.extraAdultCharge)}`, rt.extraChildCharge > 0 && `child ${money(rt.extraChildCharge)}`].filter(Boolean).join(' · ')} per night beyond {plural(rt.baseOccupancy || 2, 'guest')}.</p>}
                          <div className="mt-4 space-y-2.5">
                            {ratesLoading && <Skeleton className="h-24" />}
                            {plans.map((r) => (
                              <div key={r.ratePlan.code} className="rounded-brand border border-line p-3">
                                <p className="font-bold leading-snug">{mealText(planMeal(r))}</p>
                                <p className={cx('mt-0.5 flex items-center gap-1.5 text-[13px] font-semibold', r.ratePlan.refundable ? 'text-success' : 'text-muted')}>
                                  {r.ratePlan.refundable ? <><Check size={14} />Free cancellation</> : <><X size={14} />Non-refundable</>}
                                </p>
                                {r.available ? (
                                  <div className="mt-2.5 flex items-end justify-between gap-3 border-t border-line pt-2.5">
                                    <div>
                                      {r.pricing.dealSavings > 0 && <p className="text-xs font-bold text-success">You save {money(r.pricing.dealSavings)}</p>}
                                      <p className="text-xl font-extrabold leading-tight">{money(r.pricing.totalAmount)}</p>
                                      <p className="text-[11px] text-muted">{plural(r.nights, 'night')}, incl. taxes</p>
                                      {r.roomsLeft <= 3 && <p className="text-xs font-bold text-danger">Only {r.roomsLeft} left</p>}
                                    </div>
                                    <Button onClick={() => book(rt._id, r.ratePlan.code)}>Book now</Button>
                                  </div>
                                ) : <p className="mt-2.5 border-t border-line pt-2.5 text-sm font-semibold text-danger">{r.reason || 'Unavailable'}</p>}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section>
              <h2 className="mb-4 text-xl font-extrabold">Policies</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="card card-pad"><p className="flex items-center gap-2 font-bold"><Clock size={17} className="text-primary" />Check-in / out</p><p className="mt-2 text-sm text-muted">Check-in from {p.checkInTime} · Check-out until {p.checkOutTime}</p></div>
                <div className="card card-pad"><p className="flex items-center gap-2 font-bold"><ShieldCheck size={17} className="text-primary" />Cancellation</p><p className="mt-2 text-sm text-muted">{p.cancellationPolicy?.text || (p.cancellationPolicy?.type === 'non_refundable' ? 'Non-refundable' : `Free cancellation up to ${p.cancellationPolicy?.freeCancellationHours}h before check-in`)}</p></div>
                {p.houseRules?.length > 0 && <div className="card card-pad sm:col-span-2"><p className="font-bold">House rules</p><ul className="mt-2 grid gap-1.5 text-sm text-muted sm:grid-cols-2">{p.houseRules.map((r) => <li key={r} className="flex gap-2"><Check size={15} className="mt-0.5 flex-none text-success" />{r}</li>)}</ul></div>}
                {p.childPolicy && <div className="card card-pad"><p className="font-bold">Children</p><p className="mt-2 text-sm text-muted">{p.childPolicy}</p></div>}
                {p.petPolicy && <div className="card card-pad"><p className="font-bold">Pets</p><p className="mt-2 text-sm text-muted">{p.petPolicy}</p></div>}
                {p.contact?.phone && <div className="card card-pad"><p className="font-bold">Property contact</p><p className="mt-2 text-sm text-muted"><a href={`tel:${p.contact.phone}`} className="font-semibold text-primary">{p.contact.phone}</a></p></div>}
              </div>
            </section>

            {p.geo?.lat && (
              <section>
                <h2 className="mb-4 text-xl font-extrabold">Location</h2>
                <iframe title="Map" className="h-72 w-full rounded-brand-lg border border-line" loading="lazy" src={`https://www.openstreetmap.org/export/embed.html?bbox=${p.geo.lng - 0.02}%2C${p.geo.lat - 0.012}%2C${p.geo.lng + 0.02}%2C${p.geo.lat + 0.012}&layer=mapnik&marker=${p.geo.lat}%2C${p.geo.lng}`} />
              </section>
            )}

            {feature('reviews') && (
              <section>
                <div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-extrabold">Guest reviews</h2><RatingPill rating={p.rating} /></div>
                {summary?.summary && (
                  <div className="mb-5 rounded-brand-lg border border-primary/25 bg-primary-soft/50 p-4">
                    <p className="flex items-center gap-2 text-sm font-bold text-secondary"><Sparkles size={16} className="text-primary" />What guests say (AI summary)</p>
                    <p className="mt-1.5 text-sm">{summary.summary}</p>
                    {(summary.pros?.length > 0 || summary.cons?.length > 0) && (
                      <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                        <ul className="space-y-1">{summary.pros?.map((x) => <li key={x} className="flex gap-2"><Check size={15} className="mt-0.5 text-success" />{x}</li>)}</ul>
                        <ul className="space-y-1">{summary.cons?.map((x) => <li key={x} className="flex gap-2"><X size={15} className="mt-0.5 text-danger" />{x}</li>)}</ul>
                      </div>
                    )}
                  </div>
                )}
                <ReviewsList propertyId={p._id} rating={p.rating} breakdown={data.ratingBreakdown} reviews={data.reviews} />
              </section>
            )}
          </div>

          {/* Sticky price box */}
          <aside>
            <div className="card card-pad sticky top-20 shadow-card">
              {cheapest ? (
                <>
                  <p className="text-xs font-semibold text-muted">Best price for your dates</p>
                  <p className="mt-1 text-3xl font-extrabold">{money(cheapest.pricing.totalAmount)}</p>
                  <p className="text-xs text-muted">{plural(cheapest.nights, 'night')} · {plural(q.rooms, 'room')} · taxes included</p>
                  <Button block className="mt-4" onClick={() => document.getElementById('rooms')?.scrollIntoView({ behavior: 'smooth' })}>See rooms</Button>
                </>
              ) : (
                <p className="text-sm font-semibold text-muted">{ratesLoading ? 'Checking availability…' : 'Not available for these dates — try changing them above.'}</p>
              )}
              <ul className="mt-4 space-y-2 text-sm text-muted">
                {p.cancellationPolicy?.type === 'free' && <li className="flex gap-2"><Check size={16} className="flex-none text-success" />Free cancellation up to {p.cancellationPolicy.freeCancellationHours}h before check-in</li>}
                <li className="flex gap-2"><Clock size={16} className="flex-none text-primary" />Check-in {p.checkInTime} · Check-out {p.checkOutTime}</li>
                {p.maxGuests > 0 && <li className="flex gap-2"><Users size={16} className="flex-none text-primary" />Up to {plural(p.maxGuests, 'guest')} per property</li>}
                <li className="flex gap-2"><Check size={16} className="flex-none text-success" />Secure payment · taxes shown upfront</li>
              </ul>
            </div>
          </aside>
        </div>

        {data.similar?.length > 0 && (
          <section className="mt-14">
            <h2 className="mb-5 text-xl font-extrabold">Similar stays nearby</h2>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">{data.similar.map((s) => <PropertyCard key={s._id} p={s} />)}</div>
          </section>
        )}
      </Container>

      <Modal open={gallery} onClose={() => setGallery(false)} title={`${p.name} · photos`} size="xl">
        <div className="grid gap-3 sm:grid-cols-2">{images.map((im, i) => <Img key={im._id || i} src={im.url} alt={im.alt || p.name} className={cx('w-full rounded-brand', 'aspect-[4/3]')} />)}</div>
      </Modal>
    </div>
  );
}

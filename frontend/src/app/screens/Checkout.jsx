import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router';
import { Tag, Check, Calendar, Users, User, Mail, Phone, ChevronDown, ShieldCheck, AlertCircle } from 'lucide-react';
import { PriceBreakdown } from '@/components/stay/StayComponents';
import { PaymentStep } from '@/components/travel/PaymentStep';
import { Button, Img, Alert, ErrorState, Badge } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { useToast } from '@/context/ToastContext';
import { CheckoutSkeleton } from '../Skeletons';
import { dateFull, plural, uid, money, cx } from '@/lib/format';

/** Hotel checkout: guest details → secure hold → payment (single page, two steps) */
export default function Checkout() {
  const [sp] = useSearchParams();
  const { user } = useAuth();
  const { feature } = useSettings();
  const toast = useToast();
  const input = useMemo(() => ({
    propertyId: sp.get('propertyId'), roomTypeId: sp.get('roomTypeId'), ratePlanCode: sp.get('ratePlanCode'),
    checkIn: sp.get('checkIn'), checkOut: sp.get('checkOut'), rooms: Number(sp.get('rooms') || 1), adults: Number(sp.get('adults') || 2), children: Number(sp.get('children') || 0),
  }), [sp]);
  const [quote, setQuote] = useState(null);
  const [error, setError] = useState(null);
  const [coupon, setCoupon] = useState('');
  const [applied, setApplied] = useState('');
  const [guest, setGuest] = useState({ name: user?.name || '', email: user?.email || '', phone: String(user?.phone || '').replace(/\D/g, '').slice(-10) });
  const [requests, setRequests] = useState('');
  const [touched, setTouched] = useState({});
  const [showPrice, setShowPrice] = useState(false);
  const [booking, setBooking] = useState(null);
  const [busy, setBusy] = useState(false);
  const [idemKey] = useState(uid);

  useEffect(() => {
    api.post('/public/quote', { ...input, couponCode: applied || undefined })
      .then(({ data }) => { setQuote(data); if (applied && data.pricing.couponError) { toast.error(data.pricing.couponError); setApplied(''); } })
      .catch(setError);
  }, [input, applied, toast]);

  const rules = {
    name: (v) => (v.trim().length < 2 ? 'Enter the guest’s full name' : !/^[A-Za-z][A-Za-z .'-]*$/.test(v.trim()) ? 'Use letters only, as on the ID' : ''),
    email: (v) => (!v ? 'Enter your email for the voucher' : !EMAIL_RE.test(v.trim()) ? 'Enter a valid email, e.g. name@gmail.com' : ''),
    phone: (v) => (!v ? 'Enter your mobile number' : v.length < 10 ? `Enter ${10 - v.length} more digit${10 - v.length > 1 ? 's' : ''}` : !/^[6-9]/.test(v) ? 'Mobile number must start with 6, 7, 8 or 9' : ''),
  };
  const errors = Object.fromEntries(Object.keys(rules).map((k) => [k, rules[k](guest[k])]));
  const valid = !Object.values(errors).some(Boolean);
  const touch = (k) => setTouched((t) => ({ ...t, [k]: true }));
  const shown = (k) => (touched[k] ? errors[k] : '');
  const ok = (k) => touched[k] && !errors[k] && guest[k];

  const proceed = async () => {
    if (!valid) { setTouched({ name: true, email: true, phone: true }); toast.error('Please fix the highlighted fields'); return; }
    setBusy(true);
    try {
      const { data } = await api.post('/me/bookings/hotel', { ...input, couponCode: applied || undefined, primaryGuest: { ...guest, name: guest.name.trim(), email: guest.email.trim().toLowerCase() }, specialRequests: requests, idempotencyKey: idemKey });
      setBooking(data);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) { toast.error(e); } finally { setBusy(false); }
  };

  if (error) return <ErrorState error={error} />;
  if (!quote) return <CheckoutSkeleton />;
  const total = quote.pricing?.totalAmount;
  const step = booking ? 2 : 1;

  return (
    <div className={cx('px-4 pt-4', booking ? 'pb-6' : 'pb-28')}>
      <title>Checkout | LexaTrip</title>

      {/* progress */}
      <ol className="mb-4 grid grid-cols-3 gap-2" aria-label="Checkout progress">
        {['Room', 'Guest details', 'Payment'].map((l, i) => (
          <li key={l} className="text-center">
            <span className={cx('mb-1.5 block h-1.5 rounded-full transition-all', i <= step ? 'bg-primary' : 'bg-line')} />
            <span className={cx('text-[13px] font-semibold', i === step ? 'text-ink' : 'text-muted')}>{i < step && <Check size={12} className="mr-0.5 inline" strokeWidth={3} />}{l}</span>
          </li>
        ))}
      </ol>

      {!quote.available && <Alert tone="danger" title="Not available">{quote.reason}</Alert>}

      {/* booking summary */}
      <section className="card mb-4 overflow-hidden">
        <div className="flex gap-3 p-4">
          <Img src={quote.property.image} alt={quote.property.name} className="h-20 w-24 flex-none rounded-xl" />
          <div className="min-w-0"><p className="text-base font-extrabold leading-snug">{quote.property.name}</p><p className="text-sm text-muted">{quote.property.city}</p><p className="mt-1 text-sm font-semibold">{quote.roomType.name}</p></div>
        </div>
        <div className="grid grid-cols-2 divide-x divide-line border-t border-line text-sm">
          <div className="p-3.5"><p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted"><Calendar size={13} />Dates</p><p className="mt-1 font-bold leading-snug">{dateFull(quote.checkIn)} → {dateFull(quote.checkOut)}</p><p className="text-xs text-muted">{plural(quote.nights, 'night')}</p></div>
          <div className="p-3.5"><p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted"><Users size={13} />Guests</p><p className="mt-1 font-bold leading-snug">{plural(quote.guests.adults, 'adult')}{quote.guests.children ? `, ${plural(quote.guests.children, 'child', 'children')}` : ''}</p><p className="text-xs text-muted">{plural(quote.rooms, 'room')}</p></div>
        </div>
        <div className="flex flex-wrap gap-1.5 border-t border-line px-4 py-3"><Badge tone="primary">{quote.ratePlan.name}</Badge>{quote.ratePlan.refundable ? <Badge tone="success">Refundable</Badge> : <Badge tone="warning">Non-refundable</Badge>}</div>
        <button type="button" onClick={() => setShowPrice((v) => !v)} aria-expanded={showPrice} className="flex w-full items-center justify-between border-t border-line bg-surface/70 px-4 py-3.5 text-left">
          <span><span className="block text-[13px] text-muted">Total payable (incl. taxes)</span><span className="text-xl font-extrabold">{money(total)}</span></span>
          <span className="flex items-center gap-1 text-sm font-bold text-primary">{showPrice ? 'Hide' : 'Price details'}<ChevronDown size={16} className={cx('transition', showPrice && 'rotate-180')} /></span>
        </button>
        {showPrice && <div className="animate-fade-up border-t border-line p-4"><PriceBreakdown pricing={quote.pricing} nights={quote.nights} rooms={quote.rooms} /></div>}
        <div className="border-t border-line p-4 text-[13px] leading-snug text-muted">{quote.property.cancellationPolicy?.text || 'Cancellation as per property policy.'}</div>
      </section>

      {!booking ? (
        <>
          <section className="card card-pad mb-4">
            <h2 className="text-xl font-extrabold">Who’s checking in?</h2>
            <p className="mb-5 mt-1 text-[15px] text-muted">We’ll send the booking voucher to this email and mobile.</p>
            <div className="space-y-5">
              <Field id="g-name" label="Full name (as on ID)" icon={User} error={shown('name')} good={ok('name')}>
                <input id="g-name" autoComplete="name" value={guest.name} onBlur={() => touch('name')} onChange={(e) => setGuest({ ...guest, name: e.target.value.replace(/[^A-Za-z .'-]/g, '').slice(0, 60) })} placeholder="e.g. Rashi Jaiswal" className={fieldCls(shown('name'), ok('name'))} />
              </Field>
              <Field id="g-email" label="Email" icon={Mail} error={shown('email')} good={ok('email')} hint="Your voucher is sent here">
                <input id="g-email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} value={guest.email} onBlur={() => { setGuest((g) => ({ ...g, email: g.email.trim().toLowerCase() })); touch('email'); }} onChange={(e) => setGuest({ ...guest, email: e.target.value.replace(/\s/g, '') })} placeholder="name@example.com" className={fieldCls(shown('email'), ok('email'))} />
              </Field>
              <Field id="g-phone" label="Mobile number" icon={Phone} error={shown('phone')} good={ok('phone')} counter={`${guest.phone.length}/10`} counterFull={guest.phone.length === 10}>
                <span className="pointer-events-none absolute left-12 top-1/2 -translate-y-1/2 text-base font-semibold text-muted">+91</span>
                <input id="g-phone" type="tel" inputMode="numeric" autoComplete="tel-national" value={guest.phone} onBlur={() => touch('phone')} onChange={(e) => setGuest({ ...guest, phone: e.target.value.replace(/\D/g, '').replace(/^(91|0)(?=\d{10})/, '').slice(0, 10) })} placeholder="10-digit mobile number" className={cx(fieldCls(shown('phone'), ok('phone')), '!pl-[5.5rem]')} />
              </Field>
              <div>
                <label htmlFor="g-req" className="mb-1.5 flex items-center justify-between text-[15px] font-bold">Special requests <span className="text-xs font-medium text-muted">{requests.length}/200 · optional</span></label>
                <textarea id="g-req" rows={3} maxLength={200} value={requests} onChange={(e) => setRequests(e.target.value)} placeholder="e.g. early check-in, high floor" className="input !h-auto py-3 text-base" />
                <p className="mt-1 text-[13px] text-muted">Subject to availability.</p>
              </div>
            </div>
          </section>

          {feature('coupons') && (
            <section className="card card-pad mb-4">
              <h2 className="mb-3 flex items-center gap-2 text-lg font-extrabold"><Tag size={18} className="text-primary" />Offers &amp; coupons</h2>
              {applied && quote.pricing.discount > 0 ? (
                <div className="flex items-center justify-between gap-3 rounded-brand bg-success/10 px-4 py-3 text-[15px]"><span className="flex items-center gap-2 font-semibold text-success"><Check size={17} />{applied} applied — you save {money(quote.pricing.discount)}</span><button className="font-bold text-danger" onClick={() => setApplied('')}>Remove</button></div>
              ) : (
                <div className="flex gap-2"><input className="input h-12 min-w-0 flex-1 text-base uppercase tracking-wider" aria-label="Coupon code" placeholder="Enter coupon code" value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase().replace(/\s/g, ''))} /><Button variant="secondary" size="lg" disabled={!coupon} onClick={() => setApplied(coupon)}>Apply</Button></div>
              )}
            </section>
          )}
          <p className="flex items-center justify-center gap-1.5 text-center text-[13px] text-muted"><ShieldCheck size={15} className="text-success" />Secure payment · rooms are held once you continue</p>
          <p className="mt-2 text-center text-xs text-muted">By continuing you agree to the property policies and LexaTrip’s <Link to="/p/terms-and-conditions" className="underline">terms</Link>.</p>

          <div className="safe-bottom fixed bottom-0 left-1/2 z-40 w-full max-w-[480px] -translate-x-1/2 border-t border-line bg-bg/95 px-4 py-3 backdrop-blur">
            <div className="flex items-center gap-4">
              <div className="leading-tight"><p className="text-xs text-muted">Total</p><p className="text-xl font-extrabold">{money(total)}</p></div>
              <Button size="lg" className="flex-1" loading={busy} disabled={!quote.available} onClick={proceed}>Continue to payment</Button>
            </div>
          </div>
        </>
      ) : (
        <section className="card card-pad">
          <h2 className="mb-1 text-xl font-extrabold">Payment</h2>
          <p className="mb-5 text-[15px] text-muted">Booking ref <b className="text-ink">{booking.bookingCode}</b> · rooms are held while you pay.</p>
          <PaymentStep booking={booking} />
        </section>
      )}
    </div>
  );
}

const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
const fieldCls = (err, good) => cx('input h-14 !pl-12 !pr-11 text-base', err && '!border-danger !ring-2 !ring-danger/20', good && '!border-success');

/** Labelled field with leading icon, live status icon, inline error and optional character counter */
function Field({ id, label, icon: Icon, error, good, hint, counter, counterFull, children }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between"><label htmlFor={id} className="text-[15px] font-bold">{label} <span className="text-danger">*</span></label>{counter && <span className={cx('text-[13px] font-bold tabular-nums', counterFull ? 'text-success' : 'text-muted')}>{counter}</span>}</div>
      <div className="relative">
        <Icon size={19} className={cx('pointer-events-none absolute left-4 top-1/2 -translate-y-1/2', error ? 'text-danger' : 'text-muted')} />
        {children}
        {good && <Check size={19} strokeWidth={3} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-success" />}
        {error && <AlertCircle size={19} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-danger" />}
      </div>
      {error ? <p role="alert" className="mt-1.5 text-[13px] font-semibold text-danger">{error}</p> : hint ? <p className="mt-1.5 text-[13px] text-muted">{hint}</p> : null}
    </div>
  );
}

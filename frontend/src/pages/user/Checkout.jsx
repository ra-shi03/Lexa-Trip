import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router';
import { Tag, Check, Calendar, Users, ArrowLeft } from 'lucide-react';
import { Container } from '../../components/layout/UserLayout';
import { PriceBreakdown } from '../../components/stay/StayComponents';
import { PaymentStep } from '../../components/travel/PaymentStep';
import { Input, Textarea, Button, Stepper, Img, Alert, PageLoader, ErrorState, Badge } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { useToast } from '../../context/ToastContext';
import { dateFull, plural, uid } from '../../lib/format';

/** Hotel checkout: guest details → secure hold → payment (single page, two steps) */
export default function Checkout() {
  const [sp] = useSearchParams();
  const { user } = useAuth();
  const { feature } = useSettings();
  const toast = useToast();
  const navigate = useNavigate();
  const input = useMemo(() => ({
    propertyId: sp.get('propertyId'), roomTypeId: sp.get('roomTypeId'), ratePlanCode: sp.get('ratePlanCode'),
    checkIn: sp.get('checkIn'), checkOut: sp.get('checkOut'), rooms: Number(sp.get('rooms') || 1), adults: Number(sp.get('adults') || 2), children: Number(sp.get('children') || 0),
  }), [sp]);
  const [quote, setQuote] = useState(null);
  const [error, setError] = useState(null);
  const [coupon, setCoupon] = useState('');
  const [applied, setApplied] = useState('');
  const [guest, setGuest] = useState({ name: user?.name || '', email: user?.email || '', phone: user?.phone || '' });
  const [requests, setRequests] = useState('');
  const [errors, setErrors] = useState({});
  const [booking, setBooking] = useState(null);
  const [busy, setBusy] = useState(false);
  const [idemKey] = useState(uid);

  useEffect(() => {
    api.post('/public/quote', { ...input, couponCode: applied || undefined })
      .then(({ data }) => { setQuote(data); if (applied && data.pricing.couponError) { toast.error(data.pricing.couponError); setApplied(''); } })
      .catch(setError);
  }, [input, applied, toast]);

  const validate = () => {
    const e = {};
    if (guest.name.trim().length < 2) e.name = 'Enter the guest’s full name';
    if (!/^\S+@\S+\.\S+$/.test(guest.email)) e.email = 'Enter a valid email for your voucher';
    if (!/^[6-9]\d{9}$/.test(guest.phone)) e.phone = 'Enter a valid 10-digit mobile number';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const proceed = async () => {
    if (!validate()) return;
    setBusy(true);
    try {
      const { data } = await api.post('/me/bookings/hotel', { ...input, couponCode: applied || undefined, primaryGuest: guest, specialRequests: requests, idempotencyKey: idemKey });
      setBooking(data);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) { toast.error(e); } finally { setBusy(false); }
  };

  if (error) return <ErrorState error={error} />;
  if (!quote) return <PageLoader label="Fetching the latest price…" />;

  return (
    <Container className="py-6 sm:py-10">
      <title>Checkout | LexaTrip</title>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink"><ArrowLeft size={16} />Back</button>
        <Stepper steps={['Choose room', 'Guest details', 'Payment']} current={booking ? 2 : 1} />
      </div>
      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          {!quote.available && <Alert tone="danger" title="Not available">{quote.reason}</Alert>}
          {!booking ? (
            <>
              <section className="card card-pad">
                <h2 className="text-lg font-extrabold">Who’s checking in?</h2>
                <p className="mb-5 text-sm text-muted">We’ll send the booking voucher to this email and mobile.</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input label="Full name (as on ID)" required value={guest.name} error={errors.name} onChange={(e) => setGuest({ ...guest, name: e.target.value })} className="sm:col-span-2" />
                  <Input label="Email" type="email" required value={guest.email} error={errors.email} onChange={(e) => setGuest({ ...guest, email: e.target.value })} />
                  <Input label="Mobile number" inputMode="numeric" maxLength={10} required value={guest.phone} error={errors.phone} onChange={(e) => setGuest({ ...guest, phone: e.target.value.replace(/\D/g, '') })} />
                  <Textarea label="Special requests (optional)" rows={3} className="sm:col-span-2" value={requests} onChange={(e) => setRequests(e.target.value)} hint="Subject to availability — e.g. early check-in, high floor." />
                </div>
              </section>
              {feature('coupons') && (
                <section className="card card-pad">
                  <h2 className="mb-3 flex items-center gap-2 font-extrabold"><Tag size={18} className="text-primary" />Offers &amp; coupons</h2>
                  {applied && quote.pricing.discount > 0 ? (
                    <div className="flex items-center justify-between rounded-brand bg-success/10 px-4 py-3 text-sm"><span className="flex items-center gap-2 font-semibold text-success"><Check size={16} />{applied} applied — you save ₹{quote.pricing.discount}</span><button className="font-bold text-danger" onClick={() => setApplied('')}>Remove</button></div>
                  ) : (
                    <div className="flex gap-2"><input className="input uppercase" placeholder="Enter coupon code" value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} /><Button variant="secondary" disabled={!coupon} onClick={() => setApplied(coupon)}>Apply</Button></div>
                  )}
                </section>
              )}
              <Button size="lg" block loading={busy} disabled={!quote.available} onClick={proceed}>Continue to payment</Button>
              <p className="text-center text-xs text-muted">By continuing you agree to the property policies and LexaTrip’s <Link to="/p/terms-and-conditions" className="underline">terms</Link>.</p>
            </>
          ) : (
            <section className="card card-pad">
              <h2 className="mb-1 text-lg font-extrabold">Payment</h2>
              <p className="mb-5 text-sm text-muted">Booking ref <b className="text-ink">{booking.bookingCode}</b> · rooms are held while you pay.</p>
              <PaymentStep booking={booking} />
            </section>
          )}
        </div>

        <aside className="space-y-4">
          <div className="card overflow-hidden lg:sticky lg:top-20">
            <div className="flex gap-3 p-4">
              <Img src={quote.property.image} alt={quote.property.name} className="h-20 w-24 flex-none rounded-lg" />
              <div className="min-w-0"><p className="font-bold leading-snug">{quote.property.name}</p><p className="text-sm text-muted">{quote.property.city}</p><p className="mt-1 text-sm font-semibold">{quote.roomType.name}</p></div>
            </div>
            <div className="space-y-2 border-t border-line p-4 text-sm">
              <p className="flex items-center gap-2"><Calendar size={15} className="text-muted" />{dateFull(quote.checkIn)} → {dateFull(quote.checkOut)}</p>
              <p className="flex items-center gap-2"><Users size={15} className="text-muted" />{plural(quote.guests.adults, 'adult')}{quote.guests.children ? `, ${plural(quote.guests.children, 'child', 'children')}` : ''} · {plural(quote.rooms, 'room')}</p>
              <div className="flex flex-wrap gap-1.5 pt-1"><Badge tone="primary">{quote.ratePlan.name}</Badge>{quote.ratePlan.refundable ? <Badge tone="success">Refundable</Badge> : <Badge tone="warning">Non-refundable</Badge>}</div>
            </div>
            <div className="border-t border-line p-4"><PriceBreakdown pricing={quote.pricing} nights={quote.nights} rooms={quote.rooms} /></div>
            <div className="border-t border-line bg-surface p-4 text-xs text-muted">{quote.property.cancellationPolicy?.text || 'Cancellation as per property policy.'}</div>
          </div>
        </aside>
      </div>
    </Container>
  );
}

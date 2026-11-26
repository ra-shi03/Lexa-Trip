import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { CheckCircle2, Printer, MapPin, Calendar, Users, Phone, Mail, Bus, Plane, LifeBuoy, ArrowLeft, Star } from 'lucide-react';
import { Container } from '../Container';
import { PriceBreakdown } from '@/components/stay/StayComponents';
import { PaymentStep } from '@/components/travel/PaymentStep';
import { Button, StatusBadge, ErrorState, ConfirmDialog, Img, Modal, Textarea, Badge } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import { useSettings } from '@/context/SettingsContext';
import { BookingSkeleton } from '../Skeletons';
import { dateFull, dateTime, time, duration, money, plural, titleCase } from '@/lib/format';

/** Confirmation + voucher + manage booking (cancel, review, support) — one screen for all services */
export default function BookingDetail() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const toast = useToast();
  const { brand, feature } = useSettings();
  const { data: b, loading, error, reload, setData } = useApi(() => api.get(`/me/bookings/${id}`), [id]);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState(null);

  if (loading) return <BookingSkeleton />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  const isNew = sp.get('new') && ['confirmed', 'pending_approval'].includes(b.status);
  const canCancel = ['confirmed', 'pending_approval'].includes(b.status);
  const canReview = feature('reviews') && b.type === 'hotel' && ['checked_out', 'completed'].includes(b.status);

  const openCancel = async () => {
    try { const { data } = await api.get(`/me/bookings/${id}/cancellation-preview`); setPreview(data); } catch { setPreview(null); }
    setCancelOpen(true);
  };
  const doCancel = async (reason) => {
    setBusy(true);
    try { const { data } = await api.post(`/me/bookings/${id}/cancel`, { reason }); setData(data); setCancelOpen(false); toast.success('Booking cancelled'); } catch (e) { toast.error(e); } finally { setBusy(false); }
  };
  const submitReview = async () => {
    try { const r = await api.post('/me/reviews', { bookingId: id, ...review }); toast.success(r.message); setReview(null); } catch (e) { toast.error(e); }
  };

  return (
    <Container className="max-w-4xl py-6 sm:py-10">
      <title>{`Booking ${b.bookingCode} | LexaTrip`}</title>
      <Link to="/account/trips" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink print:hidden"><ArrowLeft size={16} />My trips</Link>

      {isNew && (
        <div className="animate-fade-up mb-6 flex flex-col items-center rounded-[22px] bg-success/10 p-8 text-center">
          <CheckCircle2 size={52} className="text-success" />
          <h1 className="mt-3 text-2xl font-extrabold">{b.status === 'pending_approval' ? 'Booking request received!' : 'Booking confirmed!'}</h1>
          <p className="mt-1 text-sm text-muted">{b.status === 'pending_approval' ? 'The property will confirm shortly. You’ll be notified.' : `Your voucher has been sent to ${b.primaryGuest?.email}.`}</p>
        </div>
      )}

      {b.status === 'pending_payment' && (
        <div className="card card-pad mb-6"><h2 className="mb-4 font-extrabold">Complete your payment</h2><PaymentStep booking={b} onPaid={(nb) => setData(nb)} /></div>
      )}

      {/* Voucher (print-friendly) */}
      <article className="card overflow-hidden" id="voucher">
        <header className="flex flex-wrap items-center justify-between gap-4 bg-secondary px-5 py-4 text-white">
          <div className="flex items-center gap-3"><img src={brand.markUrl} alt="" className="h-9 w-9 rounded-full" /><div><p className="text-xs uppercase tracking-wider text-white/60">{b.type === 'hotel' ? 'Hotel voucher' : b.type === 'bus' ? 'Bus e-ticket' : 'Flight e-ticket'}</p><p className="font-extrabold">{b.bookingCode}</p></div></div>
          <div className="text-right"><StatusBadge status={b.status} />{b.pnr && <p className="mt-1 text-sm">PNR <b className="tracking-wider">{b.pnr}</b></p>}</div>
        </header>

        <div className="grid gap-6 p-5 sm:grid-cols-[1fr_280px]">
          <div className="space-y-4">
            {b.type === 'hotel' && (
              <>
                <div className="flex gap-4">
                  <Img src={b.snapshot?.image || b.property?.images?.[0]?.url} alt="" className="h-20 w-24 flex-none rounded-lg" />
                  <div><h2 className="text-lg font-extrabold">{b.snapshot?.propertyName}</h2><p className="flex items-center gap-1 text-sm text-muted"><MapPin size={14} />{[b.property?.address?.line1, b.snapshot?.city].filter(Boolean).join(', ')}</p><p className="mt-1 text-sm font-semibold">{b.snapshot?.roomName} · {b.ratePlan?.name}</p></div>
                </div>
                <div className="grid grid-cols-2 gap-3 rounded-brand bg-surface p-4 text-sm">
                  <div><p className="text-xs text-muted">Check-in</p><p className="font-bold">{dateFull(b.checkIn)}</p><p className="text-xs text-muted">from {b.property?.checkInTime}</p></div>
                  <div><p className="text-xs text-muted">Check-out</p><p className="font-bold">{dateFull(b.checkOut)}</p><p className="text-xs text-muted">until {b.property?.checkOutTime}</p></div>
                  <div className="col-span-2 flex items-center gap-2"><Calendar size={15} className="text-muted" />{plural(b.nights, 'night')} · <Users size={15} className="text-muted" />{plural(b.guests?.adults, 'adult')}{b.guests?.children ? `, ${plural(b.guests.children, 'child', 'children')}` : ''} · {plural(b.rooms, 'room')}</div>
                </div>
              </>
            )}
            {b.type !== 'hotel' && b.trip && (
              <>
                <div className="flex items-center gap-3">{b.type === 'bus' ? <Bus className="text-primary" /> : <Plane className="text-primary" />}<div><h2 className="text-lg font-extrabold">{b.trip.from} → {b.trip.to}</h2><p className="text-sm text-muted">{b.trip.operator || `${b.trip.airline} ${b.trip.flightNo}`} · {b.trip.busType || titleCase(b.trip.cabin || '')}</p></div></div>
                <div className="grid grid-cols-3 items-center gap-2 rounded-brand bg-surface p-4 text-center text-sm">
                  <div><p className="text-xl font-extrabold">{time(b.trip.departure)}</p><p className="text-xs text-muted">{dateFull(b.trip.departure)}</p></div>
                  <div className="text-xs text-muted">{duration(b.trip.durationMin)}<div className="my-1 h-px bg-line" />{b.trip.stops ? `${b.trip.stops} stop` : b.type === 'flight' ? 'Non-stop' : ''}</div>
                  <div><p className="text-xl font-extrabold">{time(b.trip.arrival)}</p><p className="text-xs text-muted">{dateFull(b.trip.arrival)}</p></div>
                </div>
                {b.trip.boardingPoint && <p className="text-sm"><b>Boarding:</b> {b.trip.boardingPoint} · <b>Drop:</b> {b.trip.droppingPoint}</p>}
                <div><p className="mb-2 text-sm font-bold">Passengers</p><ul className="divide-y divide-line rounded-brand border border-line text-sm">{b.passengers?.map((p, i) => <li key={i} className="flex justify-between px-3 py-2"><span>{p.fullName} {p.age ? `· ${p.age}y` : ''} {p.gender ? `· ${p.gender}` : ''}</span>{p.seatNo && <Badge tone="primary">Seat {p.seatNo}</Badge>}</li>)}</ul></div>
              </>
            )}
            <div className="text-sm"><p className="font-bold">Primary guest</p><p>{b.primaryGuest?.name}</p><p className="flex items-center gap-1.5 text-muted"><Mail size={13} />{b.primaryGuest?.email} · <Phone size={13} />{b.primaryGuest?.phone}</p></div>
            {b.property?.contact?.phone && <p className="text-sm text-muted">Property contact: {b.property.contact.phone}</p>}
          </div>
          <div className="rounded-brand border border-line p-4">
            <p className="mb-3 font-bold">Payment summary</p>
            {b.type === 'hotel' ? <PriceBreakdown pricing={b.pricing} nights={b.nights} rooms={b.rooms} /> : (
              <div className="space-y-2 text-sm"><div className="flex justify-between"><span className="text-muted">Fare</span><span>{money(b.pricing.baseAmount + (b.pricing.dealSavings || 0), true)}</span></div>{b.pricing.dealSavings > 0 && <div className="flex justify-between text-success"><span>Hotel deal{b.pricing.dealTitle ? ` (${b.pricing.dealTitle})` : ''}</span><span>− {money(b.pricing.dealSavings, true)}</span></div>}{b.pricing.discount > 0 && <div className="flex justify-between text-success"><span>Discount</span><span>− {money(b.pricing.discount, true)}</span></div>}<div className="flex justify-between"><span className="text-muted">Taxes</span><span>{money(b.pricing.taxes, true)}</span></div><div className="divider" /><div className="flex justify-between font-extrabold"><span>Total</span><span>{money(b.pricing.totalAmount, true)}</span></div></div>
            )}
            <p className="mt-3 text-xs text-muted">Payment: <StatusBadge status={b.paymentStatus} /></p>
            {b.cancellation?.refundAmount > 0 && <p className="mt-2 text-xs font-semibold text-success">Refund {money(b.cancellation.refundAmount, true)} · {titleCase(b.cancellation.refundStatus)}</p>}
          </div>
        </div>
        <footer className="border-t border-line px-5 py-3 text-xs text-muted">Booked {dateTime(b.createdAt)} · Carry a valid government photo ID. · {brand.supportEmail}</footer>
      </article>

      <div className="mt-5 flex flex-wrap gap-2 print:hidden">
        {['confirmed', 'checked_in', 'checked_out', 'completed', 'pending_approval'].includes(b.status) && <Button variant="outline" icon={Printer} onClick={() => window.print()}>Download / print voucher</Button>}
        <Button variant="outline" icon={LifeBuoy} to={`/account/support?booking=${b._id}`}>Get help</Button>
        {canReview && <Button variant="outline" icon={Star} onClick={() => setReview({ rating: 5, title: '', comment: '' })}>Write a review</Button>}
        {canCancel && <Button variant="ghost" className="text-danger" onClick={openCancel}>Cancel booking</Button>}
      </div>

      <ConfirmDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={doCancel}
        loading={busy}
        title="Cancel this booking?"
        message={preview?.refundAmount !== undefined ? `As per the cancellation policy you’ll receive a refund of ${money(preview.refundAmount, true)}${preview.penaltyAmount ? ` (cancellation charge ${money(preview.penaltyAmount, true)})` : ''}.` : preview?.note || 'Refund will be calculated as per the fare rules.'}
        confirmLabel="Cancel booking"
        withReason
        reasonLabel="Why are you cancelling?"
      />
      <Modal open={Boolean(review)} onClose={() => setReview(null)} title="Rate your stay" size="sm" footer={<Button onClick={submitReview}>Submit review</Button>}>
        {review && (
          <div className="space-y-4">
            <div className="flex gap-2">{[1, 2, 3, 4, 5].map((n) => <button key={n} onClick={() => setReview({ ...review, rating: n })} aria-label={`${n} stars`}><Star size={30} className={n <= review.rating ? 'fill-[#f5a524] text-[#f5a524]' : 'text-line'} /></button>)}</div>
            <input className="input" placeholder="Title" value={review.title} onChange={(e) => setReview({ ...review, title: e.target.value })} />
            <Textarea placeholder="Tell other travellers about your stay" value={review.comment} onChange={(e) => setReview({ ...review, comment: e.target.value })} />
          </div>
        )}
      </Modal>
    </Container>
  );
}

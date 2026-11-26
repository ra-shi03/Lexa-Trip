import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { Bus as BusIcon, Snowflake, BedDouble, Star, ArrowRight, Info } from 'lucide-react';
import { Container } from '../Container';
import { BusSearchForm } from '@/components/search/SearchForms';
import { PaymentStep } from '@/components/travel/PaymentStep';
import { Button, Skeleton, EmptyState, ErrorState, Badge, Input, Select, Stepper, Alert } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { SeatMapSkeleton } from '../Skeletons';
import { money, time, duration, dateFull, cx } from '@/lib/format';

export function BusSearchPage() {
  const [sp] = useSearchParams();
  const from = sp.get('from');
  const to = sp.get('to');
  const date = sp.get('date');
  const has = from && to && date;
  const [filters, setFilters] = useState({ ac: false, sleeper: false, sort: 'departure' });
  const { data, loading, error, reload } = useApi(() => api.get('/public/bus/search', { from, to, date }), [from, to, date], { enabled: Boolean(has) });
  const navigate = useNavigate();
  const list = useMemo(() => {
    let l = (data || []).filter((t) => (!filters.ac || t.isAc) && (!filters.sleeper || t.isSleeper));
    l = [...l].sort((a, b) => (filters.sort === 'price' ? a.fare - b.fare : filters.sort === 'rating' ? b.rating - a.rating : a.departure.localeCompare(b.departure)));
    return l;
  }, [data, filters]);

  return (
    <div className="pb-10">
      <title>Bus tickets | LexaTrip</title>
      <section className="border-b border-line bg-gradient-to-b from-primary-soft/50 to-bg py-8">
        <Container>
          {!has && <h1 className="mb-6 text-3xl font-extrabold">Book bus tickets</h1>}
          <BusSearchForm initial={{ from, to, date }} />
        </Container>
      </section>
      {has && (
        <Container className="pt-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div><h1 className="text-xl font-extrabold">Buses {from} → {to}</h1><p className="text-sm text-muted">{dateFull(date)} · {list.length} buses</p></div>
            <div className="flex flex-wrap gap-2">
              <button className={cx('chip h-9', filters.ac && 'active')} onClick={() => setFilters({ ...filters, ac: !filters.ac })}><Snowflake size={14} />AC</button>
              <button className={cx('chip h-9', filters.sleeper && 'active')} onClick={() => setFilters({ ...filters, sleeper: !filters.sleeper })}><BedDouble size={14} />Sleeper</button>
              <select className="chip h-9 pr-3 outline-none" value={filters.sort} onChange={(e) => setFilters({ ...filters, sort: e.target.value })}><option value="departure">Earliest departure</option><option value="price">Cheapest</option><option value="rating">Top rated</option></select>
            </div>
          </div>
          <Alert tone="info" className="mb-4"><span className="flex items-center gap-2"><Info size={15} />Bus inventory is served by a sandbox provider until the live bus API is contracted.</span></Alert>
          <div className="space-y-3">
            {loading && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
            {error && <ErrorState error={error} onRetry={reload} />}
            {!loading && !error && !list.length && <div className="card"><EmptyState icon={BusIcon} title="No buses found" text="Try another date or remove filters." /></div>}
            {list.map((t) => (
              <div key={t.id} className="card grid gap-4 p-4 transition hover:shadow-card sm:grid-cols-[1.4fr_2fr_1fr] sm:items-center sm:p-5">
                <div><p className="font-extrabold text-secondary">{t.operator}</p><p className="text-xs text-muted">{t.busType}</p><div className="mt-2 flex items-center gap-2"><span className="flex items-center gap-1 rounded-md bg-success px-1.5 text-xs font-bold text-white"><Star size={11} fill="currentColor" />{t.rating}</span><span className="text-xs text-muted">{t.seatsAvailable} seats left</span></div></div>
                <div className="flex items-center gap-3">
                  <div><p className="text-xl font-extrabold">{time(t.departure)}</p><p className="text-xs text-muted">{t.from}</p></div>
                  <div className="flex-1 text-center text-xs text-muted">{duration(t.durationMin)}<div className="my-1 h-px bg-line" /></div>
                  <div className="text-right"><p className="text-xl font-extrabold">{time(t.arrival)}</p><p className="text-xs text-muted">{t.to}</p></div>
                </div>
                <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
                  <p className="text-xl font-extrabold">{money(t.fare)} <span className="text-xs font-normal text-muted">onwards</span></p>
                  <Button size="sm" onClick={() => navigate(`/bus/${t.id}`)}>Select seats</Button>
                </div>
                {t.amenities?.length > 0 && <div className="flex flex-wrap gap-1.5 sm:col-span-3">{t.amenities.map((a) => <Badge key={a}>{a}</Badge>)}</div>}
              </div>
            ))}
          </div>
        </Container>
      )}
    </div>
  );
}

export function BusSeatsPage() {
  const { tripId } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { data, loading, error } = useApi(() => api.get(`/public/bus/trips/${tripId}/seats`), [tripId]);
  const [seats, setSeats] = useState([]);
  const [bp, setBp] = useState('');
  const [dp, setDp] = useState('');
  const [pax, setPax] = useState({});
  const [contact, setContact] = useState({ name: user?.name || '', email: user?.email || '', phone: user?.phone || '' });
  const [coupon, setCoupon] = useState('');
  const [booking, setBooking] = useState(null);
  const [busy, setBusy] = useState(false);

  if (loading) return <SeatMapSkeleton />;
  if (error) return <ErrorState error={error} />;
  const { trip, decks } = data;
  const all = decks.flatMap((d) => d.rows.flat()).filter(Boolean);
  const total = seats.reduce((s, no) => s + (all.find((x) => x.no === no)?.price || 0), 0);
  const toggle = (seat) => setSeats((s) => (s.includes(seat.no) ? s.filter((x) => x !== seat.no) : s.length >= 6 ? (toast.info('Maximum 6 seats per booking'), s) : [...s, seat.no]));

  const book = async () => {
    if (!user) return navigate(`/login?next=/bus/${tripId}`);
    if (!seats.length) return toast.error('Select at least one seat');
    const passengers = seats.map((no) => ({ fullName: pax[no]?.fullName || '', age: Number(pax[no]?.age || 0), gender: pax[no]?.gender || '' }));
    if (passengers.some((p) => p.fullName.length < 2 || !p.age || !p.gender)) return toast.error('Fill name, age and gender for each passenger');
    setBusy(true);
    try {
      const { data: b } = await api.post('/me/bookings/bus', { tripId, seats, boardingPoint: bp || trip.boardingPoints[0]?.name, droppingPoint: dp || trip.droppingPoints[0]?.name, passengers, primaryGuest: contact, couponCode: coupon || undefined });
      setBooking(b);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) { toast.error(e); } finally { setBusy(false); }
  };

  return (
    <Container className="py-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-xl font-extrabold">{trip.operator}</h1><p className="text-sm text-muted">{trip.from} → {trip.to} · {dateFull(trip.departure)} · {time(trip.departure)} · {trip.busType}</p></div>
        <Stepper steps={['Seats', 'Passengers', 'Payment']} current={booking ? 2 : seats.length ? 1 : 0} />
      </div>
      {booking ? (
        <div className="mx-auto max-w-xl card card-pad"><h2 className="mb-1 font-extrabold">Pay for {booking.bookingCode}</h2><p className="mb-5 text-sm text-muted">Seats {seats.join(', ')} are held while you pay.</p><PaymentStep booking={booking} /></div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
          <div className="card card-pad">
            <div className="mb-4 flex flex-wrap gap-3 text-xs"><span className="flex items-center gap-1.5"><span className="seat h-4 w-4" />Available</span><span className="flex items-center gap-1.5"><span className="seat selected h-4 w-4" />Selected</span><span className="flex items-center gap-1.5"><span className="seat h-4 w-4 border-dashed bg-surface" />Booked</span><span className="flex items-center gap-1.5"><span className="seat ladies h-4 w-4" />Ladies</span></div>
            <div className="flex flex-wrap gap-6">
              {decks.map((d) => (
                <div key={d.name}>
                  <p className="mb-2 text-xs font-bold uppercase text-muted">{d.name}</p>
                  <div className="space-y-2 rounded-xl border border-line p-3">
                    {d.rows.map((row, ri) => (
                      <div key={ri} className="flex gap-2">
                        {row.map((s, ci) => (s ? (
                          <button key={s.no} disabled={!s.available} onClick={() => toggle(s)} title={`${s.no} · ${money(s.price)}`} className={cx('seat', s.type === 'sleeper' && 'sleeper', seats.includes(s.no) && 'selected', s.ladiesOnly && 'ladies')}>{s.no}</button>
                        ) : <span key={`a${ci}`} className="w-4" />))}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <div className="card card-pad grid gap-4 sm:grid-cols-2">
              <Select label="Boarding point" value={bp} onChange={(e) => setBp(e.target.value)} options={trip.boardingPoints.map((p) => ({ value: p.name, label: `${time(p.time)} · ${p.name}` }))} />
              <Select label="Dropping point" value={dp} onChange={(e) => setDp(e.target.value)} options={trip.droppingPoints.map((p) => ({ value: p.name, label: `${time(p.time)} · ${p.name}` }))} />
            </div>
            {seats.length > 0 && (
              <div className="card card-pad space-y-4">
                <h2 className="font-extrabold">Passenger details</h2>
                {seats.map((no) => (
                  <div key={no} className="grid gap-3 sm:grid-cols-[70px_1fr_90px_130px] sm:items-end">
                    <Badge tone="primary" className="h-9 justify-center">Seat {no}</Badge>
                    <Input placeholder="Full name" value={pax[no]?.fullName || ''} onChange={(e) => setPax({ ...pax, [no]: { ...pax[no], fullName: e.target.value } })} />
                    <Input placeholder="Age" type="number" min={1} value={pax[no]?.age || ''} onChange={(e) => setPax({ ...pax, [no]: { ...pax[no], age: e.target.value } })} />
                    <Select placeholder="Gender" value={pax[no]?.gender || ''} onChange={(e) => setPax({ ...pax, [no]: { ...pax[no], gender: e.target.value } })} options={['male', 'female', 'other']} />
                  </div>
                ))}
                <div className="grid gap-3 border-t border-line pt-4 sm:grid-cols-3">
                  <Input label="Contact name" value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} />
                  <Input label="Email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} />
                  <Input label="Mobile" maxLength={10} value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value.replace(/\D/g, '') })} />
                </div>
                <Input label="Coupon (optional)" value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} placeholder="BUS100" />
              </div>
            )}
            <div className="card card-pad flex items-center justify-between gap-4">
              <div><p className="text-xs text-muted">{seats.length ? `Seats ${seats.join(', ')}` : 'No seats selected'}</p><p className="text-2xl font-extrabold">{money(total)}</p><p className="text-[11px] text-muted">+ taxes</p></div>
              <Button size="lg" loading={busy} disabled={!seats.length} onClick={book} iconRight={ArrowRight}>Proceed to pay</Button>
            </div>
            <p className="text-xs text-muted">{trip.cancellationPolicy}</p>
          </div>
        </div>
      )}
    </Container>
  );
}

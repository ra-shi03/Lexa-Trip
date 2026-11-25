import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Plane, Luggage, Check, ArrowRight, Info } from 'lucide-react';
import { Container } from '../../components/layout/UserLayout';
import { FlightSearchForm } from '../../components/search/SearchForms';
import { PaymentStep } from '../../components/travel/PaymentStep';
import { Button, Skeleton, EmptyState, ErrorState, Badge, Input, Select, Stepper, Alert, Tabs } from '../../components/ui';
import { useApi } from '../../hooks/useApi';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { money, time, duration, dateFull, cx, titleCase } from '../../lib/format';

function FlightCard({ f, onSelect, selected }) {
  const [open, setOpen] = useState(false);
  const cheapest = f.fares[0];
  return (
    <div className={cx('card overflow-hidden transition hover:shadow-card', selected && 'ring-2 ring-primary')}>
      <div className="grid gap-4 p-4 sm:grid-cols-[1.2fr_2fr_1fr] sm:items-center sm:p-5">
        <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-lg bg-surface text-xs font-extrabold text-secondary">{f.airlineCode}</span><div><p className="font-bold">{f.airline}</p><p className="text-xs text-muted">{f.flightNo} · {titleCase(f.cabin)}</p></div></div>
        <div className="flex items-center gap-3">
          <div><p className="text-xl font-extrabold">{time(f.departure)}</p><p className="text-xs text-muted">{f.from}</p></div>
          <div className="flex-1 text-center text-xs text-muted">{duration(f.durationMin)}<div className="my-1 h-px bg-line" />{f.stops ? `1 stop ${f.stopover}` : 'Non-stop'}</div>
          <div className="text-right"><p className="text-xl font-extrabold">{time(f.arrival)}</p><p className="text-xs text-muted">{f.to}</p></div>
        </div>
        <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
          <div className="sm:text-right"><p className="text-xl font-extrabold">{money(cheapest.total)}</p>{f.seatsLeft <= 4 && <p className="text-xs font-bold text-danger">{f.seatsLeft} seats left</p>}</div>
          <Button size="sm" variant={open ? 'outline' : 'primary'} onClick={() => setOpen((o) => !o)}>{open ? 'Hide fares' : 'View fares'}</Button>
        </div>
      </div>
      {open && (
        <div className="grid gap-3 border-t border-line bg-surface/60 p-4 sm:grid-cols-3">
          {f.fares.map((fare) => (
            <div key={fare.code} className="flex flex-col rounded-brand border border-line bg-card p-4">
              <p className="font-bold">{fare.name}</p>
              <ul className="mt-2 flex-1 space-y-1.5 text-xs text-muted">
                <li className="flex gap-1.5"><Luggage size={13} />Cabin {fare.cabinBaggage} · Check-in {fare.checkInBaggage}</li>
                <li className="flex gap-1.5"><Check size={13} />{fare.changeFee ? `Change fee ${money(fare.changeFee)}` : 'Free date change'}</li>
                <li className="flex gap-1.5"><Check size={13} />{fare.cancellationFee}</li>
              </ul>
              <p className="mt-3 text-lg font-extrabold">{money(fare.total)}</p>
              <Button size="sm" className="mt-2" onClick={() => onSelect(f, fare)}>Select</Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function FlightsPage() {
  const [sp] = useSearchParams();
  const q = Object.fromEntries(sp);
  const has = q.from && q.to && q.date;
  const { data, loading, error, reload } = useApi(() => api.get('/public/flights/search', q), [sp.toString()], { enabled: Boolean(has) });
  const [sort, setSort] = useState('price');
  const [nonStop, setNonStop] = useState(false);
  const [airline, setAirline] = useState('');
  const [leg, setLeg] = useState('outbound');
  const navigate = useNavigate();
  const list = useMemo(() => {
    let l = (data?.[leg] || []).filter((f) => (!nonStop || !f.stops) && (!airline || f.airline === airline));
    return [...l].sort((a, b) => (sort === 'price' ? a.fares[0].total - b.fares[0].total : sort === 'duration' ? a.durationMin - b.durationMin : a.departure.localeCompare(b.departure)));
  }, [data, leg, nonStop, airline, sort]);
  const airlines = [...new Set((data?.[leg] || []).map((f) => f.airline))];

  const select = (f, fare) => {
    const p = new URLSearchParams({ flightId: f.id, fareCode: fare.code, adults: q.adults || 1, children: q.children || 0, infants: q.infants || 0 });
    try { sessionStorage.setItem(`lt_flight_${f.id}`, JSON.stringify({ f, fare })); } catch { /* storage unavailable */ }
    navigate(`/flights/book?${p}`);
  };

  return (
    <div className="pb-10">
      <title>Flights | LexaTrip</title>
      <section className="border-b border-line bg-gradient-to-b from-primary-soft/50 to-bg py-8">
        <Container>{!has && <h1 className="mb-6 text-3xl font-extrabold">Search cheap flights</h1>}<FlightSearchForm initial={q} /></Container>
      </section>
      {has && (
        <Container className="pt-6">
          {data?.inbound && <Tabs className="mb-4" value={leg} onChange={setLeg} tabs={[{ value: 'outbound', label: `${q.from} → ${q.to}` }, { value: 'inbound', label: `${q.to} → ${q.from}` }]} />}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div><h1 className="text-xl font-extrabold">Flights {leg === 'outbound' ? `${q.from} → ${q.to}` : `${q.to} → ${q.from}`}</h1><p className="text-sm text-muted">{dateFull(leg === 'outbound' ? q.date : q.returnDate)} · {list.length} flights</p></div>
            <div className="flex flex-wrap gap-2">
              <button className={cx('chip h-9', nonStop && 'active')} onClick={() => setNonStop(!nonStop)}>Non-stop</button>
              <select className="chip h-9 pr-3 outline-none" value={airline} onChange={(e) => setAirline(e.target.value)}><option value="">All airlines</option>{airlines.map((a) => <option key={a}>{a}</option>)}</select>
              <select className="chip h-9 pr-3 outline-none" value={sort} onChange={(e) => setSort(e.target.value)}><option value="price">Cheapest</option><option value="duration">Fastest</option><option value="departure">Earliest</option></select>
            </div>
          </div>
          <Alert tone="info" className="mb-4"><span className="flex items-center gap-2"><Info size={15} />Flight fares come from a sandbox provider until the live flight API is contracted.</span></Alert>
          <div className="space-y-3">
            {loading && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
            {error && <ErrorState error={error} onRetry={reload} />}
            {!loading && !error && !list.length && <div className="card"><EmptyState icon={Plane} title="No flights found" /></div>}
            {list.map((f) => <FlightCard key={f.id} f={f} onSelect={select} />)}
          </div>
        </Container>
      )}
    </div>
  );
}

export function FlightBookPage() {
  const [sp] = useSearchParams();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const flightId = sp.get('flightId');
  const cached = useMemo(() => { try { return JSON.parse(sessionStorage.getItem(`lt_flight_${flightId}`)); } catch { return null; } }, [flightId]);
  const counts = { adult: Number(sp.get('adults') || 1), child: Number(sp.get('children') || 0), infant: Number(sp.get('infants') || 0) };
  const initialPax = Object.entries(counts).flatMap(([type, n]) => Array.from({ length: n }, () => ({ type, fullName: '', gender: '', idType: '', idNumber: '' })));
  const [pax, setPax] = useState(initialPax);
  const [contact, setContact] = useState({ name: user?.name || '', email: user?.email || '', phone: user?.phone || '' });
  const [booking, setBooking] = useState(null);
  const [busy, setBusy] = useState(false);

  if (!cached) return <Container className="py-16"><EmptyState icon={Plane} title="Flight selection expired" action={<Button to="/flights">Search again</Button>} /></Container>;
  const { f, fare } = cached;

  const book = async () => {
    if (!user) return navigate(`/login?next=${encodeURIComponent(`/flights/book?${sp}`)}`);
    if (pax.some((p) => p.fullName.trim().length < 2 || !p.gender)) return toast.error('Enter name and gender for every passenger (as on ID)');
    setBusy(true);
    try {
      const { data } = await api.post('/me/bookings/flight', { flightId, fareCode: sp.get('fareCode'), passengers: pax, primaryGuest: contact });
      setBooking(data);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) { toast.error(e); } finally { setBusy(false); }
  };

  return (
    <Container className="max-w-4xl py-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h1 className="text-xl font-extrabold">{f.from} → {f.to} · {f.airline} {f.flightNo}</h1><Stepper steps={['Flight', 'Passengers', 'Payment']} current={booking ? 2 : 1} /></div>
      <div className="card card-pad mb-5 flex flex-wrap items-center justify-between gap-4 text-sm">
        <div><p className="font-bold">{dateFull(f.departure)}</p><p className="text-muted">{time(f.departure)} – {time(f.arrival)} · {duration(f.durationMin)} · {f.stops ? '1 stop' : 'Non-stop'}</p></div>
        <div className="text-right"><Badge tone="primary">{fare.name}</Badge><p className="mt-1 text-xl font-extrabold">{money(fare.total)}</p></div>
      </div>
      {booking ? (
        <div className="card card-pad"><h2 className="mb-5 font-extrabold">Payment · {booking.bookingCode}</h2><PaymentStep booking={booking} /></div>
      ) : (
        <div className="space-y-4">
          {pax.map((p, i) => (
            <div key={i} className="card card-pad">
              <p className="mb-3 font-bold">{titleCase(p.type)} {i + 1}</p>
              <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
                <Input label="Full name (as on ID)" value={p.fullName} onChange={(e) => setPax(pax.map((x, j) => (j === i ? { ...x, fullName: e.target.value } : x)))} />
                <Select label="Gender" placeholder="Select" value={p.gender} onChange={(e) => setPax(pax.map((x, j) => (j === i ? { ...x, gender: e.target.value } : x)))} options={['male', 'female', 'other']} />
                <Select label="ID type (optional)" placeholder="Select" value={p.idType} onChange={(e) => setPax(pax.map((x, j) => (j === i ? { ...x, idType: e.target.value } : x)))} options={[{ value: 'aadhaar', label: 'Aadhaar' }, { value: 'passport', label: 'Passport' }, { value: 'pan', label: 'PAN' }]} />
                <Input label="ID number (optional)" value={p.idNumber} onChange={(e) => setPax(pax.map((x, j) => (j === i ? { ...x, idNumber: e.target.value } : x)))} />
              </div>
            </div>
          ))}
          <div className="card card-pad grid gap-3 sm:grid-cols-3">
            <Input label="Contact name" value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} />
            <Input label="Email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} />
            <Input label="Mobile" maxLength={10} value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value.replace(/\D/g, '') })} />
          </div>
          <Button size="lg" block loading={busy} onClick={book} iconRight={ArrowRight}>Continue to payment</Button>
        </div>
      )}
    </Container>
  );
}

import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Search, ArrowLeftRight, BedDouble, Bus, Plane } from 'lucide-react';
import { LocationInput } from './LocationInput';
import { GuestPicker } from './GuestPicker';
import { useSettings } from '../../context/SettingsContext';
import { useApi } from '../../hooks/useApi';
import { api } from '../../lib/api';
import { isoDate, addDays, today, cx } from '../../lib/format';
import { useToast } from '../../context/ToastContext';

/** Reads/writes the shared stay query (?city&checkIn&checkOut&adults&children&rooms) */
export function useStayQuery() {
  const [sp] = useSearchParams();
  const ci = sp.get('checkIn') || isoDate(addDays(new Date(), 1));
  return {
    city: sp.get('city') || '',
    checkIn: ci,
    checkOut: sp.get('checkOut') || isoDate(addDays(ci, 1)),
    adults: Number(sp.get('adults') || 2),
    children: Number(sp.get('children') || 0),
    rooms: Number(sp.get('rooms') || 1),
  };
}

export function StaySearchForm({ initial, compact }) {
  const q = useStayQuery();
  const start = { ...q, ...initial };
  const [city, setCity] = useState(start.city);
  const [checkIn, setCheckIn] = useState(start.checkIn);
  const [checkOut, setCheckOut] = useState(start.checkOut);
  const [guests, setGuests] = useState({ adults: start.adults, children: start.children, rooms: start.rooms });
  const navigate = useNavigate();
  const toast = useToast();
  const submit = (e) => {
    e?.preventDefault();
    if (checkOut <= checkIn) return toast.error('Check-out must be after check-in');
    const p = new URLSearchParams({ city, checkIn, checkOut, adults: guests.adults, children: guests.children, rooms: guests.rooms });
    navigate(`/search?${p}`);
  };
  return (
    <form onSubmit={submit} className={cx('search-bar', compact && 'shadow-none')}>
      <LocationInput value={city} onChange={setCity} onPickProperty={(p) => navigate(`/stay/${p.slug}?checkIn=${checkIn}&checkOut=${checkOut}&adults=${guests.adults}&children=${guests.children}&rooms=${guests.rooms}`)} />
      <div className="search-cell min-w-[150px]">
        <label htmlFor="ci">Check-in</label>
        <input id="ci" type="date" min={today()} value={checkIn} onChange={(e) => { setCheckIn(e.target.value); if (e.target.value >= checkOut) setCheckOut(isoDate(addDays(e.target.value, 1))); }} />
      </div>
      <div className="search-cell min-w-[150px]">
        <label htmlFor="co">Check-out</label>
        <input id="co" type="date" min={isoDate(addDays(checkIn, 1))} value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
      </div>
      <GuestPicker value={guests} onChange={setGuests} />
      <button type="submit" className="search-go" aria-label="Search stays"><Search size={22} strokeWidth={2.5} /></button>
    </form>
  );
}

export function BusSearchForm({ initial = {} }) {
  const [from, setFrom] = useState(initial.from || '');
  const [to, setTo] = useState(initial.to || '');
  const [date, setDate] = useState(initial.date || isoDate(addDays(new Date(), 1)));
  const navigate = useNavigate();
  const toast = useToast();
  const { data: cities } = useApi(() => api.get('/public/cities'), []);
  const submit = (e) => {
    e.preventDefault();
    if (!from || !to) return toast.error('Enter both source and destination');
    if (from.toLowerCase() === to.toLowerCase()) return toast.error('Source and destination must be different');
    navigate(`/bus?${new URLSearchParams({ from, to, date })}`);
  };
  return (
    <form onSubmit={submit} className="search-bar">
      <datalist id="bus-cities">{cities?.map((c) => <option key={c._id} value={c.name} />)}</datalist>
      <div className="search-cell"><label htmlFor="bf">From</label><input id="bf" list="bus-cities" value={from} onChange={(e) => setFrom(e.target.value)} placeholder="Leaving from" /></div>
      <button type="button" onClick={() => { setFrom(to); setTo(from); }} className="hidden h-auto w-10 flex-none place-items-center rounded-full text-muted hover:text-primary md:grid" aria-label="Swap"><ArrowLeftRight size={18} /></button>
      <div className="search-cell"><label htmlFor="bt">To</label><input id="bt" list="bus-cities" value={to} onChange={(e) => setTo(e.target.value)} placeholder="Going to" /></div>
      <div className="search-cell max-w-none md:max-w-[200px]"><label htmlFor="bd">Journey date</label><input id="bd" type="date" min={today()} value={date} onChange={(e) => setDate(e.target.value)} /></div>
      <button type="submit" className="search-go" aria-label="Search buses"><Search size={22} strokeWidth={2.5} /></button>
    </form>
  );
}

export function FlightSearchForm({ initial = {} }) {
  const [trip, setTrip] = useState(initial.returnDate ? 'round' : 'oneway');
  const [from, setFrom] = useState(initial.from || 'DEL');
  const [to, setTo] = useState(initial.to || '');
  const [date, setDate] = useState(initial.date || isoDate(addDays(new Date(), 7)));
  const [returnDate, setReturnDate] = useState(initial.returnDate || isoDate(addDays(new Date(), 10)));
  const [pax, setPax] = useState({ adults: Number(initial.adults || 1), children: Number(initial.children || 0), infants: Number(initial.infants || 0) });
  const [cabin, setCabin] = useState(initial.cabin || 'economy');
  const { data: airports } = useApi(() => api.get('/public/flights/airports'), []);
  const navigate = useNavigate();
  const toast = useToast();
  const submit = (e) => {
    e.preventDefault();
    if (!from || !to) return toast.error('Choose origin and destination');
    if (from === to) return toast.error('Origin and destination must be different');
    const p = new URLSearchParams({ from, to, date, adults: pax.adults, children: pax.children, infants: pax.infants, cabin });
    if (trip === 'round') p.set('returnDate', returnDate);
    navigate(`/flights?${p}`);
  };
  const airportSelect = (id, value, set, label) => (
    <div className="search-cell">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(e) => set(e.target.value)}>
        <option value="">Select airport</option>
        {airports?.map((a) => <option key={a.code} value={a.code}>{a.city} ({a.code})</option>)}
      </select>
    </div>
  );
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {[['oneway', 'One way'], ['round', 'Round trip']].map(([v, l]) => (
          <button key={v} type="button" className={cx('chip h-8', trip === v && 'active')} onClick={() => setTrip(v)}>{l}</button>
        ))}
        <select value={cabin} onChange={(e) => setCabin(e.target.value)} className="chip h-8 pr-3 outline-none">
          <option value="economy">Economy</option>
          <option value="business">Business</option>
        </select>
        <select value={pax.adults} onChange={(e) => setPax({ ...pax, adults: Number(e.target.value) })} className="chip h-8 pr-3 outline-none">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => <option key={n} value={n}>{n} adult{n > 1 ? 's' : ''}</option>)}
        </select>
        <select value={pax.children} onChange={(e) => setPax({ ...pax, children: Number(e.target.value) })} className="chip h-8 pr-3 outline-none">
          {[0, 1, 2, 3, 4].map((n) => <option key={n} value={n}>{n} child{n !== 1 ? 'ren' : ''}</option>)}
        </select>
      </div>
      <form onSubmit={submit} className="search-bar">
        {airportSelect('ff', from, setFrom, 'From')}
        <button type="button" onClick={() => { setFrom(to); setTo(from); }} className="hidden w-10 flex-none place-items-center rounded-full text-muted hover:text-primary md:grid" aria-label="Swap"><ArrowLeftRight size={18} /></button>
        {airportSelect('ft', to, setTo, 'To')}
        <div className="search-cell md:max-w-[180px]"><label htmlFor="fd">Depart</label><input id="fd" type="date" min={today()} value={date} onChange={(e) => setDate(e.target.value)} /></div>
        {trip === 'round' && <div className="search-cell md:max-w-[180px]"><label htmlFor="fr">Return</label><input id="fr" type="date" min={date} value={returnDate} onChange={(e) => setReturnDate(e.target.value)} /></div>}
        <button type="submit" className="search-go" aria-label="Search flights"><Search size={22} strokeWidth={2.5} /></button>
      </form>
    </div>
  );
}

/** Tabbed search hub (Stays | Buses | Flights) — respects admin feature flags. */
export function SearchHub({ defaultTab = 'stays' }) {
  const { feature } = useSettings();
  const tabs = [feature('hotels') && ['stays', 'Stays', BedDouble], feature('buses') && ['bus', 'Buses', Bus], feature('flights') && ['flights', 'Flights', Plane]].filter(Boolean);
  const [tab, setTab] = useState(tabs.find((t) => t[0] === defaultTab)?.[0] || tabs[0]?.[0]);
  return (
    <div>
      <div className="mb-4 flex gap-2">
        {tabs.map(([v, l, Icon]) => (
          <button key={v} type="button" onClick={() => setTab(v)} className={cx('flex h-11 items-center gap-2 rounded-full px-4 text-sm font-bold transition', tab === v ? 'bg-secondary text-white' : 'bg-surface text-ink hover:bg-line/60')}>
            <Icon size={17} />{l}
          </button>
        ))}
      </div>
      {tab === 'stays' && <StaySearchForm />}
      {tab === 'bus' && <BusSearchForm />}
      {tab === 'flights' && <FlightSearchForm />}
    </div>
  );
}

import { useEffect, useId, useRef, useState } from 'react';
import { LocateFixed, Loader2, MapPin } from 'lucide-react';
import { Field, Input } from '../ui/Form';
import { useDebounce, useOutside } from '../../hooks/useApi';
import { api } from '../../lib/api';
import { FORMATS, isValid } from '../../lib/vendorFormats';
import { cx } from '../../lib/format';

/** An input that only accepts the right characters and says what is wrong */
export function FormatInput({ type, value, onChange, ...props }) {
  const [left, setLeft] = useState(false);
  const f = FORMATS[type];
  // complain once the field is left, not while the vendor is still typing
  const error = left && !isValid(type, value) ? `Check the format — ${f.hint}` : undefined;
  return (
    <Input {...props} value={value || ''} placeholder={f.placeholder} inputMode={f.inputMode} hint={f.hint} error={error}
      autoComplete="off" spellCheck={false} onBlur={() => setLeft(true)} onFocus={() => setLeft(false)} onChange={(e) => onChange(f.clean(e.target.value))} />
  );
}

/** Text input with a suggestion list underneath. `load(query)` returns rows of { key, title, detail } */
function Suggest({ label, value, onType, onPick, load, minChars = 2, seed = [], inputProps, hint }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState([]);
  const [active, setActive] = useState(-1);
  const [problem, setProblem] = useState('');
  const [typed, setTyped] = useState(false);
  const ref = useRef(null);
  const query = useDebounce(value || '', 350);
  useOutside(ref, () => setOpen(false), open);

  useEffect(() => {
    if (!open || !typed || query.length < minChars) { setRows([]); return undefined; }
    let stale = false;
    load(query)
      .then((list) => { if (!stale) { setRows(list); setProblem(''); setActive(-1); } })
      .catch((e) => { if (!stale) { setRows([]); setProblem(e.message); } });
    return () => { stale = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, open, typed]);

  const shown = typed && query.length >= minChars ? rows : seed;
  const choose = (row) => { setOpen(false); setTyped(false); onPick(row); };
  const onKeyDown = (e) => {
    if (e.key === 'Escape') return setOpen(false);
    if (!open || !shown.length) return undefined;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (i + (e.key === 'ArrowDown' ? 1 : -1) + shown.length) % shown.length);
    } else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); choose(shown[active]); }
    return undefined;
  };

  return (
    <Field label={label} htmlFor={id} hint={problem || hint}>
      <div ref={ref} className="relative">
        <input id={id} className="input" role="combobox" aria-expanded={open && shown.length > 0} aria-controls={`${id}-list`} aria-autocomplete="list" autoComplete="off"
          value={value || ''} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onKeyDown={onKeyDown} onChange={(e) => { setTyped(true); setOpen(true); onType(e.target.value); }} {...inputProps} />
        {open && shown.length > 0 && (
          <ul id={`${id}-list`} role="listbox" className="absolute left-0 right-0 z-30 mt-1.5 max-h-64 overflow-y-auto rounded-brand border border-line bg-card p-1.5 shadow-pop">
            {shown.map((row, i) => (
              <li key={row.key} role="option" aria-selected={i === active}>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => choose(row)}
                  className={cx('flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm', i === active ? 'bg-primary-soft text-primary' : 'hover:bg-surface')}>
                  <MapPin size={15} className="flex-none text-muted" />
                  <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{row.title}</span>{row.detail && <span className="block truncate text-xs text-muted">{row.detail}</span>}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Field>
  );
}

const position = () => new Promise((resolve, reject) => {
  if (!navigator.geolocation) { reject(new Error('This browser can’t share its location')); return; }
  navigator.geolocation.getCurrentPosition(resolve, (e) => reject(new Error(e.code === 1 ? 'Location permission was denied — allow it in the browser or type the address' : 'Couldn’t read your location, try again')), { enableHighAccuracy: true, timeout: 12000 });
});

/** Address (with "use current location"), city and pincode suggestions, state filled from the city */
export function AddressFields({ value = {}, onChange }) {
  const id = useId();
  const [locating, setLocating] = useState(false);
  const [note, setNote] = useState('');
  const [nearby, setNearby] = useState([]); // pincodes of the chosen city
  const [session] = useState(() => crypto.randomUUID?.() || String(Date.now())); // groups keystrokes into one billed Google session
  const latest = useRef(value);
  latest.current = value;
  const set = (patch) => onChange({ ...latest.current, ...patch });

  const locate = async () => {
    setLocating(true);
    setNote('');
    try {
      const { coords } = await position();
      const { data } = await api.post('/vendor/places/reverse', { lat: coords.latitude, lng: coords.longitude });
      set(Object.fromEntries(Object.entries(data).filter(([, v]) => v)));
      setNote('Filled from your current location — please check it');
    } catch (e) { setNote(e.message); } finally { setLocating(false); }
  };

  const pickCity = async (row) => {
    set({ city: row.title, ...(row.title !== latest.current.city && { pincode: '' }) });
    setNearby([]);
    try {
      const { data } = await api.get('/vendor/places/city', { placeId: row.key, session });
      set({ state: data.state || latest.current.state, ...(data.pincodes.length === 1 && { pincode: data.pincodes[0] }) });
      setNearby(data.pincodes);
    } catch (e) { setNote(e.message); }
  };

  return (
    <>
      <Field label="Address *" htmlFor={id} className="sm:col-span-2" hint={note || 'Building, street, area'}>
        <div className="relative">
          <input id={id} className="input sm:!pr-52" maxLength={200} value={value.line1 || ''} onChange={(e) => set({ line1: e.target.value })} />
          <button type="button" onClick={locate} disabled={locating}
            className="mt-2 inline-flex items-center gap-1.5 text-sm font-bold text-primary disabled:opacity-50 sm:absolute sm:right-2 sm:top-1/2 sm:mt-0 sm:-translate-y-1/2 sm:rounded-lg sm:bg-primary-soft sm:px-3 sm:py-1.5">
            {locating ? <Loader2 size={15} className="spin" /> : <LocateFixed size={15} />}Use current location
          </button>
        </div>
      </Field>
      <Suggest label="City *" value={value.city} hint="Start typing and pick your city" inputProps={{ maxLength: 60, placeholder: 'Jaipur' }}
        onType={(city) => { setNearby([]); set({ city }); }} onPick={pickCity}
        load={async (q) => (await api.get('/vendor/places/cities', { q, session })).data.map((c) => ({ key: c.placeId, title: c.name, detail: c.detail }))} />
      <Input label="State *" maxLength={60} value={value.state || ''} onChange={(e) => set({ state: e.target.value })} hint="Filled when you pick a city" />
      <Suggest label="Pincode *" value={value.pincode} minChars={3} hint={nearby.length ? 'Pick yours from the list or type it' : FORMATS.pincode.hint}
        seed={nearby.map((p) => ({ key: p, title: p, detail: value.city }))} inputProps={{ inputMode: 'numeric', placeholder: FORMATS.pincode.placeholder }}
        onType={(v) => set({ pincode: FORMATS.pincode.clean(v) })} onPick={(row) => set({ pincode: row.key })}
        load={async (q) => (await api.get('/vendor/places/pincodes', { q, city: latest.current.city })).data.map((r) => ({ key: r.pincode, title: r.pincode, detail: r.detail }))} />
    </>
  );
}

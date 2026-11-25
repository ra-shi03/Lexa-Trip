import { useRef, useState } from 'react';
import { MapPin, Building2 } from 'lucide-react';
import { api } from '../../lib/api';
import { useApi, useDebounce, useOutside } from '../../hooks/useApi';

/** Destination autocomplete (cities + property names) for the stays search cell. */
export function LocationInput({ value, onChange, onPickProperty, label = 'Where', placeholder = 'City, area or property' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const q = useDebounce(value, 200);
  useOutside(ref, () => setOpen(false), open);
  const { data } = useApi(() => (q?.length >= 2 ? api.get('/public/suggest', { q }) : Promise.resolve({ data: null })), [q]);
  const { data: popular } = useApi(() => api.get('/public/cities', { popular: 1 }), []);
  const showPopular = !value || value.length < 2;

  return (
    <div className="search-cell min-w-[200px] flex-[1.4]" ref={ref}>
      <label htmlFor="loc-input">{label}</label>
      <input id="loc-input" value={value} autoComplete="off" placeholder={placeholder} onFocus={() => setOpen(true)} onChange={(e) => { onChange(e.target.value); setOpen(true); }} />
      {open && (
        <div className="animate-fade-up absolute left-0 top-full z-30 mt-2 w-full min-w-[300px] overflow-hidden rounded-brand-lg border border-line bg-card py-2 shadow-pop">
          {showPopular ? (
            <>
              <p className="px-4 py-1.5 text-[11px] font-bold uppercase tracking-wide text-muted">Popular destinations</p>
              {popular?.slice(0, 6).map((c) => (
                <button key={c._id} type="button" className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface" onClick={() => { onChange(c.name); setOpen(false); }}>
                  <MapPin size={17} className="text-muted" /><span><b className="text-sm">{c.name}</b><span className="block text-xs text-muted">{c.state?.name}</span></span>
                </button>
              ))}
            </>
          ) : (
            <>
              {data?.cities?.map((c) => (
                <button key={c._id} type="button" className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface" onClick={() => { onChange(c.name); setOpen(false); }}>
                  <MapPin size={17} className="text-primary" /><span><b className="text-sm">{c.name}</b><span className="block text-xs text-muted">{c.state}</span></span>
                </button>
              ))}
              {data?.properties?.map((p) => (
                <button key={p._id} type="button" className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface" onClick={() => { setOpen(false); onPickProperty?.(p); }}>
                  <Building2 size={17} className="text-muted" /><span><b className="text-sm">{p.name}</b><span className="block text-xs text-muted">{[p.area, p.city].filter(Boolean).join(', ')}</span></span>
                </button>
              ))}
              {data && !data.cities?.length && !data.properties?.length && <p className="px-4 py-3 text-sm text-muted">No matches — we’ll search by name.</p>}
            </>
          )}
        </div>
      )}
    </div>
  );
}

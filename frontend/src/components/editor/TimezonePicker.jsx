import { useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, Check, Globe2 } from 'lucide-react';
import { useOutside } from '../../hooks/useApi';
import { cx, offsetName } from '../../lib/format';

// Some browsers still list pre-2014 names (Chromium: "Asia/Calcutta") — show the current IANA name instead
const LEGACY = { 'Asia/Calcutta': 'Asia/Kolkata', 'Asia/Katmandu': 'Asia/Kathmandu', 'Asia/Saigon': 'Asia/Ho_Chi_Minh', 'Asia/Rangoon': 'Asia/Yangon', 'Europe/Kiev': 'Europe/Kyiv', 'Etc/UTC': 'UTC' };
// Extra search words (country, common abbreviation) for zones people look for by country
const KEYWORDS = {
  'Asia/Kolkata': 'india ist mumbai delhi bengaluru chennai calcutta', 'UTC': 'gmt universal zulu', 'Asia/Dubai': 'uae gst emirates abu dhabi',
  'Europe/London': 'uk gmt bst britain england', 'America/New_York': 'usa us eastern et est edt', 'Asia/Singapore': 'sgt', 'Asia/Kathmandu': 'nepal npt',
  'Asia/Dhaka': 'bangladesh bst', 'Asia/Colombo': 'sri lanka', 'Asia/Karachi': 'pakistan pkt', 'Asia/Riyadh': 'saudi arabia ast', 'Asia/Bangkok': 'thailand ict',
  'Asia/Tokyo': 'japan jst', 'Australia/Sydney': 'aest aedt', 'America/Los_Angeles': 'usa us pacific pt pst pdt', 'Europe/Paris': 'france cet', 'Europe/Berlin': 'germany cet',
};

/** Every IANA zone the browser knows (+ UTC), with its current GMT offset — sorted by offset, then name. */
function allZones() {
  const names = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : Object.keys(KEYWORDS);
  const list = [...new Set(['UTC', 'Asia/Kolkata', ...names.map((z) => LEGACY[z] || z)])].map((z) => {
    const off = offsetName(z);
    const m = off.match(/GMT([+-])(\d{2}):(\d{2})/);
    const mins = m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0;
    return { zone: z, offset: off, mins, label: z.replace(/_/g, ' '), keys: `${z} ${KEYWORDS[z] || ''}`.toLowerCase() };
  });
  return list.sort((a, b) => a.mins - b.mins || a.zone.localeCompare(b.zone));
}

const clockIn = (zone) => new Date().toLocaleTimeString('en-IN', { timeZone: zone, hour: '2-digit', minute: '2-digit' });

/**
 * Searchable timezone chooser (search by city, region or offset: "kolkata", "europe", "+05:30").
 *   <TimezonePicker value="Asia/Kolkata" onChange={(zone) => …} />
 */
export function TimezonePicker({ label, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef(null);
  useOutside(ref, () => setOpen(false), open);
  const zones = useMemo(allZones, []);
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase().replace(/\s+/g, '_');
    const words = q.trim().toLowerCase();
    if (!s) return zones;
    // rank: country / abbreviation keyword → city name starting with the text → anything else that matches
    const rank = (z) => (KEYWORDS[z.zone]?.split(' ').some((k) => k.startsWith(words)) ? 0 : z.zone.split('/').pop().toLowerCase().startsWith(s) ? 1 : 2);
    return zones
      .filter((z) => z.keys.includes(s) || z.keys.includes(words) || z.offset.toLowerCase().includes(s.replace(/^gmt/, '')))
      .map((z) => ({ z, r: rank(z) }))
      .sort((a, b) => a.r - b.r)
      .map(({ z }) => z);
  }, [q, zones]);
  const current = zones.find((z) => z.zone === value);

  return (
    <div ref={ref} className="relative" onKeyDown={(e) => { if (open && e.key === 'Escape') { e.stopPropagation(); setOpen(false); } }}>
      {label && <p className="field-label">{label}</p>}
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open}
        className={cx('input flex h-auto min-h-12 items-center gap-3 py-2 text-left', open && 'border-primary ring-2 ring-primary/15')}>
        <Globe2 size={18} className="flex-none text-primary" />
        <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{current?.label || value || 'Choose a timezone'}</span><span className="block text-xs text-muted">{current ? `${current.offset} · now ${clockIn(current.zone)}` : ''}</span></span>
        <ChevronDown size={16} className={cx('flex-none text-muted transition', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute left-0 right-0 z-30 mt-1.5 rounded-brand border border-line bg-card p-2 shadow-pop">
          <label className="flex h-10 items-center gap-2 rounded-brand border border-line bg-surface px-3 text-sm focus-within:border-primary">
            <Search size={15} className="text-muted" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search city, region or offset (e.g. Kolkata, Europe, +04:00)" className="min-w-0 flex-1 bg-transparent outline-none" />
          </label>
          <ul role="listbox" className="mt-2 max-h-72 overflow-y-auto">
            {shown.slice(0, 250).map((z) => {
              const on = z.zone === value;
              return (
                <li key={z.zone}>
                  <button type="button" role="option" aria-selected={on} onClick={() => { onChange(z.zone); setOpen(false); setQ(''); }}
                    className={cx('flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition', on ? 'bg-primary-soft text-primary' : 'hover:bg-surface')}>
                    <span className="w-24 flex-none font-mono text-xs text-muted">{z.offset}</span>
                    <span className="min-w-0 flex-1 truncate font-semibold">{z.label}</span>
                    <span className="flex-none text-xs tabular-nums text-muted">{clockIn(z.zone)}</span>
                    {on && <Check size={15} className="flex-none" />}
                  </button>
                </li>
              );
            })}
            {!shown.length && <li className="px-3 py-6 text-center text-sm text-muted">No timezone matches “{q}”</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

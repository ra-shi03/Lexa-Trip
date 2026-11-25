import { useRef, useState } from 'react';
import { Counter, Button } from '../ui';
import { useOutside } from '../../hooks/useApi';
import { plural } from '../../lib/format';

export function GuestPicker({ value, onChange, maxRooms = 8 }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useOutside(ref, () => setOpen(false), open);
  const { adults, children, rooms } = value;
  const set = (k, v) => {
    const next = { ...value, [k]: v };
    if (k === 'rooms' && next.adults < v) next.adults = v; // at least 1 adult per room
    onChange(next);
  };
  return (
    <div className="search-cell min-w-[170px]" ref={ref}>
      <label>Guests &amp; rooms</label>
      <button type="button" className="cell-value truncate" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {plural(adults + children, 'guest')}, {plural(rooms, 'room')}
      </button>
      {open && (
        <div className="animate-fade-up absolute right-0 top-full z-30 mt-2 w-[300px] rounded-brand-lg border border-line bg-card p-4 shadow-pop">
          <Counter label="Adults" sub="13+ years" value={adults} min={rooms} max={rooms * 4} onChange={(v) => set('adults', v)} />
          <Counter label="Children" sub="0–12 years" value={children} min={0} max={rooms * 3} onChange={(v) => set('children', v)} />
          <Counter label="Rooms" value={rooms} min={1} max={maxRooms} onChange={(v) => set('rooms', v)} />
          <Button size="sm" block className="mt-3" onClick={() => setOpen(false)}>Done</Button>
        </div>
      )}
    </div>
  );
}

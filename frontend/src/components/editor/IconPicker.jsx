import { useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, Check } from 'lucide-react';
import { ICONS, DynIcon } from '../stay/StayComponents';
import { useOutside } from '../../hooks/useApi';
import { cx, titleCase } from '../../lib/format';

const nice = (k) => titleCase(k.replace(/-/g, ' '));

/**
 * Visual icon chooser (replaces a long native <select> of icon names).
 *   <IconPicker label="Icon" value="bed-double" onChange={(name) => …} />
 * Names are the keys of ICONS (components/stay/StayComponents) — the same names <DynIcon> renders.
 */
export function IconPicker({ label, value, onChange, className }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [hover, setHover] = useState(null);
  const ref = useRef(null);
  useOutside(ref, () => { setOpen(false); setHover(null); }, open);
  const names = useMemo(() => Object.keys(ICONS).sort().filter((k) => !q || k.includes(q.toLowerCase().trim().replace(/\s+/g, '-'))), [q]);

  return (
    // Escape closes only the picker, not the modal around it (Overlay listens for Escape on window)
    <div ref={ref} className={cx('relative', className)} onKeyDown={(e) => { if (open && e.key === 'Escape') { e.stopPropagation(); setOpen(false); } }}>
      {label && <p className="field-label">{label}</p>}
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open}
        className={cx('input flex items-center gap-2.5 text-left', open && 'border-primary ring-2 ring-primary/15')}>
        <span className="grid h-7 w-7 flex-none place-items-center rounded-lg bg-primary-soft text-primary"><DynIcon name={value} size={16} /></span>
        <span className="min-w-0 flex-1 truncate">{value ? nice(value) : 'Choose an icon'}</span>
        <ChevronDown size={16} className={cx('flex-none text-muted transition', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute left-0 right-0 z-30 mt-1.5 rounded-brand border border-line bg-card p-3 shadow-pop">
          <label className="flex h-9 items-center gap-2 rounded-brand border border-line bg-surface px-3 text-sm focus-within:border-primary">
            <Search size={15} className="text-muted" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search icons" className="min-w-0 flex-1 bg-transparent outline-none" />
          </label>
          <div role="listbox" className="mt-3 grid max-h-56 grid-cols-6 gap-1.5 overflow-y-auto pr-0.5 sm:grid-cols-8">
            {names.map((k) => {
              const active = k === value;
              return (
                <button key={k} type="button" role="option" aria-selected={active} title={nice(k)} aria-label={nice(k)}
                  onClick={() => { onChange(k); setOpen(false); setQ(''); }} onMouseEnter={() => setHover(k)} onFocus={() => setHover(k)}
                  className={cx('relative grid aspect-square place-items-center rounded-lg border transition',
                    active ? 'border-primary bg-primary text-white' : 'border-transparent text-ink hover:border-line hover:bg-primary-soft hover:text-primary')}>
                  <DynIcon name={k} size={18} />
                  {active && <Check size={10} className="absolute right-0.5 top-0.5" />}
                </button>
              );
            })}
            {!names.length && <p className="col-span-full py-6 text-center text-sm text-muted">No icon matches “{q}”</p>}
          </div>
          <div className="mt-2.5 flex items-center justify-between border-t border-line pt-2.5 text-xs">
            <span className="flex items-center gap-1.5 font-semibold text-ink">{(hover || value) && <DynIcon name={hover || value} size={14} />}{hover || value ? nice(hover || value) : 'Hover an icon to see its name'}</span>
            <span className="text-muted">{names.length} icons</span>
          </div>
        </div>
      )}
    </div>
  );
}

import { Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '../ui';

/**
 * Generic list editor: rooms, days, activities, experiences, dining, attractions, FAQs, links…
 *   <Repeater items={arr} onChange={setArr} newItem={() => ({})} addLabel="Add day" render={(item, update, i) => <…/>} />
 */
export function Repeater({ items = [], onChange, newItem, render, addLabel = 'Add', title, compact, max = 200 }) {
  const update = (i) => (patch) => onChange(items.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const move = (i, d) => { const a = [...items]; [a[i], a[i + d]] = [a[i + d], a[i]]; onChange(a); };
  return (
    <div className="space-y-3">
      {title && <p className="field-label">{title}</p>}
      {items.map((item, i) => (
        <div key={item._id || i} className={compact ? 'flex items-start gap-2' : 'rounded-brand border border-line bg-card p-4'}>
          <div className="min-w-0 flex-1">{render(item, update(i), i)}</div>
          <div className={compact ? 'flex gap-0.5 pt-1' : 'mt-3 flex justify-end gap-1 border-t border-line pt-3'}>
            <Button size="xs" variant="ghost" icon={ArrowUp} disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up" />
            <Button size="xs" variant="ghost" icon={ArrowDown} disabled={i === items.length - 1} onClick={() => move(i, 1)} aria-label="Move down" />
            <Button size="xs" variant="ghost" icon={Trash2} className="text-danger" onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label="Remove" />
          </div>
        </div>
      ))}
      {items.length < max && <Button variant="soft" size="sm" icon={Plus} onClick={() => onChange([...items, newItem()])}>{addLabel}</Button>}
    </div>
  );
}

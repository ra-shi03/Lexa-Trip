import { useEffect, useState } from 'react';

/** Type a position and press Enter (or click away) to move the card there */
export function SortOrder({ position, count, label, onMove }) {
  const [text, setText] = useState(String(position));
  useEffect(() => setText(String(position)), [position]);
  const commit = () => {
    const n = Math.min(count, Math.max(1, parseInt(text, 10) || position));
    setText(String(n));
    if (n !== position) onMove(n);
  };
  return (
    <input type="number" inputMode="numeric" min={1} max={count} value={text} aria-label={label} title="Sort order"
      className="input input-sm !w-16 flex-none !px-2 text-center font-bold"
      onChange={(e) => setText(e.target.value)} onBlur={commit} onFocus={(e) => e.target.select()}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }} />
  );
}

import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { MapPin } from 'lucide-react';
import { cx } from '../../lib/format';

/** Full-bleed hero background slideshow (images/captions come from Admin → Home page). */
export function HeroSlider({ slides = [], overlay = 0.55, seconds = 6, captions = true, fade = true }) {
  const [i, setI] = useState(0);
  const list = slides.filter((s) => s.url);
  useEffect(() => {
    if (list.length < 2) return undefined;
    const t = setInterval(() => setI((x) => (x + 1) % list.length), Math.max(3, seconds) * 1000);
    return () => clearInterval(t);
  }, [list.length, seconds]);
  if (!list.length) return null;
  const cur = list[i % list.length];
  return (
    <>
      <div className="absolute inset-0 -z-10 bg-secondary" aria-hidden="true">
        {list.map((s, n) => (
          <div key={s.url + n} className={cx('hero-slide', n === i % list.length && 'active')}>
            <img src={s.url} alt={s.title || ''} loading={n === 0 ? 'eager' : 'lazy'} fetchPriority={n === 0 ? 'high' : 'auto'} />
          </div>
        ))}
        <div className="absolute inset-0" style={{ background: `linear-gradient(90deg, rgb(20 33 61 / ${overlay + 0.2}) 0%, rgb(20 33 61 / ${overlay}) 45%, rgb(20 33 61 / ${overlay * 0.45}) 100%)` }} />
        {fade && <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-bg to-transparent" />}
      </div>
      {captions && (cur.title || list.length > 1) && (
        <div className="relative mt-8 flex items-center justify-between gap-4">
          {cur.title ? (
            <Link to={cur.link || '/search'} className="flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/25">
              <MapPin size={15} />{cur.title}{cur.subtitle ? <span className="text-white/70">· {cur.subtitle}</span> : null}
            </Link>
          ) : <span />}
          {list.length > 1 && <div className="flex gap-1.5">{list.map((_, n) => <button key={n} aria-label={`Slide ${n + 1}`} className={cx('hero-dot', n === i % list.length && 'active')} onClick={() => setI(n)} />)}</div>}
        </div>
      )}
    </>
  );
}

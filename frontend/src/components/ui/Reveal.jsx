import { useEffect, useRef, useState } from 'react';
import { cx } from '../../lib/format';

/** Fades/slides children in when they scroll into view. <Reveal delay={80}>…</Reveal> */
export function Reveal({ children, delay = 0, className, as: Tag = 'div', scale }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(typeof IntersectionObserver === 'undefined');
  useEffect(() => {
    if (shown || !ref.current) return undefined;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setShown(true); io.disconnect(); } }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [shown]);
  return <Tag ref={ref} style={{ transitionDelay: `${delay}ms` }} className={cx('reveal', scale && 'reveal-scale', shown && 'in', className)}>{children}</Tag>;
}

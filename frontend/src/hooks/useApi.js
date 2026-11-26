import { useCallback, useEffect, useRef, useState } from 'react';
import { useLive } from '../lib/live';

/**
 * Minimal data-fetching hook (no external cache library to keep the stack lean).
 *   const { data, meta, loading, error, reload, setData } = useApi(() => api.get('/x'), [deps])
 * Guest-facing screens can pass `{ live: 'content' }` (or 'settings', or both) to re-fetch quietly — no loading
 * state, data swapped in place — whenever the admin changes that on the server (see lib/live.js).
 * Don't use `live` for data that seeds an editable form.
 */
export function useApi(fn, deps = [], { enabled = true, live } = {}) {
  const [state, setState] = useState({ data: undefined, meta: undefined, loading: enabled, error: null });
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const seq = useRef(0);

  const run = useCallback(async (silent) => {
    const id = ++seq.current;
    if (!silent) setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await fnRef.current();
      if (id === seq.current) setState({ data: res?.data, meta: res?.meta, loading: false, error: null });
    } catch (e) {
      if (id === seq.current) setState((s) => (silent ? { ...s, loading: false } : { ...s, loading: false, error: e })); // a failed background refresh keeps the old data
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  const load = useCallback(() => run(false), [run]);

  useEffect(() => {
    if (enabled) load();
    else setState((s) => ({ ...s, loading: false }));
  }, [load, enabled]);

  useLive(enabled ? live : null, () => run(true));

  return { ...state, reload: load, setData: (updater) => setState((s) => ({ ...s, data: typeof updater === 'function' ? updater(s.data) : updater })) };
}

export function useDebounce(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function useMediaQuery(q) {
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setM(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [q]);
  return m;
}

/** Click-outside handler for popovers */
export function useOutside(ref, onOutside, active = true) {
  useEffect(() => {
    if (!active) return undefined;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onOutside(); };
    document.addEventListener('mousedown', h);
    document.addEventListener('touchstart', h);
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('touchstart', h); };
  }, [ref, onOutside, active]);
}

import { useEffect, useRef } from 'react';
import { API_BASE } from './api';

/**
 * Live updates from the server (SSE: GET /api/v1/public/live).
 * When the admin saves something guests can see, the server sends { topic: 'settings' | 'content', scope }
 * and subscribed screens re-fetch quietly — no page refresh. One shared connection per tab; the browser
 * reconnects by itself, and after a reconnect every subscriber gets topic '*' (events may have been missed).
 */
const subscribers = new Set();
let source = null;
let connectedOnce = false;
let retryTimer = null;

const emit = (evt) => subscribers.forEach((fn) => { try { fn(evt); } catch { /* one bad subscriber must not break the rest */ } });

function connect() {
  if (source || typeof window === 'undefined' || typeof EventSource === 'undefined') return;
  source = new EventSource(`${API_BASE}/public/live`);
  source.addEventListener('hello', () => {
    if (connectedOnce) emit({ topic: '*', reason: 'reconnect' });
    connectedOnce = true;
  });
  source.addEventListener('change', (e) => { try { emit(JSON.parse(e.data)); } catch { /* malformed event */ } });
  source.onerror = () => {
    // CONNECTING = the browser is already retrying. CLOSED = it gave up (e.g. 429/503) → retry ourselves.
    if (source?.readyState === EventSource.CLOSED) {
      source = null;
      clearTimeout(retryTimer);
      retryTimer = setTimeout(connect, 15000);
    }
  };
}

export function subscribeLive(fn) {
  subscribers.add(fn);
  connect();
  return () => subscribers.delete(fn);
}

/**
 * Calls `onChange` (debounced) when one of `topics` changes on the server.
 *   useLive('settings', reload)   ·   useLive(['content'], refetch)
 */
export function useLive(topics, onChange, { delay = 400 } = {}) {
  const fn = useRef(onChange);
  fn.current = onChange;
  const key = [].concat(topics || []).join(',');
  useEffect(() => {
    if (!key) return undefined;
    const want = key.split(',');
    let t;
    const off = subscribeLive((evt) => {
      if (evt.topic !== '*' && !want.includes(evt.topic)) return;
      clearTimeout(t);
      t = setTimeout(() => fn.current(evt), delay); // a bulk admin save fires many events → one re-fetch
    });
    return () => { off(); clearTimeout(t); };
  }, [key, delay]);
}

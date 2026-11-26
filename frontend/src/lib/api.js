import axios from 'axios';

/**
 * Single API client for the guest app, vendor panel and admin panel.
 * Each audience has its own token; the right one is attached based on the URL.
 * Response envelope from the backend: { success, data, meta?, message? }.
 */
export const TOKEN_KEYS = { user: 'lt_user_token', vendor: 'lt_vendor_token', admin: 'lt_admin_token' };

const safeStore = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch { /* storage unavailable */ } },
};
export const tokens = {
  get: (role) => safeStore.get(TOKEN_KEYS[role]),
  set: (role, t) => safeStore.set(TOKEN_KEYS[role], t),
  clear: (role) => safeStore.set(TOKEN_KEYS[role], null),
};

const roleForUrl = (url = '') => {
  if (url.startsWith('/admin') || url.startsWith('/auth/admin')) return 'admin';
  if (url.startsWith('/vendor') || url.startsWith('/auth/vendor')) return 'vendor';
  return 'user';
};

export const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api/v1`;
// withCredentials: the refresh token travels in an httpOnly cookie (never readable from JS)
const http = axios.create({ baseURL: API_BASE, timeout: 30000, withCredentials: true, headers: { 'X-Client': 'web' } });

const MAX_RETRIES = 2;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isIdempotent = (c) => ['get', 'head', 'options'].includes(String(c?.method || 'get').toLowerCase());

/** Global notices (toast) — ToastProvider listens; deduped so a burst of failures shows once */
let lastNotice = { key: '', at: 0 };
function notify(kind, message) {
  const key = `${kind}:${message}`;
  if (key === lastNotice.key && Date.now() - lastNotice.at < 4000) return;
  lastNotice = { key, at: Date.now() };
  window.dispatchEvent(new CustomEvent('lt:notice', { detail: { kind, message } }));
}

// ── Request: attach the right token (by audience) + a request id for log correlation ──
http.interceptors.request.use((config) => {
  const t = tokens.get(roleForUrl(config.url));
  if (t) config.headers.Authorization = `Bearer ${t}`;
  config.headers['X-Request-Id'] = (crypto.randomUUID?.() || String(Date.now()));
  return config;
});

/**
 * Sessions: the access token (15 min) is in localStorage; the refresh token is an httpOnly cookie per audience.
 * On a 401 we renew once via POST /auth/<role>/refresh and replay the request. Concurrent 401s share one refresh
 * (in this tab), and a Web Lock serialises refreshes across tabs — the server rotates refresh tokens, so two
 * parallel refreshes would otherwise race.
 */
const NO_REFRESH = /^\/auth\/(user|vendor|admin)\/(send-otp|verify-otp|login|register|refresh|logout)/;
const inflight = {};
export function refreshSession(role, stale = tokens.get(role)) {
  if (inflight[role]) return inflight[role];
  const run = async () => {
    const current = tokens.get(role);
    if (current && current !== stale) return current; // another tab renewed it while we waited for the lock
    try {
      const res = await axios.post(`${API_BASE}/auth/${role}/refresh`, {}, { withCredentials: true, timeout: 15000, headers: { 'X-Client': 'web' } });
      const t = res.data?.data?.accessToken;
      if (!t) throw new Error('No access token');
      tokens.set(role, t);
      return t;
    } catch (e) {
      if (e.response?.data?.details?.code === 'REFRESH_RACE') { // a parallel refresh won; pick up its token
        await sleep(600);
        const now = tokens.get(role);
        if (now && now !== stale) return now;
      }
      throw e;
    }
  };
  const p = (navigator.locks?.request ? navigator.locks.request(`lt-refresh-${role}`, run) : run());
  inflight[role] = p.finally(() => { inflight[role] = null; });
  return inflight[role];
}

/** Revokes this device's refresh token on the server (best effort) and drops the local access token. */
export async function endSession(role) {
  tokens.clear(role); // first, so a quick re-login can't be wiped by this call finishing late
  try { await axios.post(`${API_BASE}/auth/${role}/logout`, {}, { withCredentials: true, timeout: 8000, headers: { 'X-Client': 'web' } }); } catch { /* offline: the cookie still expires */ }
}

const listeners = new Set();
export const onUnauthorized = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

// ── Response: retry flaky GETs, handle 401 / 403 / 429 / 5xx / offline centrally ──
http.interceptors.response.use(
  (res) => res,
  async (err) => {
    const cfg = err.config || {};
    const status = err.response?.status;
    const offline = !err.response && (err.code === 'ERR_NETWORK' || err.message === 'Network Error');

    // 1) transparent retry (GET only): network blips, 502/503/504 — exponential back-off
    if (isIdempotent(cfg) && (offline || [502, 503, 504].includes(status)) && (cfg.__retry || 0) < MAX_RETRIES) {
      cfg.__retry = (cfg.__retry || 0) + 1;
      await sleep(400 * 2 ** (cfg.__retry - 1));
      return http.request(cfg);
    }

    let message = err.response?.data?.message || (err.code === 'ECONNABORTED' ? 'The request timed out' : offline ? 'Cannot reach the server. Check your connection.' : err.message);

    let announced = false;
    if (status === 401) {
      const role = roleForUrl(cfg.url);
      // 2) access token expired → renew silently with the refresh token and replay the request once
      if (tokens.get(role) && !NO_REFRESH.test(cfg.url || '') && !cfg.__refreshed) {
        cfg.__refreshed = true;
        const sent = String(cfg.headers?.Authorization || '').replace(/^Bearer /, '') || undefined;
        try {
          await refreshSession(role, sent);
          return http.request(cfg); // request interceptor attaches the new token
        } catch (re) {
          if (re.response?.status !== 401) { // network trouble while renewing: keep the session, report the failure
            notify('error', 'Cannot reach the server. Check your connection.');
            const e = new Error('Cannot reach the server. Check your connection.');
            e.status = status; e.silent = true;
            return Promise.reject(e);
          }
        }
      }
      // refresh token missing/expired/revoked → drop the session; <Protected> then redirects to the right login.
      // (a 401 WITHOUT a stored token is e.g. a wrong password — the page shows that message itself)
      if (tokens.get(role) && !NO_REFRESH.test(cfg.url || '')) { announced = true; tokens.clear(role); listeners.forEach((fn) => fn(role)); notify('info', 'Your session has expired. Please sign in again.'); }
    } else if (status === 429) {
      const wait = Number(err.response?.headers?.['retry-after']);
      message = `${message}${wait ? ` (try again in ${wait >= 60 ? `${Math.ceil(wait / 60)} min` : `${wait}s`})` : ''}`;
      notify('error', message);
      announced = true;
    } else if (status >= 500) {
      notify('error', 'Something went wrong on our side. Please try again.');
      announced = true;
    } else if (offline) {
      notify('error', message);
      announced = true;
    }

    const e = new Error(message);
    e.status = status;
    e.details = err.response?.data?.details;
    e.retryAfter = Number(err.response?.headers?.['retry-after']) || undefined;
    e.silent = announced; // already shown as a global notice — pages should not toast it again
    return Promise.reject(e);
  },
);

/** Returns `{ data, meta, message }` */
async function call(method, url, body, config) {
  const res = await http.request({ method, url, data: body, ...config });
  if (config?.responseType === 'blob') return res.data;
  return { data: res.data?.data, meta: res.data?.meta, message: res.data?.message };
}

export const api = {
  get: (url, params, config) => call('get', url, undefined, { params, ...config }),
  post: (url, body, config) => call('post', url, body, config),
  put: (url, body, config) => call('put', url, body, config),
  patch: (url, body, config) => call('patch', url, body, config),
  del: (url, config) => call('delete', url, undefined, config),
  upload: (url, formData) => call('post', url, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  /** Downloads a CSV/file endpoint with auth and saves it */
  download: async (url, params, filename) => {
    const blob = await call('get', url, undefined, { params, responseType: 'blob' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  },
};

/**
 * The same React project serves two experiences:
 *  - website + vendor/admin panels (default)
 *  - customer APP (phone-first shell: splash, onboarding, bottom tabs)
 * App mode is on when: built/served with VITE_APP_MODE=true (`npm run dev:app`), the page runs as an installed
 * PWA (standalone), or the user opened /app (remembered for deep links like /home). Opening / always gives the website. Panels (/admin, /vendor) are never in app mode.
 */
export function isAppMode() {
  try {
    const p = window.location.pathname;
    if (p.startsWith('/admin') || p.startsWith('/vendor')) return false;
    const forced = import.meta.env.VITE_APP_MODE === 'true'
      || window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true; // dedicated app build / installed PWA
    if (forced) return true;
    // Address decides the experience: "/" = website, "/app" = customer app. Other paths keep the last choice.
    if (p === '/app' || p === '/app/') { localStorage.setItem('lt_mode', 'app'); return true; }
    if (p === '/' || p === '/web') { localStorage.removeItem('lt_mode'); return false; }
    return localStorage.getItem('lt_mode') === 'app';
  } catch { return false; }
}

export function switchMode(mode) {
  try { localStorage.setItem('lt_mode', mode); } catch { /* storage unavailable */ }
  window.location.replace('/');
}

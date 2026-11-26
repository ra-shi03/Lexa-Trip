import { Navigate, useLocation } from 'react-router';
import { PageLoader } from '../ui';
import { useAuth } from '../../context/AuthContext';

const HOME = { vendor: '/vendor', admin: '/admin' };
const LOGIN = { user: '/login', vendor: '/vendor/login', admin: '/admin/login' };

/**
 * Route guard. <Protected role="user|vendor|admin" [perm="finance"] [master]>…</Protected>
 *  - waits for the session check (shows `fallback`, e.g. a screen skeleton, or a spinner), then redirects to the right login with ?next=<current page>
 *  - when a token expires mid-session (401 from the API interceptor) the session clears and this
 *    redirects automatically
 *  - role mismatch / missing permission shows "access restricted" (server enforces the same rules)
 */
export function Protected({ role, perm, master, fallback, children }) {
  const auth = useAuth();
  const loc = useLocation();
  if (!auth.ready[role]) return fallback || <PageLoader label="Checking your session…" />;
  if (!auth[role]) {
    // landing on the panel's home needs no ?next= — keeps the login URL clean (/vendor/login)
    const atHome = HOME[role] && loc.pathname.replace(/\/+$/, '') === HOME[role] && !loc.search;
    return <Navigate to={atHome ? LOGIN[role] : `${LOGIN[role]}?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace state={{ from: loc.pathname }} />;
  }
  if (role === 'admin' && ((master && !auth.isMaster) || (perm && !auth.can(perm)))) {
    const revenue = ['finance', 'payouts', 'commission', 'revenue_reports'].includes(perm) || master;
    return (
      <div className="card card-pad mx-auto mt-10 max-w-md text-center">
        <h2 className="text-lg font-bold">Access restricted</h2>
        <p className="mt-1 text-sm text-muted">{revenue ? 'This area is limited to the master admin.' : 'You don’t have permission to view this page.'}</p>
      </div>
    );
  }
  return children;
}

/** Redirects already-signed-in users away from login pages (honours ?next=) */
export function GuestOnly({ role, to, children }) {
  const auth = useAuth();
  const next = new URLSearchParams(useLocation().search).get('next');
  if (auth.ready[role] && auth[role]) return <Navigate to={next && next.startsWith('/') && !next.startsWith('//') ? next : to} replace />;
  return children;
}

/** Entry point of the installed app (/app): signed-in → home, otherwise → login, then home */
export function AppEntry() {
  const auth = useAuth();
  if (!auth.ready.user) return <PageLoader label="Opening LexaTrip…" />;
  return <Navigate to={auth.user ? '/' : '/login?next=%2F'} replace />;
}

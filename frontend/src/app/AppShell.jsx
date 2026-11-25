import { useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { ArrowLeft, Bell, Home, Search, Briefcase, Sparkles, User } from 'lucide-react';
import { useSettings } from '@/context/SettingsContext';
import { useAuth } from '@/context/AuthContext';
import { cx } from '@/lib/format';

const TITLES = [
  ['/search', 'Explore stays'], ['/stay/', 'Stay details'], ['/checkout', 'Checkout'], ['/booking/', 'Booking'], ['/bus', 'Bus tickets'], ['/flights/book', 'Passengers'], ['/flights', 'Flights'],
  ['/ai', 'Lexa AI'], ['/offers', 'Offers & coupons'], ['/profile', 'Profile'], ['/account/trips', 'My trips'], ['/account/travellers', 'Saved travellers'], ['/account/saved', 'Saved stays'],
  ['/account/notifications', 'Notifications'], ['/account/support', 'Help & support'], ['/account', 'Edit profile'], ['/p/', ''],
];
const ROOTS = ['/home', '/search', '/account/trips', '/ai', '/profile'];

/** Native-style frame: sticky top bar with back button, content, bottom tab bar. Re-themes live from the admin panel. */
export function AppShell() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { feature, ai, features } = useSettings();
  const { user } = useAuth();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);

  if (features?.maintenanceMode === true && !pathname.startsWith('/p/')) {
    return <div className="app-frame grid place-items-center p-8 text-center"><div><h1 className="text-2xl font-extrabold">We’ll be right back</h1><p className="mt-2 text-muted">The app is under scheduled maintenance.</p></div></div>;
  }

  const isRoot = ROOTS.includes(pathname);
  const title = TITLES.find(([p]) => pathname.startsWith(p))?.[1];
  const tabs = [
    { to: '/home', label: 'Home', icon: Home },
    { to: '/search', label: 'Explore', icon: Search },
    { to: '/account/trips', label: 'Trips', icon: Briefcase },
    (feature('aiAssistant') || feature('aiTripPlanner')) && { to: '/ai', label: (ai?.assistantName || 'Lexa AI').split(' ')[0], icon: Sparkles },
    { to: '/profile', label: 'Profile', icon: User },
  ].filter(Boolean);

  return (
    <div className={cx('app-frame', isRoot ? 'pb-24' : 'pb-8')}>
      {pathname !== '/home' && (
        <header className="pt-safe sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-line bg-bg/95 px-3 backdrop-blur">
          <button onClick={() => (isRoot || window.history.length <= 1 ? navigate('/home') : navigate(-1))} className="grid h-10 w-10 flex-none place-items-center rounded-full bg-surface text-ink transition hover:bg-line active:scale-90" aria-label="Back"><ArrowLeft size={20} /></button>
          <h1 className="flex-1 truncate font-display text-lg font-extrabold">{title}</h1>
          {user && <button onClick={() => navigate('/account/notifications')} className="grid h-10 w-10 place-items-center rounded-full bg-surface transition hover:bg-line active:scale-90" aria-label="Notifications"><Bell size={20} /></button>}
        </header>
      )}
      <main><Outlet /></main>
      {isRoot && <nav className="safe-bottom fixed bottom-0 left-1/2 z-40 w-full max-w-[480px] -translate-x-1/2 border-t border-line bg-bg/95 backdrop-blur" aria-label="App navigation">
        <ul className="grid" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
          {tabs.map((t) => (
            <li key={t.to}>
              <NavLink to={t.to} className={({ isActive }) => cx('flex h-16 flex-col items-center justify-center gap-1 text-xs font-semibold transition', isActive ? 'text-primary' : 'text-muted')}>
                {({ isActive }) => (<><span className={cx('grid h-7 w-12 place-items-center rounded-full transition', isActive && 'bg-primary-soft')}><t.icon size={20} /></span>{t.label}</>)}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>}
    </div>
  );
}

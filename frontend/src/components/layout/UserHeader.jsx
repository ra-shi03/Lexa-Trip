import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router';
import { BedDouble, Bus, Plane, Sparkles, Heart, User, LogOut, Briefcase, Bell, Users, LifeBuoy, ChevronDown } from 'lucide-react';
import { Logo } from './Logo';
import { useSettings } from '../../context/SettingsContext';
import { useAuth } from '../../context/AuthContext';
import { useOutside } from '../../hooks/useApi';
import { Avatar, Button } from '../ui';
import { cx } from '../../lib/format';

export function useServiceNav() {
  const { feature, ai } = useSettings();
  return [
    feature('hotels') && { to: '/search', label: 'Stays', icon: BedDouble, match: ['/search', '/stay'] },
    feature('buses') && { to: '/bus', label: 'Buses', icon: Bus },
    feature('flights') && { to: '/flights', label: 'Flights', icon: Plane },
    (feature('aiAssistant') || feature('aiTripPlanner')) && { to: '/ai', label: ai?.assistantName || 'Lexa AI', icon: Sparkles, highlight: true },
  ].filter(Boolean);
}

export function UserHeader() {
  const nav = useServiceNav();
  const { user, logout } = useAuth();
  const { feature } = useSettings();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  useOutside(menuRef, () => setOpen(false), open);

  return (
    <header className={cx('sticky top-0 z-40 border-b bg-bg/90 backdrop-blur-md transition-all duration-300', scrolled ? 'border-line shadow-card' : 'border-transparent')}>
      <div className={cx('mx-auto flex max-w-7xl items-center gap-6 px-4 transition-all duration-300 sm:px-6', scrolled ? 'h-14' : 'h-16')}>
        <Logo />
        <nav className="hidden items-center gap-1 md:flex" aria-label="Services">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) => cx('flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold transition', isActive ? 'bg-secondary text-white' : n.highlight ? 'text-primary hover:bg-primary-soft' : 'text-ink hover:bg-surface')}
            >
              <n.icon size={17} /> {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1.5">
          {feature('wishlist') && user && (
            <Link to="/account/saved" className="hidden h-10 w-10 place-items-center rounded-full text-ink hover:bg-surface sm:grid" aria-label="Saved stays"><Heart size={19} /></Link>
          )}
          {user ? (
            <div className="relative" ref={menuRef}>
              <button onClick={() => setOpen((o) => !o)} className="flex h-10 items-center gap-2 rounded-full border border-line pl-1 pr-3 hover:shadow-card" aria-expanded={open}>
                <Avatar name={user.name || 'Guest'} src={user.avatar} size={32} />
                <span className="hidden max-w-[120px] truncate text-sm font-semibold sm:block">{user.name || 'My account'}</span>
                <ChevronDown size={15} className="text-muted" />
              </button>
              {open && (
                <div className="animate-fade-up absolute right-0 mt-2 w-60 overflow-hidden rounded-brand-lg border border-line bg-card py-1.5 shadow-pop" onClick={() => setOpen(false)}>
                  {[
                    ['/account/trips', 'My trips', Briefcase],
                    ['/account', 'Profile', User],
                    feature('savedTravellers') && ['/account/travellers', 'Saved travellers', Users],
                    feature('wishlist') && ['/account/saved', 'Saved stays', Heart],
                    ['/account/notifications', 'Notifications', Bell],
                    ['/account/support', 'Help & support', LifeBuoy],
                  ].filter(Boolean).map(([to, label, Icon]) => (
                    <Link key={to} to={to} className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium hover:bg-surface"><Icon size={17} className="text-muted" />{label}</Link>
                  ))}
                  <div className="divider my-1.5" />
                  <button onClick={() => { logout('user'); navigate('/'); }} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm font-medium text-danger hover:bg-surface"><LogOut size={17} />Sign out</button>
                </div>
              )}
            </div>
          ) : (
            <Button size="sm" variant="secondary" href="/app" icon={User}>Login</Button>
          )}
        </div>
      </div>
    </header>
  );
}

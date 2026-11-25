import { NavLink } from 'react-router';
import { Home, Search, Briefcase, Sparkles, User } from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';
import { cx } from '../../lib/format';

/** App-style bottom navigation on phones — mirrors the future Flutter BottomNavigationBar. */
export function MobileTabBar() {
  const { feature, ai } = useSettings();
  const tabs = [
    { to: '/', label: 'Home', icon: Home, end: true },
    { to: '/search', label: 'Explore', icon: Search },
    (feature('aiAssistant') || feature('aiTripPlanner')) && { to: '/ai', label: ai?.assistantName?.split(' ')[0] || 'AI', icon: Sparkles },
    { to: '/account/trips', label: 'Trips', icon: Briefcase },
    { to: '/account', label: 'Profile', icon: User, end: true },
  ].filter(Boolean);
  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/95 backdrop-blur md:hidden" aria-label="App navigation">
      <ul className="grid" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
        {tabs.map((t) => (
          <li key={t.to}>
            <NavLink to={t.to} end={t.end} className={({ isActive }) => cx('flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold', isActive ? 'text-primary' : 'text-muted')}>
              <t.icon size={21} />
              {t.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

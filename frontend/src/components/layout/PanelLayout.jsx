import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { Menu, X, LogOut, Bell, ExternalLink, ChevronDown } from 'lucide-react';
import { Logo } from './Logo';
import { Avatar } from '../ui';
import { cx } from '../../lib/format';

/**
 * Shared shell for the Vendor panel and the Master/Sub-admin panel.
 * nav: [{ section?, items: [{ to, label, icon, end?, badge? }] }]
 */
export function PanelLayout({ nav, account, roleLabel, onLogout, homeTo, notificationsTo }) {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  useEffect(() => setOpen(false), [pathname]);

  const sidebar = (
    <div className="flex h-full flex-col bg-secondary text-white">
      <div className="flex h-16 items-center justify-between px-5">
        <Logo to={homeTo} light suffix={roleLabel} />
        <button className="lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu"><X size={20} /></button>
      </div>
      <nav className="no-scrollbar flex-1 overflow-y-auto px-3 pb-6">
        {nav.map((group, gi) => (
          <div key={gi} className="mt-4">
            {group.section && <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[.14em] text-white/40">{group.section}</p>}
            {group.items.map((it) => (
              <NavLink
                key={it.to}
                to={it.to}
                end={it.end}
                className={({ isActive }) => cx('mb-0.5 flex h-10 items-center gap-3 rounded-[calc(var(--lt-radius)-2px)] px-3 text-[13.5px] font-medium transition', isActive ? 'bg-primary text-white' : 'text-white/75 hover:bg-white/10 hover:text-white')}
              >
                <it.icon size={17} />
                <span className="flex-1 truncate">{it.label}</span>
                {it.badge ? <span className="rounded-full bg-white/20 px-1.5 text-[11px] font-bold">{it.badge}</span> : null}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div className="border-t border-white/10 p-3">
        <a href="/" target="_blank" rel="noreferrer" className="flex h-10 items-center gap-3 rounded-lg px-3 text-[13px] text-white/70 hover:bg-white/10"><ExternalLink size={16} />View website</a>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-surface">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="animate-fade-up absolute inset-y-0 left-0 w-72">{sidebar}</aside>
        </div>
      )}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-card/95 px-4 backdrop-blur sm:px-6">
          <button className="grid h-10 w-10 place-items-center rounded-lg hover:bg-surface lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
          <div className="ml-auto flex items-center gap-2">
            {notificationsTo && <button onClick={() => navigate(notificationsTo)} className="grid h-10 w-10 place-items-center rounded-full hover:bg-surface" aria-label="Notifications"><Bell size={19} /></button>}
            <details className="relative">
              <summary className="flex h-10 cursor-pointer list-none items-center gap-2 rounded-full pl-1 pr-2 hover:bg-surface">
                <Avatar name={account?.name} size={32} />
                <span className="hidden text-left sm:block">
                  <span className="block max-w-[160px] truncate text-sm font-semibold leading-tight">{account?.name}</span>
                  <span className="block text-[11px] text-muted">{account?.role === 'master' ? 'Master admin' : account?.role === 'subadmin' ? 'Sub-admin' : account?.businessName || roleLabel}</span>
                </span>
                <ChevronDown size={15} className="text-muted" />
              </summary>
              <div className="absolute right-0 mt-2 w-52 rounded-brand border border-line bg-card py-1.5 shadow-pop">
                <p className="truncate px-4 py-2 text-xs text-muted">{account?.email}</p>
                <button onClick={onLogout} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-danger hover:bg-surface"><LogOut size={16} />Sign out</button>
              </div>
            </details>
          </div>
        </header>
        <main className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8"><Outlet /></main>
      </div>
    </div>
  );
}

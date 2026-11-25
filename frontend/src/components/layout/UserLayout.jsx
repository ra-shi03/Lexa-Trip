import { Outlet, useLocation } from 'react-router';
import { useEffect } from 'react';
import { UserHeader } from './UserHeader';
import { MobileTabBar } from './MobileTabBar';
import { Footer } from './Footer';
import { AiChatWidget } from '../ai/AiChatWidget';
import { useSettings } from '../../context/SettingsContext';

export function UserLayout() {
  const { pathname } = useLocation();
  const { feature, features } = useSettings();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  if (features?.maintenanceMode === true && !pathname.startsWith('/p/')) {
    return (
      <div className="grid min-h-screen place-items-center p-6 text-center">
        <div><h1 className="text-2xl font-extrabold">We’ll be right back</h1><p className="mt-2 text-muted">LexaTrip is undergoing scheduled maintenance.</p></div>
      </div>
    );
  }
  return (
    <div className="flex min-h-screen flex-col">
      <UserHeader />
      <main className="flex-1 pb-20 md:pb-0"><Outlet /></main>
      <Footer />
      <MobileTabBar />
      {feature('aiAssistant') && pathname !== '/ai' && <AiChatWidget />}
    </div>
  );
}

/** Simple centered container */
export const Container = ({ children, className = '', ...rest }) => <div {...rest} className={`mx-auto w-full max-w-7xl px-4 sm:px-6 ${className}`}>{children}</div>;

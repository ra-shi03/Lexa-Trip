import { useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { useSettings } from '@/context/SettingsContext';
import { useAuth } from '@/context/AuthContext';

const seen = (k) => { try { return sessionStorage.getItem(k); } catch { return null; } };
const mark = (k, v = '1') => { try { sessionStorage.setItem(k, v); } catch { /* ignore */ } };

/** App launch: dynamic logo on admin-configured background → onboarding (first run) → home. */
export default function Splash() {
  const { brand, app, loading } = useSettings();
  const { user, ready } = useAuth();
  const navigate = useNavigate();
  const splash = app?.splash || {};
  const already = seen('lt_splash');

  useEffect(() => {
    if (already || loading || !ready.user) return undefined;
    const t = setTimeout(() => {
      mark('lt_splash');
      const slides = app?.onboarding?.slides?.filter((s) => s.title || s.image) || [];
      // Signed out (new customer, or one who logged out): Splash → Onboarding → Login → Home.  Still signed in: straight to Home.
      const needsOnboarding = !user && app?.onboarding?.enabled !== false && slides.length;
      navigate(needsOnboarding ? '/onboarding' : user ? '/home' : '/login', { replace: true });
    }, (splash.seconds || 1.8) * 1000);
    return () => clearTimeout(t);
  }, [already, loading, ready.user, user, app, navigate, splash.seconds]);

  if (already) return <Navigate to={user ? '/home' : '/login'} replace />;
  return (
    <div className="app-frame grid place-items-center overflow-hidden text-white" style={{ background: splash.background || 'linear-gradient(160deg, var(--lt-secondary) 0%, color-mix(in srgb, var(--lt-secondary) 70%, var(--lt-primary)) 100%)' }}>
      {splash.image && <img src={splash.image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-50" />}
      <div className="relative flex flex-col items-center px-8 text-center">
        <img src={brand.markUrl || '/lexatrip-mark.jpg'} alt={brand.appName} className="splash-pop h-28 w-28 rounded-full bg-white object-cover p-1 shadow-pop" />
        <p className="splash-pop mt-6 font-display text-3xl font-extrabold tracking-wide" style={{ animationDelay: '.15s' }}>{brand.appName}</p>
        {splash.showTagline !== false && (splash.tagline || brand.tagline) && <p className="splash-pop mt-2 text-sm text-white/80" style={{ animationDelay: '.3s' }}>{splash.tagline || brand.tagline}</p>}
      </div>
    </div>
  );
}

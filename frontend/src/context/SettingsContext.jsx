import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { useLive } from '../lib/live';

import { setPlatformTimezone } from '../lib/format';
/**
 * Dynamic platform configuration from Master Admin:
 *  - theme tokens  → applied as CSS variables (re-themes Tailwind + vanilla CSS instantly)
 *  - feature flags → hide/show services & AI features across the app
 *  - home sections → order/visibility of home screen blocks
 *  - brand         → name, logos, support contacts
 */
const FALLBACK = {
  brand: { appName: 'LexaTrip', tagline: 'Book. Explore. Repeat.', logoUrl: '/lexatrip-logo-full.jpg', markUrl: '/lexatrip-mark.jpg', faviconUrl: '/lexatrip-mark.jpg' },
  theme: {},
  features: { hotels: true, buses: true, flights: true, aiAssistant: true, aiSmartSearch: true, aiTripPlanner: true, wishlist: true, reviews: true, coupons: true, savedTravellers: true, priceInsights: true, supportTickets: true },
  homeSections: [],
  home: {},
  app: {},
  auth: {},
  ai: { assistantName: 'Lexa AI' },
  payment: { methods: ['card', 'upi', 'netbanking', 'wallet'] },
};

const VAR_MAP = {
  primary: '--lt-primary', primaryHover: '--lt-primary-hover', primarySoft: '--lt-primary-soft', secondary: '--lt-secondary', accent: '--lt-accent',
  background: '--lt-bg', surface: '--lt-surface', text: '--lt-text', muted: '--lt-muted', border: '--lt-border',
  success: '--lt-success', warning: '--lt-warning', danger: '--lt-danger',
};

export function applyTheme(theme = {}) {
  const root = document.documentElement;
  const dark = theme.mode === 'dark' || (theme.mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  root.dataset.theme = dark ? 'dark' : 'light';
  for (const [k, v] of Object.entries(VAR_MAP)) {
    // In dark mode keep the dark surface tokens from CSS, but still apply brand colours
    if (dark && ['background', 'surface', 'text', 'muted', 'border'].includes(k)) { root.style.removeProperty(v); continue; }
    if (theme[k]) root.style.setProperty(v, theme[k]); else root.style.removeProperty(v);
  }
  if (theme.radius !== undefined) root.style.setProperty('--lt-radius', `${theme.radius}px`);
  if (theme.fontFamily) root.style.setProperty('--lt-font', `"${theme.fontFamily}"`);
  if (theme.headingFontFamily) root.style.setProperty('--lt-heading-font', `"${theme.headingFontFamily}"`);
  const families = [...new Set([theme.fontFamily, theme.headingFontFamily].filter(Boolean))];
  if (families.length) {
    const href = `https://fonts.googleapis.com/css2?${families.map((f) => `family=${encodeURIComponent(f).replace(/%20/g, '+')}:wght@400;500;600;700;800`).join('&')}&display=swap`;
    const link = document.getElementById('lt-font');
    if (link && link.getAttribute('href') !== href) link.setAttribute('href', href);
  }
}

/** Favicon, home-screen icon, browser theme colour and tab title — all driven by Admin → Theme & branding */
function applyBrand(data) {
  const head = document.head;
  const ensure = (rel, attrs = {}) => {
    let el = head.querySelector(`link[rel="${rel}"]`);
    if (!el) { el = document.createElement('link'); el.rel = rel; head.appendChild(el); }
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    return el;
  };
  const v = data.updatedAt ? `?v=${new Date(data.updatedAt).getTime()}` : '';
  const fav = data.brand?.faviconUrl || data.brand?.markUrl;
  if (fav) ensure('icon', { href: fav });
  ensure('apple-touch-icon', { href: `/api/v1/public/brand/icon/180.png${v}` });
  ensure('manifest', { href: `/api/v1/public/manifest${v}` });
  let meta = head.querySelector('meta[name="theme-color"]');
  if (!meta) { meta = document.createElement('meta'); meta.name = 'theme-color'; head.appendChild(meta); }
  meta.content = data.theme?.primary || '#F26B1D';
  if (data.brand?.appName && !document.title.includes('|') && /^LexaTrip|^[^|]*$/.test(document.title)) document.title = `${data.brand.appName} — ${data.brand.tagline || ''}`.trim();
}

const Ctx = createContext({ ...FALLBACK, loading: true, reload: () => {} });

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(FALLBACK);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const { data } = await api.get('/public/settings');
      setPlatformTimezone(data.regional?.timezone); // every date/time on screen follows Admin → Region & time
      setSettings({ ...FALLBACK, ...data, features: { ...FALLBACK.features, ...data.features } });
      applyTheme(data.theme);
      applyBrand(data);
    } catch {
      /* offline / API down: keep fallback theme */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);
  // Admin saved theme / branding / features / home / app settings → apply live, no refresh
  useLive('settings', reload, { delay: 250 });

  const value = useMemo(() => ({ ...settings, loading, reload, feature: (k) => settings.features?.[k] !== false }), [settings, loading, reload]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useSettings = () => useContext(Ctx);

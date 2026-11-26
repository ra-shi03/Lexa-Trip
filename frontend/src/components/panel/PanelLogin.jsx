import { useEffect, useId, useState } from 'react';
import { Link } from 'react-router';
import { Mail, Lock, Eye, EyeOff, ArrowRight, ShieldCheck, LayoutDashboard, SlidersHorizontal, AlertCircle, TriangleAlert, Loader2, Check } from 'lucide-react';
import { Logo } from '../layout/Logo';
import { useSettings } from '../../context/SettingsContext';
import { cx, platformParts } from '../../lib/format';

const REMEMBER = 'lt_admin_email';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Icon-led input with floating state colours (theme tokens only). */
function Field({ label, icon: Icon, error, right, children, id }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-ink">{label}</label>
      <div className={cx('group flex h-12 items-center gap-3 rounded-brand border bg-card px-3.5 transition focus-within:border-primary focus-within:shadow-[0_0_0_4px_var(--lt-primary-soft)]', error ? 'border-danger' : 'border-line hover:border-muted/60')}>
        <Icon size={18} className={cx('flex-none transition', error ? 'text-danger' : 'text-muted group-focus-within:text-primary')} />
        {children}
        {right}
      </div>
      {error && <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-danger" role="alert"><AlertCircle size={13} />{error}</p>}
    </div>
  );
}

/**
 * Admin sign-in: split layout (brand story + form), show/hide password, caps-lock hint,
 * inline validation, remembered email, shake on failure. Colours come from the theme tokens.
 */
export function PanelLogin({ title = 'Admin sign in', suffix = 'Admin', note, onSubmit }) {
  const { brand } = useSettings();
  const eid = useId(); const pid = useId();
  const [email, setEmail] = useState(() => { try { return localStorage.getItem(REMEMBER) || ''; } catch { return ''; } });
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [caps, setCaps] = useState(false);
  const [remember, setRemember] = useState(() => { try { return !!localStorage.getItem(REMEMBER); } catch { return false; } });
  const [touched, setTouched] = useState({});
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(0);
  useEffect(() => { if (!shake) return undefined; const t = setTimeout(() => setShake(0), 450); return () => clearTimeout(t); }, [shake]);

  const errors = {
    email: !email ? 'Enter your email' : !EMAIL_RE.test(email) ? 'Enter a valid email address' : '',
    password: !password ? 'Enter your password' : '',
  };
  const submit = async (e) => {
    e.preventDefault();
    setTouched({ email: true, password: true });
    if (errors.email || errors.password) { setShake((n) => n + 1); return; }
    setBusy(true);
    try {
      try { remember ? localStorage.setItem(REMEMBER, email) : localStorage.removeItem(REMEMBER); } catch { /* storage unavailable */ }
      await onSubmit({ email: email.trim(), password });
    } catch { setShake((n) => n + 1); setPassword(''); } finally { setBusy(false); }
  };
  const caption = (e) => setCaps(e.getModifierState?.('CapsLock') || false);

  return (
    <div className="grid min-h-screen bg-secondary lg:grid-cols-[1.05fr_1fr]">
      {/* brand side */}
      <aside className="relative hidden overflow-hidden p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-primary/25 blur-3xl float" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-32 right-0 h-[28rem] w-[28rem] rounded-full bg-primary/15 blur-3xl float" style={{ animationDelay: '1.5s' }} aria-hidden="true" />
        <div className="relative"><Logo light suffix={suffix} /></div>
        <div className="relative max-w-md">
          <h2 className="animate-fade-up text-4xl font-extrabold leading-tight !text-white">Run {brand.appName || 'LexaTrip'} from one place.</h2>
          <p className="animate-fade-up mt-3 text-white/75" style={{ animationDelay: '.1s' }}>Bookings, inventory, vendors, content and theme — everything your team needs, with access limited to each person’s role.</p>
          <ul className="mt-8 space-y-4">
            {[[LayoutDashboard, 'Live dashboard', 'Bookings and operations at a glance'], [SlidersHorizontal, 'Full control', 'Theme, features, banners and content'], [ShieldCheck, 'Role-based access', 'Sub-admins only see what they’re allowed to']].map(([Icon, t, d], n) => (
              <li key={t} className="animate-fade-up flex items-start gap-3.5" style={{ animationDelay: `${0.2 + n * 0.1}s` }}>
                <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-white/10 text-primary backdrop-blur"><Icon size={19} /></span>
                <span><span className="block font-bold">{t}</span><span className="text-sm text-white/70">{d}</span></span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-white/50">© {platformParts().year} {brand.appName || 'LexaTrip'}</p>
      </aside>

      {/* form side */}
      <main className="relative grid place-items-center p-4 sm:p-8 lg:bg-bg">
        <div className="absolute inset-0 -z-0 lg:hidden"><div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-primary/20 blur-3xl" aria-hidden="true" /></div>
        <form onSubmit={submit} noValidate className={cx('card relative w-full max-w-md space-y-5 p-7 shadow-pop sm:p-9', shake && 'animate-shake')}>
          <div className="lg:hidden"><Logo suffix={suffix} /></div>
          <div>
            <h1 className="text-2xl font-extrabold">{title}</h1>
            <p className="mt-1 text-sm text-muted">Welcome back — enter your details to continue.</p>
          </div>

          <Field id={eid} label="Email" icon={Mail} error={touched.email && errors.email}>
            <input id={eid} type="email" autoComplete="username" inputMode="email" autoFocus value={email} placeholder="you@company.com"
              onChange={(e) => setEmail(e.target.value)} onBlur={() => setTouched((t) => ({ ...t, email: true }))}
              className="h-full min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted/70" />
            {EMAIL_RE.test(email) && <Check size={17} className="flex-none text-success" aria-hidden="true" />}
          </Field>

          <Field id={pid} label="Password" icon={Lock} error={touched.password && errors.password}
            right={<button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show} className="-mr-1.5 grid h-9 w-9 flex-none place-items-center rounded-full text-muted transition hover:bg-surface hover:text-ink">{show ? <EyeOff size={18} /> : <Eye size={18} />}</button>}>
            <input id={pid} type={show ? 'text' : 'password'} autoComplete="current-password" value={password} placeholder="Enter your password"
              onChange={(e) => setPassword(e.target.value)} onBlur={() => { setCaps(false); setTouched((t) => ({ ...t, password: true })); }} onKeyUp={caption} onKeyDown={caption}
              className="h-full min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted/70" />
          </Field>
          {caps && <p className="-mt-2 flex items-center gap-1.5 text-xs font-semibold text-warning" role="status"><TriangleAlert size={13} />Caps Lock is on</p>}

          <label className="flex cursor-pointer select-none items-center gap-2.5 text-sm text-muted">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 rounded border-line accent-[var(--lt-primary)]" />
            Remember my email on this device
          </label>

          <button type="submit" disabled={busy} className="btn btn-primary shine group relative h-12 w-full overflow-hidden text-[15px]">
            {busy ? <><Loader2 size={18} className="animate-spin" />Signing in…</> : <>Sign in <ArrowRight size={18} className="transition group-hover:translate-x-1" /></>}
          </button>
          <p className="text-center text-xs text-muted">{note || 'Master admin & sub-admins sign in here.'}</p>
          <p className="text-center text-xs"><Link to="/" className="font-semibold text-muted hover:text-primary">← Back to website</Link></p>
        </form>
      </main>
    </div>
  );
}

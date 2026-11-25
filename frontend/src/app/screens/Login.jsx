import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Smartphone } from 'lucide-react';
import { OtpInput } from '@/components/auth/OtpInput';
import { Button } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { useToast } from '@/context/ToastContext';
import { cx } from '@/lib/format';

const DEFAULTS = {
  image: '/auth-hero.jpg', overlayOpacity: 0.3, showLogo: true,
  welcomeTitle: 'Welcome', welcomeText: 'Find your next stay, feel at home. Where comfort meets convenience.',
  loginLabel: 'Login', signupLabel: 'Sign Up',
  loginHeading: 'Welcome back', loginText: 'Log in with your mobile number — we’ll send a one-time password.',
  signupHeading: 'Create your account', signupText: 'Join to book stays, buses and flights faster.',
  emailField: 'optional', highlights: [],
};
const RESEND_SECONDS = 30;

function Field({ id, label, error, children }) {
  return (
    <div>
      <label className="field-label" htmlFor={id}>{label}</label>
      {children}
      {error && <p className="field-error animate-fade-up">{error}</p>}
    </div>
  );
}

/**
 * Full-page authentication (Login / Sign up). Everything visible is driven from Admin → Login page.
 *  Mobile / app : full-screen hero → curved sheet.  Welcome → form → OTP.
 *  Desktop web  : split screen — hero + highlights on the left, form on the right.
 */
export default function Login() {
  const [sp] = useSearchParams();
  const { auth, brand } = useSettings();
  const cfg = { ...DEFAULTS, ...auth };
  const next = sp.get('next') || '/home';
  const { user, login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const useWelcome = true; // the app always opens on the welcome screen

  const [mode, setMode] = useState(sp.get('tab') === 'signup' ? 'signup' : 'login');
  const [view, setView] = useState(sp.get('tab') ? 'form' : 'welcome'); // welcome → form → otp
  const [form, setForm] = useState({ name: '', phone: '', email: '', agree: false });
  const [otp, setOtp] = useState('');
  const [devOtp, setDevOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fieldErr, setFieldErr] = useState({});
  const [done, setDone] = useState(false);
  const [wait, setWait] = useState(0);

  useEffect(() => { if (wait <= 0) return undefined; const t = setTimeout(() => setWait((w) => w - 1), 1000); return () => clearTimeout(t); }, [wait]);

  if (user && !done) return <Navigate to={next} replace />;

  const shown = useWelcome ? view : view === 'welcome' ? 'form' : view;
  const isSignup = mode === 'signup';
  const set = (k) => (e) => {
    setForm({ ...form, [k]: k === 'phone' ? e.target.value.replace(/\D/g, '').slice(0, 10) : k === 'agree' ? e.target.checked : e.target.value });
    setFieldErr({ ...fieldErr, [k]: undefined }); setError('');
  };
  const go = (m) => { setMode(m); setView('form'); setError(''); setFieldErr({}); setOtp(''); };

  const validate = () => {
    const e = {};
    if (isSignup && form.name.trim().length < 2) e.name = 'Enter your full name';
    if (!/^[6-9]\d{9}$/.test(form.phone)) e.phone = 'Enter a valid 10-digit mobile number';
    if (isSignup && cfg.emailField === 'required' && !form.email) e.email = 'Email is required';
    else if (isSignup && form.email && !/^\S+@\S+\.\S+$/.test(form.email)) e.email = 'Enter a valid email address';
    if (isSignup && !form.agree) e.agree = 'Please accept the Terms & Privacy Policy';
    setFieldErr(e);
    return !Object.keys(e).length;
  };

  const send = async (e) => {
    e?.preventDefault();
    if (!validate()) return;
    setError(''); setBusy(true);
    try {
      const { data } = await api.post('/auth/user/send-otp', { phone: form.phone, mode });
      setDevOtp(data.devOtp || ''); setOtp(''); setView('otp'); setWait(RESEND_SECONDS);
    } catch (er) { setError(er.message); } finally { setBusy(false); }
  };

  const verify = async (code = otp) => {
    if (code.length !== 6 || busy) return;
    setBusy(true); setError('');
    try {
      const { data } = await api.post('/auth/user/verify-otp', { phone: form.phone, otp: code, mode, ...(isSignup ? { name: form.name.trim(), email: form.email || undefined } : {}) });
      setDone(true); // success animation, then navigate
      login('user', data.token, data.user);
      setTimeout(() => navigate(next, { replace: true }), 900);
    } catch (er) { setError(er.message); setOtp(''); } finally { setBusy(false); }
  };

  const resend = async () => {
    if (wait > 0) return;
    try { const { data } = await api.post('/auth/user/send-otp', { phone: form.phone, mode }); setDevOtp(data.devOtp || ''); setWait(RESEND_SECONDS); toast.success('A new OTP has been sent'); } catch (er) { setError(er.message); }
  };

  const wrongMode = /sign up first|No account/i.test(error) ? 'signup' : /already registered/i.test(error) ? 'login' : null;
  const phoneOk = /^[6-9]\d{9}$/.test(form.phone);

  return (
    <div className="relative flex min-h-[100dvh] flex-col overflow-x-hidden bg-bg lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* ───────── Hero (photo, brand badge, copy) ───────── */}
      <section
        className="relative z-0 flex-1 overflow-hidden bg-secondary lg:sticky lg:top-0 lg:h-[100dvh] lg:flex-none"
        style={{ minHeight: shown === 'welcome' ? '48dvh' : shown === 'otp' ? '38dvh' : '44dvh' }}
      >
        {cfg.image && <img src={cfg.image} alt="" className="kenburns absolute inset-0 h-full w-full object-cover" fetchPriority="high" />}
        <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, rgb(20 33 61 / ${cfg.overlayOpacity * 0.6}) 0%, rgb(20 33 61 / ${cfg.overlayOpacity}) 55%, rgb(20 33 61 / ${Math.min(0.85, cfg.overlayOpacity + 0.35)}) 100%)` }} />

        {/* mobile: back + small brand on form screens */}
        {shown !== 'welcome' && (
          <button onClick={() => (shown === 'otp' ? setView('form') : useWelcome ? setView('welcome') : navigate(-1))} className="pt-safe absolute left-4 top-4 z-10 grid h-10 w-10 place-items-center rounded-full bg-black/30 text-white backdrop-blur transition hover:bg-black/45 lg:hidden" aria-label="Back"><ArrowLeft size={20} /></button>
        )}

        {/* brand badge (center on welcome, left on form screens) */}
        <div className={cx('absolute z-10 flex flex-col items-center text-center text-white transition-all duration-700', shown === 'welcome' ? 'left-0 right-0 top-[22%] lg:top-[12%]' : 'right-5 top-5 scale-75 lg:left-0 lg:right-0 lg:top-[12%] lg:scale-100')}>
          {cfg.showLogo && (
            <span className={cx('pop-in grid place-items-center rounded-full bg-white shadow-pop transition-all duration-700', shown === 'welcome' ? 'h-28 w-28 lg:h-32 lg:w-32' : 'h-14 w-14 lg:h-32 lg:w-32')}>
              <img src={brand.markUrl || '/lexatrip-mark.jpg'} alt={brand.appName} onError={(e) => { if (!e.currentTarget.src.endsWith('/lexatrip-mark.jpg')) e.currentTarget.src = '/lexatrip-mark.jpg'; }} className="h-[86%] w-[86%] rounded-full object-cover" />
            </span>
          )}
          <p className={cx('mt-3 font-display font-extrabold uppercase tracking-[.18em] transition-opacity', shown === 'welcome' ? 'text-xl opacity-100' : 'hidden text-xl lg:block')}>{brand.appName}</p>
          <p className={cx('text-sm text-white/80', shown === 'welcome' ? 'block' : 'hidden lg:block')}>{brand.tagline}</p>
        </div>

        {/* desktop: highlights */}
        <div className="absolute bottom-0 left-0 right-0 hidden p-12 text-white lg:block">
          <h2 className="max-w-md text-4xl font-extrabold leading-tight !text-white">{cfg.welcomeTitle}</h2>
          <p className="mt-2 max-w-md text-white/85">{cfg.welcomeText}</p>
          <ul className="mt-6 space-y-2.5">{cfg.highlights?.filter(Boolean).map((h) => <li key={h} className="flex items-center gap-2.5 text-sm font-medium"><span className="grid h-5 w-5 place-items-center rounded-full bg-primary"><Check size={12} strokeWidth={3} /></span>{h}</li>)}</ul>
        </div>
      </section>

      {/* ───────── Sheet (welcome buttons / form / OTP) ───────── */}
      <section
        className="arch-top relative z-10 -mt-[var(--arch)] flex flex-none flex-col bg-bg px-6 pb-8 pt-[var(--pt)] shadow-[0_-18px_50px_rgb(20_33_61/0.18)] lg:mt-0 lg:flex-1 lg:justify-center lg:rounded-none lg:px-16 lg:pt-8 lg:shadow-none xl:px-24"
        style={{ '--pt': shown === 'welcome' ? '52px' : '40px', '--arch': shown === 'welcome' ? '64px' : '40px' }}
      >
        <div className="mx-auto w-full max-w-md">
          {done ? (
            <div className="flex flex-col items-center py-10 text-center">
              <span className="pop-in grid h-20 w-20 place-items-center rounded-full bg-success/12 text-success"><CheckCircle2 size={48} /></span>
              <h1 className="mt-5 text-2xl font-extrabold">{isSignup ? 'Account created!' : 'You’re in!'}</h1>
              <p className="mt-1 text-muted">Taking you to {brand.appName}…</p>
            </div>
          ) : shown === 'welcome' ? (
            <div className="rise text-center">
              <h1 className="text-[28px] font-extrabold uppercase tracking-wide">{cfg.welcomeTitle}</h1>
              <p className="mx-auto mt-3 max-w-xs text-[15px] leading-relaxed text-muted">{cfg.welcomeText}</p>
              <div className="mt-7 space-y-3">
                <Button block className="h-12 rounded-full text-base" onClick={() => go('login')}>{cfg.loginLabel}</Button>
                <Button block variant="outline" className="h-12 rounded-full text-base" onClick={() => go('signup')}>{cfg.signupLabel}</Button>
              </div>
            </div>
          ) : shown === 'form' ? (
            <form key={mode} onSubmit={send} noValidate className="rise">
              {/* animated segmented switch */}
              <div className="relative mb-6 grid grid-cols-2 rounded-full bg-surface p-1" role="tablist">
                <span className="absolute inset-y-1 w-[calc(50%-4px)] rounded-full bg-card shadow-card transition-transform duration-300" style={{ transform: isSignup ? 'translateX(100%)' : 'translateX(0)' }} />
                {[['login', cfg.loginLabel], ['signup', cfg.signupLabel]].map(([m, l]) => (
                  <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => go(m)} className={cx('relative z-10 h-11 rounded-full text-sm font-bold transition-colors', mode === m ? 'text-ink' : 'text-muted')}>{l}</button>
                ))}
              </div>

              <h1 className="text-[26px] font-extrabold leading-tight">{isSignup ? cfg.signupHeading : cfg.loginHeading}</h1>
              <p className="mb-5 mt-1.5 text-[15px] text-muted">{isSignup ? cfg.signupText : cfg.loginText}</p>

              <div className="space-y-4">
                {isSignup && <Field id="name" label="Full name" error={fieldErr.name}><input id="name" className="input h-12 rounded-full px-5" autoComplete="name" placeholder="As on your ID" value={form.name} onChange={set('name')} aria-invalid={Boolean(fieldErr.name)} autoFocus /></Field>}
                <Field id="phone" label="Mobile number" error={fieldErr.phone}>
                  <div className="flex gap-2">
                    <span className="input flex h-12 w-[88px] flex-none items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3 font-bold">🇮🇳 +91</span>
                    <div className="relative flex-1">
                      <input id="phone" className="input h-12 rounded-full px-5 pr-10" inputMode="numeric" autoComplete="tel-national" placeholder="10-digit mobile number" value={form.phone} onChange={set('phone')} aria-invalid={Boolean(fieldErr.phone)} autoFocus={!isSignup} />
                      {phoneOk && <Check size={18} className="pop-in absolute right-3 top-1/2 -translate-y-1/2 text-success" />}
                    </div>
                  </div>
                </Field>
                {isSignup && cfg.emailField !== 'hidden' && <Field id="email" label={`Email${cfg.emailField === 'required' ? '' : ' (optional)'}`} error={fieldErr.email}><input id="email" type="email" className="input h-12 rounded-full px-5" autoComplete="email" placeholder="For booking vouchers" value={form.email} onChange={set('email')} aria-invalid={Boolean(fieldErr.email)} /></Field>}
                {isSignup && (
                  <div>
                    <label className="flex cursor-pointer items-start gap-2.5 text-sm text-muted">
                      <input type="checkbox" checked={form.agree} onChange={set('agree')} className="mt-0.5 h-[18px] w-[18px] flex-none" />
                      <span>I agree to the <Link to="/p/terms-and-conditions" className="font-semibold text-primary underline">Terms</Link> and <Link to="/p/privacy-policy" className="font-semibold text-primary underline">Privacy Policy</Link>.</span>
                    </label>
                    {fieldErr.agree && <p className="field-error animate-fade-up">{fieldErr.agree}</p>}
                  </div>
                )}
                {error && (
                  <div className="animate-fade-up rounded-brand bg-danger/10 px-4 py-3 text-sm" role="alert">
                    <p className="font-semibold text-danger">{error}</p>
                    {wrongMode && <button type="button" onClick={() => go(wrongMode)} className="mt-1 font-bold text-primary underline">{wrongMode === 'signup' ? `Go to ${cfg.signupLabel}` : `Go to ${cfg.loginLabel}`}</button>}
                  </div>
                )}
                <Button type="submit" block className="mt-1 h-12 rounded-full text-base" loading={busy} iconRight={ArrowRight}>{isSignup ? 'Continue' : 'Get OTP'}</Button>
              </div>
              <p className="mt-5 text-center text-sm text-muted">
                {isSignup ? 'Already have an account? ' : 'New here? '}
                <button type="button" onClick={() => go(isSignup ? 'login' : 'signup')} className="font-bold text-primary">{isSignup ? cfg.loginLabel : cfg.signupLabel}</button>
              </p>
            </form>
          ) : (
            <div className="rise">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-primary-soft text-primary"><Smartphone size={26} /></span>
              <h1 className="mt-4 text-[26px] font-extrabold leading-tight">Verify your number</h1>
              <p className="mt-1.5 text-[15px] text-muted">Enter the 6-digit code sent to <b className="text-ink">+91 {form.phone}</b> <button type="button" onClick={() => setView('form')} className="font-bold text-primary">Edit</button></p>
              {devOtp && <p className="mt-3 rounded-brand bg-primary-soft px-3.5 py-2.5 text-sm">Development mode — SMS is not configured. Use OTP <b className="tracking-widest">{devOtp}</b></p>}
              <div className="mt-6"><OtpInput value={otp} onChange={(v) => { setOtp(v); setError(''); }} onComplete={verify} error={Boolean(error)} disabled={busy} /></div>
              {error && <p className="field-error animate-fade-up mt-3" role="alert">{error}</p>}
              <Button block className="mt-6 h-12 rounded-full text-base" loading={busy} disabled={otp.length !== 6} onClick={() => verify()}>{isSignup ? 'Verify & create account' : 'Verify & log in'}</Button>
              <p className="mt-5 text-center text-sm text-muted">
                {wait > 0 ? <>Resend code in <b className="tabular-nums text-ink">0:{String(wait).padStart(2, '0')}</b></> : <>Didn’t get it? <button type="button" onClick={resend} className="font-bold text-primary">Resend OTP</button></>}
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

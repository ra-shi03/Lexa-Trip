import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui';
import { useSettings } from '@/context/SettingsContext';
import { useAuth } from '@/context/AuthContext';
import { cx } from '@/lib/format';

/** First-launch walkthrough — slides (image/title/text) are managed in Admin → Mobile app. */
export default function Onboarding() {
  const { app } = useSettings();
  const { user } = useAuth();
  const slides = (app?.onboarding?.slides || []).filter((s) => s.title || s.image);
  const [i, setI] = useState(0);
  const navigate = useNavigate();
  const finish = () => { try { localStorage.setItem('lt_onboarded', '1'); } catch { /* ignore */ } navigate(user ? '/home' : '/login', { replace: true }); };
  if (!slides.length) { finish(); return null; }
  const s = slides[i];
  const last = i === slides.length - 1;
  return (
    <div className="app-frame flex flex-col">
      <div className="relative flex-1 overflow-hidden">
        {slides.map((sl, n) => <img key={n} src={sl.image} alt="" className={cx('absolute inset-0 h-full w-full object-cover transition-opacity duration-700', n === i ? 'opacity-100' : 'opacity-0')} />)}
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/10 to-transparent" />
        <button onClick={finish} className="pt-safe absolute right-4 top-4 rounded-full bg-black/35 px-3.5 py-1.5 text-sm font-semibold text-white backdrop-blur">Skip</button>
      </div>
      <div className="safe-bottom px-6 pb-8 pt-2 text-center">
        <h1 key={i} className="animate-fade-up text-2xl font-extrabold">{s.title}</h1>
        <p key={`t${i}`} className="animate-fade-up mt-2 min-h-[3rem] text-muted">{s.text}</p>
        <div className="my-5 flex justify-center gap-1.5">{slides.map((_, n) => <span key={n} className={cx('h-1.5 rounded-full transition-all', n === i ? 'w-7 bg-primary' : 'w-1.5 bg-line')} />)}</div>
        <Button size="lg" block onClick={() => (last ? finish() : setI(i + 1))}>{last ? 'Get started' : 'Next'}</Button>
      </div>
    </div>
  );
}

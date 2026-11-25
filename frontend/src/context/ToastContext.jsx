import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';

const Ctx = createContext(null);
const ICONS = { success: CheckCircle2, error: XCircle, info: Info };
const TONES = { success: 'text-success', error: 'text-danger', info: 'text-primary' };

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const dismiss = useCallback((id) => setItems((xs) => xs.filter((x) => x.id !== id)), []);
  const push = useCallback((type, message) => {
    if (!message) return;
    const id = Math.random().toString(36).slice(2);
    setItems((xs) => [...xs.slice(-3), { id, type, message }]);
    setTimeout(() => dismiss(id), type === 'error' ? 6000 : 3500);
  }, [dismiss]);
  // errors already announced by the API interceptor (401/429/5xx/offline) are not shown twice
  const api = useMemo(() => ({ success: (m) => push('success', m), error: (m) => { if (!m?.silent) push('error', m?.message || m); }, info: (m) => push('info', m) }), [push]);
  useEffect(() => {
    const h = (e) => push(e.detail.kind, e.detail.message);
    window.addEventListener('lt:notice', h);
    return () => window.removeEventListener('lt:notice', h);
  }, [push]);

  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[100] flex flex-col items-center gap-2 px-4 md:bottom-6 md:items-end md:pr-6" aria-live="polite">
        {items.map((t) => {
          const Icon = ICONS[t.type];
          return (
            <div key={t.id} className="pointer-events-auto animate-fade-up flex w-full max-w-sm items-start gap-3 rounded-brand border border-line bg-card px-4 py-3 shadow-pop">
              <Icon size={20} className={`mt-0.5 flex-none ${TONES[t.type]}`} />
              <p className="flex-1 text-sm font-medium text-ink">{t.message}</p>
              <button onClick={() => dismiss(t.id)} className="text-muted hover:text-ink" aria-label="Dismiss"><X size={16} /></button>
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);

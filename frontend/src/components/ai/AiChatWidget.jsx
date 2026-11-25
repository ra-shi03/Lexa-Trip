import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Sparkles, X, Send, Loader2, Bot } from 'lucide-react';
import { api } from '../../lib/api';
import { useSettings } from '../../context/SettingsContext';
import { money, cx } from '../../lib/format';
import { Img } from '../ui';

/**
 * Lexa AI conversational assistant (Gemini-backed with rule-based fallback).
 * Renders matching LexaTrip stays inline — the model never invents listings.
 */
export function AiChat({ className, autoFocus }) {
  const { ai } = useSettings();
  const name = ai?.assistantName || 'Lexa AI';
  const [messages, setMessages] = useState([{ role: 'assistant', content: `Hi! I’m ${name}. Tell me where you want to go, your dates and budget — I’ll find stays, buses or flights for you.`, suggestions: ['Resorts in Udaipur with a pool', 'Budget hotels in Goa this weekend', 'Family hotel in Jaipur under ₹4,000'] }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState();
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages, loading]);

  const send = async (text = input) => {
    const content = text.trim();
    if (!content || loading) return;
    const next = [...messages, { role: 'user', content }];
    setMessages(next);
    setInput('');
    setLoading(true);
    try {
      const { data } = await api.post('/public/ai/chat', { sessionId, messages: next.map(({ role, content: c }) => ({ role, content: c })).slice(-12) });
      setSessionId(data.sessionId);
      setMessages((m) => [...m, { role: 'assistant', content: data.reply, results: data.results, filters: data.filters, suggestions: data.suggestions }]);
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', content: e.message || 'Sorry, I could not answer that right now.' }]);
    } finally {
      setLoading(false);
    }
  };

  const searchLink = (f) => {
    const p = new URLSearchParams();
    for (const k of ['city', 'checkIn', 'checkOut', 'adults', 'children', 'rooms', 'maxPrice', 'category', 'stars']) if (f?.[k]) p.set(k, f[k]);
    if (f?.amenities?.length) p.set('amenities', f.amenities.join(','));
    return `/search?${p}`;
  };

  const last = messages[messages.length - 1];
  const chips = !loading && last?.role === 'assistant' ? last.suggestions : null;

  return (
    <div className={cx('flex flex-col', className)}>
      <div className="flex-1 space-y-3 overflow-y-auto px-3.5 py-4">
        {messages.map((m, i) => (
          <div key={i} className={cx('flex items-end gap-2', m.role === 'user' && 'justify-end')}>
            {m.role === 'assistant' && <span className="mb-0.5 grid h-7 w-7 flex-none place-items-center rounded-full bg-primary text-white"><Sparkles size={14} /></span>}
            <div className="max-w-[82%] space-y-2">
              <div className={cx('whitespace-pre-line px-3.5 py-2.5 text-[15px] leading-snug', m.role === 'user' ? 'rounded-2xl rounded-br-md bg-secondary text-white' : 'rounded-2xl rounded-bl-md bg-surface text-ink')}>{m.content}</div>
              {m.results?.length > 0 && (
                <div className="space-y-2">
                  {m.results.map((p) => (
                    <Link key={p._id} to={`/stay/${p.slug}`} className="flex gap-3 rounded-xl border border-line bg-card p-2 transition active:scale-[.99]">
                      <Img src={p.images?.[0]?.url} alt={p.name} className="h-16 w-20 flex-none rounded-lg" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">{p.name}</p>
                        <p className="truncate text-[13px] text-muted">{p.city?.name}{p.area ? ` · ${p.area}` : ''}</p>
                        <p className="mt-1 text-sm font-extrabold text-ink">{money(p.nightlyFrom)} <span className="text-xs font-normal text-muted">/night</span></p>
                      </div>
                    </Link>
                  ))}
                  {m.filters?.city && <Link to={searchLink(m.filters)} className="block text-center text-sm font-bold text-primary">See all results →</Link>}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-end gap-2" aria-live="polite">
            <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-primary text-white"><Sparkles size={14} /></span>
            <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-surface px-4 py-3.5" aria-label={`${name} is typing`}>{[0, 1, 2].map((d) => <span key={d} className="typing-dot h-2 w-2 rounded-full bg-muted" style={{ animationDelay: `${d * 150}ms` }} />)}</div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {chips?.length > 0 && (
        <div className="hscroll chip-row border-t border-line/60 bg-card py-2.5" aria-label="Suggested questions">
          {chips.map((s) => <button key={s} onClick={() => send(s)} className="h-9 flex-none rounded-full border border-primary/30 bg-primary-soft/50 px-3.5 text-[13px] font-semibold text-primary transition active:scale-95">{s}</button>)}
        </div>
      )}
      <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex items-center gap-2 border-t border-line bg-card p-2.5">
        <input autoFocus={autoFocus} value={input} onChange={(e) => setInput(e.target.value)} placeholder={`Message ${name.split(' ')[0]}…`} enterKeyHint="send" className="h-11 min-w-0 flex-1 rounded-full border border-line bg-surface px-4 text-base outline-none transition focus:border-primary focus:bg-card" aria-label="Message" />
        <button type="submit" className="grid h-11 w-11 flex-none place-items-center rounded-full bg-primary text-white transition active:scale-90 disabled:bg-line disabled:text-muted" disabled={!input.trim() || loading} aria-label="Send"><Send size={18} /></button>
      </form>
      <p className="bg-card pb-2 text-center text-[11px] text-muted">AI can make mistakes — verify details before booking.</p>
    </div>
  );
}

export function AiChatWidget() {
  const [open, setOpen] = useState(false);
  const { ai } = useSettings();
  return (
    <>
      {open && (
        <div className="animate-fade-up fixed inset-x-0 bottom-0 z-50 flex h-[85vh] flex-col overflow-hidden rounded-t-3xl border border-line bg-card shadow-pop md:inset-x-auto md:bottom-24 md:right-6 md:h-[600px] md:w-[400px] md:rounded-3xl">
          <div className="flex items-center justify-between bg-secondary px-4 py-3 text-white">
            <div className="flex items-center gap-2.5"><span className="grid h-8 w-8 place-items-center rounded-full bg-primary"><Sparkles size={16} /></span><div><p className="text-sm font-bold leading-tight">{ai?.assistantName || 'Lexa AI'}</p><p className="text-[11px] text-white/60">Your travel assistant</p></div></div>
            <button onClick={() => setOpen(false)} aria-label="Close assistant" className="grid h-8 w-8 place-items-center rounded-full hover:bg-white/10"><X size={18} /></button>
          </div>
          <AiChat className="min-h-0 flex-1" autoFocus />
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-20 right-4 z-40 flex h-14 items-center gap-2 rounded-full bg-primary pl-4 pr-5 font-bold text-white shadow-pop transition hover:bg-primary-hover md:bottom-6 md:right-6"
        aria-label={`Open ${ai?.assistantName || 'Lexa AI'}`}
      >
        {open ? <X size={20} /> : <Sparkles size={20} />}
        <span className="hidden sm:inline">{open ? 'Close' : `Ask ${ai?.assistantName || 'Lexa AI'}`}</span>
      </button>
    </>
  );
}

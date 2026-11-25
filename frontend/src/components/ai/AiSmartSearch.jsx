import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Sparkles, ArrowRight, Loader2 } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import { useSettings } from '../../context/SettingsContext';

const EXAMPLES = ['Resort in Udaipur this weekend under ₹12k with pool', 'Budget hotel in Jaipur for 3 people', 'Villa in Goa for 6 friends 12 dec to 15 dec', 'Bus from Delhi to Jaipur tomorrow'];

/** Natural-language search: “romantic resort in Udaipur under 10k” → structured filters → results page */
export function AiSmartSearch() {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();
  const { feature, ai } = useSettings();
  if (!feature('aiSmartSearch')) return null;

  const go = async (value = text) => {
    if (value.trim().length < 3) return;
    setLoading(true);
    try {
      const { data: f } = await api.post('/public/ai/parse', { text: value });
      if (f.intent === 'bus') return navigate(`/bus?${new URLSearchParams({ from: f.from || '', to: f.to || '', date: f.date || f.checkIn || '' })}`);
      if (f.intent === 'flight') {
        const { data: airports } = await api.get('/public/flights/airports');
        const code = (name) => airports.find((a) => name && (a.city.toLowerCase().includes(name.toLowerCase()) || a.code === name.toUpperCase()))?.code || '';
        return navigate(`/flights?${new URLSearchParams({ from: code(f.from), to: code(f.to), date: f.date || f.checkIn || '', adults: f.adults || 1 })}`);
      }
      const p = new URLSearchParams();
      for (const k of ['city', 'checkIn', 'checkOut', 'adults', 'children', 'rooms', 'maxPrice', 'category', 'stars', 'sort']) if (f[k]) p.set(k, f[k]);
      if (f.amenities?.length) p.set('amenities', f.amenities.join(','));
      p.set('ai', '1');
      navigate(`/search?${p}`);
    } catch (e) {
      toast.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-5">
      <form onSubmit={(e) => { e.preventDefault(); go(); }} className="flex items-center gap-2 rounded-full border border-primary/30 bg-gradient-to-r from-primary-soft to-card p-1.5 pl-4">
        <Sparkles size={18} className="flex-none text-primary" />
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={`Ask ${ai?.assistantName || 'Lexa AI'}: “beach villa in Goa for 6 under ₹20k”`} className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-muted" aria-label="Describe your trip" />
        <button type="submit" className="btn btn-primary btn-sm rounded-full" disabled={loading}>{loading ? <Loader2 size={16} className="spin" /> : <ArrowRight size={16} />}<span className="hidden sm:inline">Search</span></button>
      </form>
      <div className="no-scrollbar mt-2.5 flex gap-2 overflow-x-auto">
        {EXAMPLES.map((ex) => <button key={ex} type="button" onClick={() => { setText(ex); go(ex); }} className="flex-none rounded-full bg-surface px-3 py-1.5 text-xs font-medium text-muted hover:text-ink">{ex}</button>)}
      </div>
    </div>
  );
}

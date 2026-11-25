import { useState } from 'react';
import { Link } from 'react-router';
import { Sparkles, MessageCircle, Route, Loader2, Clock, Lightbulb } from 'lucide-react';
import { AiChat } from '@/components/ai/AiChatWidget';
import { Tabs, Input, Select, Button, Badge } from '@/components/ui';
import { api } from '@/lib/api';
import { useSettings } from '@/context/SettingsContext';
import { useToast } from '@/context/ToastContext';
import { cx } from '@/lib/format';

const INTERESTS = ['Heritage', 'Nature', 'Food', 'Adventure', 'Beaches', 'Shopping', 'Nightlife', 'Wellness', 'Spiritual', 'Photography'];

export default function AiPage() {
  const { ai, feature } = useSettings();
  const name = ai?.assistantName || 'Lexa AI';
  const [tab, setTab] = useState(feature('aiAssistant') ? 'chat' : 'plan');
  const tabs = [feature('aiAssistant') && { value: 'chat', label: 'Chat', icon: MessageCircle }, feature('aiTripPlanner') && { value: 'plan', label: 'Trip planner', icon: Route }].filter(Boolean);
  return (
    <div className="px-4 pb-3 pt-3">
      <title>{`${name} — AI trip planner | LexaTrip`}</title>
      <div className="mb-3 flex items-center gap-3">
        <span className="grid h-11 w-11 flex-none place-items-center rounded-2xl bg-primary text-white shadow-md"><Sparkles size={22} /></span>
        <div className="min-w-0 flex-1"><h1 className="text-lg font-extrabold leading-tight">{name}</h1><p className="flex items-center gap-1.5 text-[13px] text-muted"><span className="h-2 w-2 rounded-full bg-success" />Online · stays, buses &amp; trip plans</p></div>
      </div>
      {tabs.length > 1 && (
        <div className="mb-3 grid gap-1 rounded-full bg-surface p-1" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }} role="tablist">
          {tabs.map((t) => (
            <button key={t.value} role="tab" aria-selected={tab === t.value} onClick={() => setTab(t.value)} className={cx('flex h-10 items-center justify-center gap-2 rounded-full text-sm font-bold transition active:scale-95', tab === t.value ? 'bg-card text-ink shadow-sm' : 'text-muted')}><t.icon size={16} className={tab === t.value ? 'text-primary' : ''} />{t.label}</button>
          ))}
        </div>
      )}
      {tab === 'chat' ? <div className="flex h-[calc(100dvh-18.5rem)] min-h-[380px] flex-col overflow-hidden rounded-brand-lg border border-line bg-card"><AiChat className="min-h-0 flex-1" /></div> : <TripPlanner />}
    </div>
  );
}

function TripPlanner() {
  const [form, setForm] = useState({ destination: 'Udaipur', days: 3, travellers: 'couple', budget: 'moderate', interests: ['Heritage', 'Food'] });
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const generate = async (e) => {
    e.preventDefault();
    setLoading(true);
    try { const { data } = await api.post('/public/ai/plan', form); setPlan(data); } catch (er) { toast.error(er); } finally { setLoading(false); }
  };
  return (
    <div className="grid gap-5">
      <form onSubmit={generate} className="card card-pad h-fit space-y-4">
        <Input label="Destination" value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} required />
        <div className="grid grid-cols-2 gap-3">
          <Select label="Days" value={form.days} onChange={(e) => setForm({ ...form, days: Number(e.target.value) })} options={[1, 2, 3, 4, 5, 6, 7].map((n) => ({ value: n, label: `${n} day${n > 1 ? 's' : ''}` }))} />
          <Select label="Budget" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} options={['budget', 'moderate', 'luxury']} />
        </div>
        <Select label="Travelling as" value={form.travellers} onChange={(e) => setForm({ ...form, travellers: e.target.value })} options={['solo', 'couple', 'family with kids', 'friends', 'seniors']} />
        <div>
          <p className="field-label">Interests</p>
          <div className="flex flex-wrap gap-2">{INTERESTS.map((i) => <button key={i} type="button" className={cx('chip h-10 text-sm', form.interests.includes(i) && 'active')} onClick={() => setForm({ ...form, interests: form.interests.includes(i) ? form.interests.filter((x) => x !== i) : [...form.interests, i] })}>{i}</button>)}</div>
        </div>
        <Button type="submit" block loading={loading} icon={Sparkles}>Generate itinerary</Button>
      </form>
      <div>
        {loading && <div className="card grid h-64 place-items-center text-muted"><span className="flex items-center gap-2"><Loader2 className="spin" size={18} />Crafting your plan…</span></div>}
        {!loading && !plan && <div className="card grid h-64 place-items-center p-6 text-center text-sm text-muted">Your personalised itinerary will appear here.</div>}
        {!loading && plan && (
          <div className="card card-pad animate-fade-up">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h2 className="text-xl font-extrabold">{plan.title}</h2><p className="mt-1 text-[15px] text-muted">{plan.summary}</p>{plan.bestTimeToVisit && <p className="mt-1 text-xs text-muted">Best time: {plan.bestTimeToVisit}</p>}</div>
              <Badge tone={plan.engine === 'gemini' ? 'primary' : 'neutral'}>{plan.engine === 'gemini' ? 'AI generated' : 'Template plan'}</Badge>
            </div>
            <ol className="mt-6 space-y-5 border-l-2 border-primary-soft pl-5">
              {plan.days?.map((d) => (
                <li key={d.day} className="relative">
                  <span className="absolute -left-[29px] top-0.5 h-3.5 w-3.5 rounded-full bg-primary" />
                  <p className="text-xs font-bold uppercase tracking-wide text-primary">Day {d.day}</p>
                  <p className="font-bold">{d.title}</p>
                  <p className="mt-1 text-[15px] text-muted">{d.description}</p>
                  {d.activities?.length > 0 && <ul className="mt-2 space-y-1 text-sm">{d.activities.map((a, i) => <li key={i} className="flex gap-2"><Clock size={14} className="mt-0.5 flex-none text-muted" /><span><b>{a.time}</b> {a.title}{a.description ? ` — ${a.description}` : ''}</span></li>)}</ul>}
                </li>
              ))}
            </ol>
            {plan.tips?.length > 0 && <div className="mt-6 rounded-brand bg-surface p-4"><p className="mb-2 flex items-center gap-2 text-sm font-bold"><Lightbulb size={16} className="text-primary" />Tips</p><ul className="list-disc space-y-1 pl-5 text-sm text-muted">{plan.tips.map((t) => <li key={t}>{t}</li>)}</ul></div>}
            <div className="mt-6 flex flex-wrap gap-2"><Button to={`/search?city=${encodeURIComponent(form.destination)}`}>Find stays in {form.destination}</Button><Link to="/bus" className="btn btn-outline">Book a bus</Link></div>
          </div>
        )}
      </div>
    </div>
  );
}

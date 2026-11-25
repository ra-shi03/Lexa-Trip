import { useState } from 'react';
import { Link } from 'react-router';
import { Sparkles, MessageCircle, Route, Loader2, Clock, Lightbulb } from 'lucide-react';
import { Container } from '../../components/layout/UserLayout';
import { AiChat } from '../../components/ai/AiChatWidget';
import { Tabs, Input, Select, Button, Badge } from '../../components/ui';
import { api } from '../../lib/api';
import { useSettings } from '../../context/SettingsContext';
import { useToast } from '../../context/ToastContext';
import { cx } from '../../lib/format';

const INTERESTS = ['Heritage', 'Nature', 'Food', 'Adventure', 'Beaches', 'Shopping', 'Nightlife', 'Wellness', 'Spiritual', 'Photography'];

export default function AiPage() {
  const { ai, feature } = useSettings();
  const name = ai?.assistantName || 'Lexa AI';
  const [tab, setTab] = useState(feature('aiAssistant') ? 'chat' : 'plan');
  return (
    <Container className="py-6 sm:py-10">
      <title>{`${name} — AI trip planner | LexaTrip`}</title>
      <div className="mb-6 flex items-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-white"><Sparkles size={24} /></span>
        <div><h1 className="text-2xl font-extrabold sm:text-3xl">{name}</h1><p className="text-sm text-muted">Chat to find stays, or generate a day-by-day itinerary.</p></div>
      </div>
      <Tabs pill value={tab} onChange={setTab} className="mb-6 w-fit" tabs={[feature('aiAssistant') && { value: 'chat', label: 'Chat assistant', icon: MessageCircle }, feature('aiTripPlanner') && { value: 'plan', label: 'Trip planner', icon: Route }].filter(Boolean)} />
      {tab === 'chat' ? <div className="card mx-auto flex h-[70vh] max-w-3xl flex-col overflow-hidden"><AiChat className="min-h-0 flex-1" /></div> : <TripPlanner />}
    </Container>
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
    <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
      <form onSubmit={generate} className="card card-pad h-fit space-y-4">
        <Input label="Destination" value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} required />
        <div className="grid grid-cols-2 gap-3">
          <Select label="Days" value={form.days} onChange={(e) => setForm({ ...form, days: Number(e.target.value) })} options={[1, 2, 3, 4, 5, 6, 7].map((n) => ({ value: n, label: `${n} day${n > 1 ? 's' : ''}` }))} />
          <Select label="Budget" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} options={['budget', 'moderate', 'luxury']} />
        </div>
        <Select label="Travelling as" value={form.travellers} onChange={(e) => setForm({ ...form, travellers: e.target.value })} options={['solo', 'couple', 'family with kids', 'friends', 'seniors']} />
        <div>
          <p className="field-label">Interests</p>
          <div className="flex flex-wrap gap-2">{INTERESTS.map((i) => <button key={i} type="button" className={cx('chip h-8 text-xs', form.interests.includes(i) && 'active')} onClick={() => setForm({ ...form, interests: form.interests.includes(i) ? form.interests.filter((x) => x !== i) : [...form.interests, i] })}>{i}</button>)}</div>
        </div>
        <Button type="submit" block loading={loading} icon={Sparkles}>Generate itinerary</Button>
      </form>
      <div>
        {loading && <div className="card grid h-64 place-items-center text-muted"><span className="flex items-center gap-2"><Loader2 className="spin" size={18} />Crafting your plan…</span></div>}
        {!loading && !plan && <div className="card grid h-64 place-items-center p-6 text-center text-sm text-muted">Your personalised itinerary will appear here.</div>}
        {!loading && plan && (
          <div className="card card-pad animate-fade-up">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h2 className="text-xl font-extrabold">{plan.title}</h2><p className="mt-1 text-sm text-muted">{plan.summary}</p>{plan.bestTimeToVisit && <p className="mt-1 text-xs text-muted">Best time: {plan.bestTimeToVisit}</p>}</div>
              <Badge tone={plan.engine === 'gemini' ? 'primary' : 'neutral'}>{plan.engine === 'gemini' ? 'AI generated' : 'Template plan'}</Badge>
            </div>
            <ol className="mt-6 space-y-5 border-l-2 border-primary-soft pl-5">
              {plan.days?.map((d) => (
                <li key={d.day} className="relative">
                  <span className="absolute -left-[29px] top-0.5 h-3.5 w-3.5 rounded-full bg-primary" />
                  <p className="text-xs font-bold uppercase tracking-wide text-primary">Day {d.day}</p>
                  <p className="font-bold">{d.title}</p>
                  <p className="mt-1 text-sm text-muted">{d.description}</p>
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

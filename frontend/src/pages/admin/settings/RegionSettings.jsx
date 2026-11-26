import { useEffect, useState } from 'react';
import { Save, Clock3, CalendarDays, Flame, Receipt, BarChart3, Mail, ShieldCheck, Smartphone, AlertTriangle } from 'lucide-react';
import { PageHeader, Button, PageLoader, Alert, Badge } from '../../../components/ui';
import { TimezonePicker } from '../../../components/editor/TimezonePicker';
import { api } from '../../../lib/api';
import { cx, offsetName } from '../../../lib/format';
import { useSettings } from '../../../context/SettingsContext';
import { useToast } from '../../../context/ToastContext';

const QUICK = [
  ['Asia/Kolkata', 'India', 'IST'],
  ['UTC', 'UTC / GMT', 'UTC'],
  ['Asia/Dubai', 'Dubai', 'GST'],
  ['Asia/Singapore', 'Singapore', 'SGT'],
  ['Europe/London', 'London', 'GMT/BST'],
  ['America/New_York', 'New York', 'ET'],
];

const EFFECTS = [
  [CalendarDays, 'Today’s date', 'Earliest check-in date, “tonight”, default search dates and date pickers.'],
  [Flame, 'Deals of the day', 'Deals start and stop at midnight in this timezone.'],
  [Receipt, 'Times on screen', 'Booking times, departures, payments and notifications in the app, website and both panels.'],
  [BarChart3, 'Reports', 'Where each day starts and ends for daily revenue and booking totals.'],
  [Mail, 'Emails & SEO pages', 'Dates in voucher emails and on articles.'],
  [ShieldCheck, 'Automatic jobs', 'When finished stays are auto-completed after check-out.'],
];

/** "Thu, 26 Nov 2026" + "12:41:07 pm" in a zone, ticking every second */
function useClock(zone) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  if (!zone) return {};
  return {
    date: now.toLocaleDateString('en-IN', { timeZone: zone, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }),
    time: now.toLocaleTimeString('en-IN', { timeZone: zone, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  };
}

/** Admin → Settings → Region & time (master admin only). One timezone for every app, panel, report and job. */
export function RegionSettings() {
  const { reload } = useSettings();
  const toast = useToast();
  const [saved, setSaved] = useState(null);
  const [zone, setZone] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api.get('/admin/settings').then(({ data }) => { const z = data.regional?.timezone || 'Asia/Kolkata'; setSaved(z); setZone(z); }).catch((e) => toast.error(e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const clock = useClock(zone);
  const device = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (!zone) return <PageLoader />;
  const dirty = zone !== saved;

  const save = async () => {
    setBusy(true);
    try {
      await api.put('/admin/settings/regional', { timezone: zone });
      setSaved(zone);
      toast.success(`Platform time is now ${zone.replace(/_/g, ' ')} — live everywhere`);
      reload();
    } catch (e) { toast.error(e); } finally { setBusy(false); }
  };

  return (
    <div>
      <PageHeader
        title="Region & time"
        subtitle="One timezone for the whole platform — the customer app, website, vendor panel, admin panel, reports and emails all follow it, whatever device people use."
        actions={(
          <div className="flex items-center gap-2 whitespace-nowrap">
            {dirty && <Badge tone="warning">Unsaved</Badge>}
            {dirty && <Button variant="ghost" onClick={() => setZone(saved)}>Discard</Button>}
            <Button icon={Save} loading={busy} disabled={!dirty} onClick={save}>Save timezone</Button>
          </div>
        )}
      />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <section className="card card-pad space-y-5">
            <div className="flex flex-col gap-4 rounded-brand-lg bg-secondary p-5 text-white sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-white/70"><Clock3 size={14} />Platform time {dirty && '(preview)'}</p>
                <p className="mt-1 font-mono text-3xl font-extrabold tabular-nums">{clock.time}</p>
                <p className="text-sm text-white/80">{clock.date}</p>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-lg font-extrabold">{zone.replace(/_/g, ' ')}</p>
                <p className="font-mono text-sm text-white/80">{offsetName(zone)}</p>
              </div>
            </div>

            <div>
              <p className="field-label">Quick choice</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {QUICK.map(([z, name, abbr]) => (
                  <button key={z} type="button" onClick={() => setZone(z)}
                    className={cx('flex items-center justify-between gap-2 rounded-brand border px-3.5 py-2.5 text-left transition', zone === z ? 'border-primary bg-primary-soft' : 'border-line hover:border-primary/50')}>
                    <span><span className={cx('block text-sm font-bold', zone === z && 'text-primary')}>{name}</span><span className="block font-mono text-[11px] text-muted">{offsetName(z)}</span></span>
                    <span className="rounded-md bg-surface px-1.5 py-0.5 text-[11px] font-bold text-muted">{abbr}</span>
                  </button>
                ))}
              </div>
            </div>

            <TimezonePicker label="Or any timezone" value={zone} onChange={setZone} />

            {device && device !== zone && (
              <p className="flex items-center gap-2 text-xs text-muted"><Smartphone size={14} />Your device is on {device.replace(/_/g, ' ')} ({offsetName(device)}). The platform will still show {zone.replace(/_/g, ' ')} time.</p>
            )}
            {dirty && (
              <Alert tone="warning" title="This moves “today” for everyone, immediately">
                Guests, vendors and admins switch to {zone.replace(/_/g, ' ')} as soon as you save. Stored bookings and stay dates don’t change — a stay booked for 26 Nov is still 26 Nov.
              </Alert>
            )}
          </section>
        </div>

        <aside className="card card-pad space-y-4">
          <h2 className="flex items-center gap-2 font-extrabold"><AlertTriangle size={17} className="text-warning" />What this controls</h2>
          <ul className="space-y-3.5">
            {EFFECTS.map(([I, t, d]) => (
              <li key={t} className="flex gap-3">
                <span className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-primary-soft text-primary"><I size={17} /></span>
                <span><span className="block text-sm font-bold">{t}</span><span className="block text-[13px] leading-snug text-muted">{d}</span></span>
              </li>
            ))}
          </ul>
          <p className="border-t border-line pt-3 text-xs text-muted">For an India-only business keep <b>India (IST, GMT+05:30)</b> so deals and “today” turn over at local midnight, not 5:30 am.</p>
        </aside>
      </div>
    </div>
  );
}

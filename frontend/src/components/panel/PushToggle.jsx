import { useEffect, useState } from 'react';
import { BellRing, BellOff } from 'lucide-react';
import { Button } from '../ui';
import { pushSupported, pushEnabled, enablePush, disablePush } from '../../lib/push';
import { useToast } from '../../context/ToastContext';

/**
 * "Push notifications on this device" card, shown above every notifications list.
 *   <PushToggle role="user" onMessage={reload} />
 */
export function PushToggle({ role, onMessage }) {
  const toast = useToast();
  const [on, setOn] = useState(() => pushEnabled(role));
  const [busy, setBusy] = useState('');
  // a push arrived while this screen is open → refresh the list
  useEffect(() => {
    if (!onMessage || !('serviceWorker' in navigator)) return undefined;
    const handler = (e) => { if (e.data?.type === 'lt-push') onMessage(); };
    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
  }, [onMessage]);

  if (!pushSupported()) return null;
  const blocked = Notification.permission === 'denied';
  const run = async (name, fn, done) => {
    setBusy(name);
    try { await fn(); setOn(pushEnabled(role)); if (done) toast.success(done); } catch (e) { if (!e.silent) toast.error(e); } finally { setBusy(''); }
  };

  return (
    <div className="card mb-4 flex flex-wrap items-center gap-3 p-4">
      <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-primary-soft text-primary">{blocked ? <BellOff size={19} /> : <BellRing size={19} />}</span>
      <div className="min-w-0 flex-1 basis-48">
        <p className="text-sm font-bold">{on ? 'Push notifications are on' : 'Push notifications'}</p>
        <p className="text-xs text-muted">{blocked ? 'Blocked in this browser. Allow notifications in the site settings, then reload.' : on ? 'This device gets an alert even when the app is closed.' : 'Get an alert on this device for new updates.'}</p>
      </div>
      {!blocked && !on && <Button size="sm" loading={busy === 'on'} onClick={() => run('on', () => enablePush(role), 'Push notifications turned on')}>Turn on</Button>}
      {!blocked && on && <Button size="sm" variant="ghost" loading={busy === 'off'} onClick={() => run('off', () => disablePush(role), 'Push notifications turned off')}>Turn off</Button>}
    </div>
  );
}

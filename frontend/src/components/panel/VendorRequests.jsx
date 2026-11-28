import { useState } from 'react';
import { Send, Check, X, Inbox } from 'lucide-react';
import { api } from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { useToast } from '../../context/ToastContext';
import { Button, Textarea, Badge, Tabs, PageHeader, EmptyState, ErrorState, Modal, Skeleton } from '../ui';
import { timeAgo, cx } from '../../lib/format';

const KIND = { tag: 'Search tag', house_rule: 'House rule', amenity: 'Amenity', room_feature: 'Room feature' };
const STATUS = { pending: ['warning', 'Waiting for approval'], approved: ['success', 'Approved'], rejected: ['danger', 'Rejected'] };

/** Vendor: "not in the list? request it", plus their own requests of this kind with the admin's note. */
export function RequestBox({ kind, propertyId, requests = [], onSent, placeholder }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const mine = requests.filter((r) => r.kind === kind && r.status !== 'approved').slice(0, 8);
  const send = async () => {
    if (name.trim().length < 2) return;
    setBusy(true);
    try {
      const r = await api.post('/vendor/requests', { kind, name, property: propertyId });
      toast.success(r.message); setName(''); onSent?.();
    } catch (e) { if (!e.silent) toast.error(e); } finally { setBusy(false); }
  };
  return (
    <div className="rounded-brand border border-dashed border-line p-3">
      <p className="text-sm font-bold">Not in the list? Request a new {KIND[kind].toLowerCase()}</p>
      <p className="text-xs text-muted">An admin reviews it. Once approved you can select it here.</p>
      <div className="mt-2 flex gap-2">
        <input className="input input-sm flex-1" aria-label={`New ${KIND[kind]}`} value={name} maxLength={kind === 'house_rule' ? 120 : 40} placeholder={placeholder}
          onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); send(); } }} />
        <Button size="sm" variant="soft" icon={Send} loading={busy} disabled={name.trim().length < 2} onClick={send}>Send for approval</Button>
      </div>
      {mine.length > 0 && (
        <ul className="mt-3 space-y-2">
          {mine.map((r) => (
            <li key={r._id} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-semibold">{r.name}</span><Badge tone={STATUS[r.status][0]}>{STATUS[r.status][1]}</Badge>
              {r.note && <span className="text-xs text-muted">Admin note: {r.note}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Tag / house-rule picker for vendors: only approved options can be selected. */
export function OptionPicker({ label, hint, value = [], options = [], onChange }) {
  const all = [...new Set([...options, ...value])];
  return (
    <div>
      <p className="field-label">{label}</p>
      <div className="flex flex-wrap gap-2">
        {all.map((x) => {
          const on = value.includes(x);
          return (
            <button key={x} type="button" aria-pressed={on} onClick={() => onChange(on ? value.filter((v) => v !== x) : [...value, x])}
              className={cx('inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition', on ? 'border-primary bg-primary-soft font-semibold text-primary' : 'border-line hover:border-primary/50')}>
              {on && <Check size={14} />}{x}
            </button>
          );
        })}
      </div>
      {hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

/** Admin & sub-admin (`catalog`): approve or reject vendor requests. */
export function VendorRequestsPage() {
  const toast = useToast();
  const [status, setStatus] = useState('pending');
  const [act, setAct] = useState(null); // { request, action }
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const { data, meta, loading, error, reload } = useApi(() => api.get('/admin/requests', { status, limit: 100 }), [status]);
  const open = (request, action) => { setNote(''); setAct({ request, action }); };
  const decide = async () => {
    setBusy(true);
    try {
      const r = await api.patch(`/admin/requests/${act.request._id}`, { action: act.action, note });
      toast.success(r.message); setAct(null); reload();
    } catch (e) { if (!e.silent) toast.error(e); } finally { setBusy(false); }
  };
  const reject = act?.action === 'reject';
  return (
    <div>
      <PageHeader title="Vendor requests" subtitle="New search tags, house rules, amenities and room features that vendors asked for. Approved ones become available to every vendor." />
      <div className="card">
        <Tabs className="px-4" value={status} onChange={setStatus} tabs={[{ value: 'pending', label: 'Pending', count: meta?.pending }, { value: 'approved', label: 'Approved' }, { value: 'rejected', label: 'Rejected' }]} />
        <div className="divide-y divide-line">
          {loading && !data && <Skeleton className="m-4 h-24" />}
          {error && <ErrorState error={error} onRetry={reload} />}
          {!loading && !error && !data?.length && <EmptyState icon={Inbox} title={status === 'pending' ? 'Nothing to review' : `No ${status} requests`} />}
          {data?.map((r) => (
            <div key={r._id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2"><span className="font-extrabold">{r.name}</span><Badge tone="primary">{KIND[r.kind]}</Badge></p>
                <p className="mt-0.5 text-sm text-muted">{r.vendor?.businessName || 'Vendor'}{r.property?.name ? ` · ${r.property.name}` : ''} · {timeAgo(r.createdAt)}</p>
                {r.note && <p className="mt-1 text-sm">Note: {r.note}</p>}
              </div>
              {r.status === 'pending'
                ? <div className="flex gap-2"><Button size="sm" icon={Check} onClick={() => open(r, 'approve')}>Approve</Button><Button size="sm" variant="outline" icon={X} onClick={() => open(r, 'reject')}>Reject</Button></div>
                : <Badge tone={STATUS[r.status][0]}>{STATUS[r.status][1]}</Badge>}
            </div>
          ))}
        </div>
      </div>
      <Modal open={Boolean(act)} onClose={() => setAct(null)} size="sm" title={`${reject ? 'Reject' : 'Approve'} “${act?.request.name}”`}
        footer={<><Button variant="ghost" onClick={() => setAct(null)}>Cancel</Button><Button variant={reject ? 'danger' : 'primary'} loading={busy} disabled={reject && !note.trim()} onClick={decide}>{reject ? 'Reject' : 'Approve'}</Button></>}>
        <Textarea label={reject ? 'Note to vendor (required)' : 'Note to vendor (optional)'} rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder={reject ? 'Why is this not accepted?' : 'Anything the vendor should know'} />
      </Modal>
    </div>
  );
}

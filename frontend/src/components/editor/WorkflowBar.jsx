import { useState } from 'react';
import { Save, Send, Globe, EyeOff, Eye, History, CalendarClock, ExternalLink, Archive, RotateCcw, Copy } from 'lucide-react';
import { Button, StatusBadge, Drawer, Modal, Input, Textarea, Badge, Alert } from '../ui';
import { api } from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { useToast } from '../../context/ToastContext';
import { dateTime, timeAgo } from '../../lib/format';

/**
 * Draft → Review → Publish workflow with scheduling, preview, revision history and restore.
 * `endpoint` = '/admin/seo/hotels' etc., `type` = 'SeoHotel' (for preview links)
 */
export function WorkflowBar({ doc, endpoint, type, onSave, saving, dirty, onReload }) {
  const toast = useToast();
  const [history, setHistory] = useState(false);
  const [schedule, setSchedule] = useState(null);
  const [notes, setNotes] = useState(null);
  const isNew = !doc._id;

  const change = async (status, extra = {}) => {
    try {
      if (dirty) await onSave(true);
      const r = await api.post(`${endpoint}/${doc._id}/status`, { status, ...extra });
      toast.success(r.message);
      onReload();
    } catch (e) { toast.error(e); }
  };
  const preview = async () => {
    try {
      if (dirty) await onSave(true);
      const { data } = await api.get(`/admin/seo/preview/${type}/${doc._id}`);
      window.open(data.url, '_blank', 'noopener');
    } catch (e) { toast.error(e); }
  };
  const duplicate = async () => { try { const { data } = await api.post(`${endpoint}/${doc._id}/duplicate`); toast.success(`Duplicated as ${data.slug}`); } catch (e) { toast.error(e); } };

  return (
    <div className="sticky top-16 z-20 -mx-4 mb-6 border-b border-line bg-surface/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-auto flex flex-wrap items-center gap-2 text-sm">
          {isNew ? <Badge>New</Badge> : <StatusBadge status={doc.status} />}
          {!isNew && <span className="text-muted">v{doc.version} · updated {timeAgo(doc.updatedAt)}</span>}
          {doc.scheduledAt && doc.status !== 'published' && <Badge tone="primary"><CalendarClock size={12} />Publishes {dateTime(doc.scheduledAt)}</Badge>}
          {dirty && <Badge tone="warning">Unsaved changes</Badge>}
        </div>
        <Button size="sm" icon={Save} loading={saving} onClick={() => onSave()}>{isNew ? 'Create draft' : 'Save'}</Button>
        {!isNew && (
          <>
            <Button size="sm" variant="outline" icon={Eye} onClick={preview}>Preview</Button>
            {doc.status === 'draft' && <Button size="sm" variant="outline" icon={Send} onClick={() => setNotes('')}>Send for review</Button>}
            {doc.status !== 'published' && <Button size="sm" variant="secondary" icon={Globe} onClick={() => change('published')}>Publish</Button>}
            {doc.status !== 'published' && <Button size="sm" variant="ghost" icon={CalendarClock} onClick={() => setSchedule('')}>Schedule</Button>}
            {doc.status === 'published' && <Button size="sm" variant="outline" icon={EyeOff} onClick={() => change('draft')}>Unpublish</Button>}
            {doc.status === 'published' && doc.publicUrl && <Button size="sm" variant="ghost" icon={ExternalLink} href={doc.publicUrl} target="_blank" rel="noreferrer">View live</Button>}
            <Button size="sm" variant="ghost" icon={History} onClick={() => setHistory(true)}>History</Button>
            <Button size="sm" variant="ghost" icon={Copy} onClick={duplicate} aria-label="Duplicate" />
            {doc.status !== 'archived' && <Button size="sm" variant="ghost" icon={Archive} onClick={() => change('archived')} aria-label="Archive" />}
          </>
        )}
      </div>
      {doc.reviewNotes && <Alert tone="warning" className="mt-3">{doc.reviewNotes}</Alert>}

      <RevisionsDrawer open={history} onClose={() => setHistory(false)} endpoint={endpoint} id={doc._id} onRestored={() => { setHistory(false); onReload(); }} />
      <Modal open={schedule !== null} onClose={() => setSchedule(null)} title="Schedule publishing" size="sm" footer={<Button disabled={!schedule} onClick={() => { change(doc.status, { scheduledAt: new Date(schedule).toISOString() }); setSchedule(null); }}>Schedule</Button>}>
        <Input label="Publish at" type="datetime-local" value={schedule || ''} onChange={(e) => setSchedule(e.target.value)} hint="The scheduler publishes automatically and refreshes the sitemap." />
      </Modal>
      <Modal open={notes !== null} onClose={() => setNotes(null)} title="Send for review" size="sm" footer={<Button onClick={() => { change('review', { reviewNotes: notes }); setNotes(null); }}>Send</Button>}>
        <Textarea label="Notes for the reviewer (optional)" value={notes || ''} onChange={(e) => setNotes(e.target.value)} />
      </Modal>
    </div>
  );
}

function RevisionsDrawer({ open, onClose, endpoint, id, onRestored }) {
  const toast = useToast();
  const { data } = useApi(() => api.get(`${endpoint}/${id}/revisions`), [id, open], { enabled: open && Boolean(id) });
  const [view, setView] = useState(null);
  const restore = async (rev) => { try { await api.post(`/admin/seo/revisions/${rev._id}/restore`); toast.success(`Restored v${rev.version}`); onRestored(); } catch (e) { toast.error(e); } };
  const show = async (rev) => { const { data: full } = await api.get(`/admin/seo/revisions/${rev._id}`); setView(full); };
  return (
    <Drawer open={open} onClose={onClose} title="Revision history">
      <ol className="space-y-2">
        {data?.map((r, i) => (
          <li key={r._id} className="rounded-brand border border-line p-3 text-sm">
            <div className="flex items-center justify-between"><p className="font-bold">v{r.version} {i === 0 && <Badge tone="success">current</Badge>}</p><StatusBadge status={r.status} /></div>
            <p className="text-muted">{r.note || 'Edited'} · {r.authorName || 'system'}</p>
            <p className="text-xs text-muted">{dateTime(r.createdAt)}</p>
            <div className="mt-2 flex gap-2"><Button size="xs" variant="ghost" icon={Eye} onClick={() => show(r)}>View</Button>{i > 0 && <Button size="xs" variant="outline" icon={RotateCcw} onClick={() => restore(r)}>Restore</Button>}</div>
          </li>
        ))}
      </ol>
      <Modal open={Boolean(view)} onClose={() => setView(null)} title={`Snapshot v${view?.version}`} size="lg"><pre className="max-h-[60vh] overflow-auto rounded-brand bg-surface p-3 text-xs">{view && JSON.stringify(view.snapshot, null, 2)}</pre></Modal>
    </Drawer>
  );
}

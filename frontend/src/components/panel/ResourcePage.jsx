import { useState } from 'react';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import { api } from '../../lib/api';
import { useApi, useDebounce } from '../../hooks/useApi';
import { useToast } from '../../context/ToastContext';
import { DataTable, PageHeader, Button, Modal, Input, Textarea, Select, Toggle, TagInput, ConfirmDialog } from '../ui';
import { RichText } from '../editor/RichText';
import { SingleImage } from './ImageUploader';

/**
 * Config-driven CRUD screen. One component powers many admin resources.
 * fields: [{ name, label, type: text|number|textarea|select|toggle|tags|date|image|richtext, options?, required?, full?, hint? }]
 */
export function ResourcePage({ title, subtitle, endpoint, columns, fields, defaults = {}, searchable = true, transformIn = (x) => x, transformOut = (x) => x }) {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const dq = useDebounce(q);
  const { data, meta, loading, error, reload } = useApi(() => api.get(endpoint, { q: dq || undefined, page, limit: 25 }), [endpoint, dq, page]);
  const [edit, setEdit] = useState(null);
  const [del, setDel] = useState(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const save = async () => {
    const missing = fields.filter((f) => f.required && (edit[f.name] === undefined || edit[f.name] === ''));
    if (missing.length) return toast.error(`${missing.map((m) => m.label).join(', ')} required`);
    setBusy(true);
    try {
      const body = transformOut({ ...edit });
      if (edit._id) await api.put(`${endpoint}/${edit._id}`, body); else await api.post(endpoint, body);
      toast.success('Saved'); setEdit(null); reload();
    } catch (e) { toast.error(e); } finally { setBusy(false); }
  };

  const renderField = (f) => {
    const v = edit[f.name];
    const set = (val) => setEdit((s) => ({ ...s, [f.name]: val }));
    const common = { key: f.name, label: f.label, hint: f.hint, required: f.required, className: f.full ? 'sm:col-span-2' : '' };
    switch (f.type) {
      case 'textarea': return <Textarea {...common} rows={f.rows || 3} value={v ?? ''} onChange={(e) => set(e.target.value)} />;
      case 'number': return <Input {...common} type="number" value={v ?? ''} onChange={(e) => set(e.target.value === '' ? '' : Number(e.target.value))} />;
      case 'date': return <Input {...common} type="date" value={v ? String(v).slice(0, 10) : ''} onChange={(e) => set(e.target.value || null)} />;
      case 'select': return <Select {...common} placeholder={f.placeholder} value={v ?? ''} onChange={(e) => set(e.target.value)} options={typeof f.options === 'function' ? f.options(edit) : f.options} />;
      case 'toggle': return <div key={f.name} className={`flex items-end pb-2 ${f.full ? 'sm:col-span-2' : ''}`}><Toggle label={f.label} description={f.hint} checked={Boolean(v)} onChange={set} /></div>;
      case 'tags': return <TagInput {...common} value={v || []} onChange={set} />;
      case 'multiselect': return (
        <div key={f.name} className={f.full ? 'sm:col-span-2' : ''}><p className="field-label">{f.label}</p><div className="flex flex-wrap gap-2">{f.options.map((o) => <button type="button" key={o.value} className={`chip h-8 text-xs ${(v || []).includes(o.value) ? 'active' : ''}`} onClick={() => set((v || []).includes(o.value) ? v.filter((x) => x !== o.value) : [...(v || []), o.value])}>{o.label}</button>)}</div></div>
      );
      case 'image': return <div key={f.name} className={f.full ? 'sm:col-span-2' : ''}><SingleImage label={f.label} value={v ? { url: v } : null} onChange={(img) => set(img?.url || '')} uploadUrl="/admin/uploads/images" /></div>;
      case 'richtext': return <div key={f.name} className="sm:col-span-2"><p className="field-label">{f.label}</p><RichText value={v || ''} onChange={set} /></div>;
      default: return <Input {...common} value={v ?? ''} onChange={(e) => set(f.upper ? e.target.value.toUpperCase() : e.target.value)} />;
    }
  };

  return (
    <div>
      <PageHeader title={title} subtitle={subtitle} actions={<Button icon={Plus} onClick={() => setEdit({ ...defaults })}>Add new</Button>} />
      {searchable && <div className="relative mb-4 max-w-sm"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input className="input pl-9" placeholder="Search" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></div>}
      <DataTable
        rows={data}
        loading={loading}
        error={error}
        onRetry={reload}
        meta={meta}
        onPage={setPage}
        columns={[...columns, { key: '_actions', label: '', align: 'right', render: (r) => <div className="flex justify-end gap-1"><Button size="xs" variant="ghost" icon={Pencil} onClick={() => setEdit(transformIn({ ...r }))} /><Button size="xs" variant="ghost" icon={Trash2} className="text-danger" onClick={() => setDel(r)} /></div> }]}
      />
      <Modal open={Boolean(edit)} onClose={() => setEdit(null)} title={edit?._id ? `Edit ${title.replace(/s$/, '').toLowerCase()}` : `Add ${title.replace(/s$/, '').toLowerCase()}`} size="lg" footer={<><Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button><Button loading={busy} onClick={save}>Save</Button></>}>
        {edit && <div className="grid gap-4 sm:grid-cols-2">{fields.map(renderField)}</div>}
      </Modal>
      <ConfirmDialog open={Boolean(del)} onClose={() => setDel(null)} title="Delete this item?" message="This cannot be undone." confirmLabel="Delete" onConfirm={async () => { try { await api.del(`${endpoint}/${del._id}`); setDel(null); reload(); toast.success('Deleted'); } catch (e) { toast.error(e); } }} />
    </div>
  );
}

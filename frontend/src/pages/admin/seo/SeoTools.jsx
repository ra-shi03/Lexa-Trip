import { useRef, useState } from 'react';
import { Upload, Copy, Trash2, Download, FileSpreadsheet, CheckCircle2, XCircle, AlertTriangle, RefreshCw, Send, ExternalLink, Plus, Pencil, Search, Save } from 'lucide-react';
import { PageHeader, Button, DataTable, Input, Select, Toggle, Alert, Badge, StatCard, Modal, PageLoader, Img, Tabs, Textarea, ConfirmDialog, StatusBadge } from '../../../components/ui';
import { Repeater } from '../../../components/editor/Repeater';
import { SingleImage } from '../../../components/panel/ImageUploader';
import { compressForUpload } from '../../../lib/compressImage';
import { useApi, useDebounce } from '../../../hooks/useApi';
import { api } from '../../../lib/api';
import { useToast } from '../../../context/ToastContext';
import { useSettings } from '../../../context/SettingsContext';
import { dateTime, num, timeAgo, cx } from '../../../lib/format';

// ───────────── Media library ─────────────
export function MediaLibrary() {
  const [q, setQ] = useState('');
  const [folder, setFolder] = useState('');
  const [page, setPage] = useState(1);
  const dq = useDebounce(q);
  const { data, meta, reload } = useApi(() => api.get('/admin/seo/media', { q: dq || undefined, folder: folder || undefined, page, limit: 40 }), [dq, folder, page]);
  const [upload, setUpload] = useState({ folder: 'rajasthan/udaipur', alt: '' });
  const [edit, setEdit] = useState(null);
  const ref = useRef(null);
  const toast = useToast();
  const doUpload = async (files) => {
    const fd = new FormData();
    (await compressForUpload(files)).forEach((f) => fd.append('files', f));
    fd.append('folder', upload.folder);
    fd.append('alt', upload.alt);
    try { const r = await api.upload('/admin/seo/media', fd); toast.success(r.message); reload(); } catch (e) { toast.error(e); }
    if (ref.current) ref.current.value = '';
  };
  return (
    <div>
      <PageHeader title="Media library" subtitle="Organise images by folder (e.g. rajasthan/udaipur/bamboo-saa) with SEO alt text" />
      <div className="card card-pad mb-6 grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <Input label="Folder" value={upload.folder} onChange={(e) => setUpload({ ...upload, folder: e.target.value })} />
        <Input label="Default alt text" value={upload.alt} onChange={(e) => setUpload({ ...upload, alt: e.target.value })} />
        <Button icon={Upload} onClick={() => ref.current?.click()}>Upload images</Button>
        <input ref={ref} type="file" hidden multiple accept="image/*" onChange={(e) => doUpload(e.target.files)} />
      </div>
      <div className="mb-4 flex flex-wrap gap-3"><div className="relative min-w-[220px] flex-1"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input className="input pl-9" placeholder="Search filename or alt" value={q} onChange={(e) => setQ(e.target.value)} /></div><input className="input w-56" placeholder="Filter folder" value={folder} onChange={(e) => setFolder(e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {data?.map((m) => (
          <div key={m._id} className="card overflow-hidden">
            <Img src={m.url} alt={m.alt} className="aspect-[4/3] w-full" />
            <div className="space-y-1 p-2.5 text-xs">
              <p className="truncate font-semibold">{m.filename}</p>
              <p className={cx('truncate', m.alt ? 'text-muted' : 'font-semibold text-warning')}>{m.alt || 'Missing alt text'}</p>
              <p className="truncate text-muted">{m.folder}</p>
              <div className="flex gap-1 pt-1"><Button size="xs" variant="ghost" icon={Copy} onClick={() => { navigator.clipboard?.writeText(m.url); toast.success('URL copied'); }} /><Button size="xs" variant="ghost" icon={Pencil} onClick={() => setEdit(m)} /><Button size="xs" variant="ghost" icon={Trash2} className="text-danger" onClick={async () => { await api.del(`/admin/seo/media/${m._id}`); reload(); }} /></div>
            </div>
          </div>
        ))}
      </div>
      {meta?.pages > 1 && <div className="mt-4 flex justify-center gap-2"><Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</Button><Button size="sm" variant="outline" disabled={page >= meta.pages} onClick={() => setPage(page + 1)}>Next</Button></div>}
      <Modal open={Boolean(edit)} onClose={() => setEdit(null)} title="Edit image" size="sm" footer={<Button onClick={async () => { await api.put(`/admin/seo/media/${edit._id}`, edit); setEdit(null); reload(); }}>Save</Button>}>
        {edit && <div className="space-y-3"><Img src={edit.url} className="aspect-video w-full rounded-brand" /><Input label="Alt text" value={edit.alt} onChange={(e) => setEdit({ ...edit, alt: e.target.value })} /><Input label="Title" value={edit.title || ''} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /><Input label="Folder" value={edit.folder} onChange={(e) => setEdit({ ...edit, folder: e.target.value })} /></div>}
      </Modal>
    </div>
  );
}

// ───────────── Bulk import ─────────────
export function BulkImport() {
  const [file, setFile] = useState(null);
  const [opts, setOpts] = useState({ createMissingLocations: false });
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);
  const { data: columns } = useApi(() => api.get('/admin/seo/import/columns'), []);
  const toast = useToast();
  const run = async (dryRun) => {
    if (!file) return toast.error('Choose a CSV or XLSX file');
    const fd = new FormData();
    fd.append('file', file);
    fd.append('dryRun', String(dryRun));
    fd.append('createMissingLocations', String(opts.createMissingLocations));
    setBusy(true);
    try { const { data } = await api.upload('/admin/seo/import', fd); setReport(data); if (!dryRun) toast.success(`Imported: ${data.created} created, ${data.updated} updated`); } catch (e) { toast.error(e); } finally { setBusy(false); }
  };
  return (
    <div>
      <PageHeader title="Bulk hotel import" subtitle="Import thousands of hotel profiles from CSV or Excel. Validate first (dry run), then import." actions={<Button variant="outline" icon={Download} onClick={() => api.download('/admin/seo/import/template', undefined, 'lexatrip-hotels-template.csv')}>Download template</Button>} />
      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <div className="card card-pad h-fit space-y-4">
          <label className="grid cursor-pointer place-items-center rounded-brand border-2 border-dashed border-line p-8 text-center hover:border-primary">
            <FileSpreadsheet size={30} className="text-primary" />
            <span className="mt-2 text-sm font-semibold">{file ? file.name : 'Choose .csv or .xlsx'}</span>
            <input type="file" hidden accept=".csv,.xlsx" onChange={(e) => { setFile(e.target.files[0]); setReport(null); }} />
          </label>
          <Toggle label="Create missing states/cities" description="Off = rows with unknown locations fail validation" checked={opts.createMissingLocations} onChange={(v) => setOpts({ ...opts, createMissingLocations: v })} />
          <div className="flex gap-2"><Button variant="outline" loading={busy} onClick={() => run(true)}>Validate (dry run)</Button><Button loading={busy} disabled={!report?.dryRun || report.failed === report.total} onClick={() => run(false)}>Import</Button></div>
          <Alert>Multi-value cells use <code>|</code> (e.g. <code>Spa|Pool</code>). Re-importing an existing slug updates details but keeps editorial content. Imported hotels default to <b>draft</b>.</Alert>
          {columns && <details className="text-xs text-muted"><summary className="cursor-pointer font-semibold">Supported columns ({columns.length})</summary><p className="mt-2 leading-relaxed">{columns.join(', ')}</p></details>}
        </div>
        <div>
          {report ? (
            <>
              <div className="mb-4 grid gap-3 sm:grid-cols-4"><StatCard label="Rows" value={report.total} /><StatCard label={report.dryRun ? 'Will create' : 'Created'} value={report.created} tone="success" /><StatCard label={report.dryRun ? 'Will update' : 'Updated'} value={report.updated} tone="navy" /><StatCard label="Errors" value={report.failed} tone="danger" /></div>
              <DataTable rows={report.rows.map((r) => ({ ...r, _id: r.line }))} columns={[{ key: 'line', label: 'Row' }, { key: 'name', label: 'Hotel' }, { key: 'action', label: 'Result', render: (r) => (r.action === 'error' ? <span className="flex items-center gap-1 text-danger"><XCircle size={15} />{r.error}</span> : <span className="flex items-center gap-1 text-success"><CheckCircle2 size={15} />{r.action}</span>) }, { key: 'w', label: 'Warnings', render: (r) => r.warnings?.length ? <span className="flex items-center gap-1 text-xs text-warning"><AlertTriangle size={13} />{r.warnings.join('; ')}</span> : '—' }]} />
            </>
          ) : <div className="card grid h-64 place-items-center text-sm text-muted">Validation report will appear here.</div>}
        </div>
      </div>
    </div>
  );
}

// ───────────── Sitemap, Search Console & global SEO settings ─────────────
export function SitemapPage() {
  const { data, loading, reload } = useApi(() => api.get('/admin/seo/sitemap'), []);
  const { data: settings, reload: reloadSettings } = useApi(() => api.get('/admin/settings'), []);
  const [seo, setSeo] = useState(null);
  const [tab, setTab] = useState('sitemap');
  const [list, setList] = useState('hotels');
  const toast = useToast();
  const { reload: reloadPublic } = useSettings();
  const s = seo || settings?.seo;
  if (loading || !s) return <PageLoader />;
  const submit = async () => { const { data: r } = await api.post('/admin/seo/sitemap/submit'); toast[r.ok ? 'success' : 'error'](r.message); reload(); };
  const saveSeo = async () => { try { await api.put('/admin/settings/seo', s); toast.success('SEO settings saved'); setSeo(null); reloadSettings(); reloadPublic(); } catch (e) { toast.error(e); } };
  return (
    <div>
      <PageHeader title="Sitemap & Search Console" subtitle="Automatic XML sitemaps for every published, indexable SEO page" actions={<><Button variant="outline" icon={RefreshCw} onClick={reload}>Regenerate</Button><Button variant="outline" icon={ExternalLink} href="/sitemap.xml" target="_blank">sitemap.xml</Button></>} />
      <Tabs className="mb-6" value={tab} onChange={setTab} tabs={[{ value: 'sitemap', label: 'Sitemap' }, { value: 'gsc', label: 'Google Search Console' }, { value: 'settings', label: 'Global SEO settings' }]} />
      {tab === 'sitemap' && (
        <div>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard label="Total URLs" value={num(data.total)} tone="navy" />
            {Object.entries(data.counts).map(([k, v]) => <StatCard key={k} label={k} value={num(v)} />)}
          </div>
          <Alert className="mb-4">Only pages that are <b>published</b>, set to <b>index</b> and <b>included in sitemap</b> are listed. Sitemaps are split by type and chunked at 45,000 URLs — ready for thousands of hotels. robots.txt references <code>{data.indexUrl}</code>.</Alert>
          <Tabs pill className="mb-3 w-fit" value={list} onChange={setList} tabs={Object.keys(data.urls).map((k) => ({ value: k, label: k }))} />
          <DataTable rows={(data.urls[list] || []).map((u) => ({ ...u, _id: u.loc }))} empty={<p className="p-6 text-center text-sm text-muted">No URLs in this sitemap yet.</p>} columns={[{ key: 'loc', label: 'URL', render: (u) => <a href={u.loc} target="_blank" rel="noreferrer" className="text-primary">{u.loc}</a> }, { key: 'priority', label: 'Priority' }, { key: 'changefreq', label: 'Freq' }, { key: 'lastmod', label: 'Last modified', render: (u) => timeAgo(u.lastmod) }]} />
          <p className="mb-2 mt-6 font-bold">Activity</p>
          <DataTable rows={data.logs} columns={[{ key: 'createdAt', label: 'When', render: (l) => dateTime(l.createdAt) }, { key: 'action', label: 'Action', render: (l) => <Badge tone={l.action === 'error' ? 'danger' : 'neutral'}>{l.action}</Badge> }, { key: 'urlCount', label: 'URLs' }, { key: 'message', label: 'Details', render: (l) => <span className="text-xs text-muted">{l.message}</span> }]} />
        </div>
      )}
      {tab === 'gsc' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="card card-pad space-y-4">
            <h3 className="font-extrabold">1 · Verify ownership</h3>
            <Input label="Google verification code" placeholder="content value of google-site-verification meta tag" value={s.gscVerification || ''} onChange={(e) => setSeo({ ...s, gscVerification: e.target.value })} hint="Added to every SEO page <head>. Or verify via DNS (recommended for sc-domain)." />
            <Input label="Bing verification code (optional)" value={s.bingVerification || ''} onChange={(e) => setSeo({ ...s, bingVerification: e.target.value })} />
            <Button size="sm" icon={Save} onClick={saveSeo}>Save verification</Button>
          </div>
          <div className="card card-pad space-y-4">
            <h3 className="font-extrabold">2 · Submit sitemap</h3>
            <p className="text-sm text-muted">Status: {data.gscConfigured ? <Badge tone="success">Service account connected</Badge> : <Badge tone="warning">Not configured</Badge>}</p>
            {!data.gscConfigured && <Alert tone="warning">Add a Google Cloud service account (Search Console API enabled, added as Owner in GSC) and set <code>GSC_SERVICE_ACCOUNT_FILE</code> + <code>GSC_SITE_URL</code> in backend/.env. You can also submit <code>{data.indexUrl}</code> manually in Search Console.</Alert>}
            <Button icon={Send} disabled={!data.gscConfigured} onClick={submit}>Submit sitemap to Google</Button>
          </div>
        </div>
      )}
      {tab === 'settings' && (
        <div className="card card-pad grid max-w-3xl gap-4 sm:grid-cols-2">
          <Input label="Site name" value={s.siteName} onChange={(e) => setSeo({ ...s, siteName: e.target.value })} />
          <Input label="Title suffix" value={s.titleSuffix} onChange={(e) => setSeo({ ...s, titleSuffix: e.target.value })} hint='Appended to SEO titles, e.g. " | LexaTrip"' />
          <Input label="Default title" className="sm:col-span-2" value={s.defaultTitle} onChange={(e) => setSeo({ ...s, defaultTitle: e.target.value })} />
          <Textarea label="Default meta description" className="sm:col-span-2" rows={2} value={s.defaultDescription} onChange={(e) => setSeo({ ...s, defaultDescription: e.target.value })} />
          <Input label="Default OG image URL" value={s.defaultOgImage} onChange={(e) => setSeo({ ...s, defaultOgImage: e.target.value })} />
          <Input label="Organisation logo URL (schema)" value={s.organizationLogo} onChange={(e) => setSeo({ ...s, organizationLogo: e.target.value })} />
          <Textarea label="Extra robots.txt rules" className="sm:col-span-2 font-mono" rows={3} value={s.robotsExtra} onChange={(e) => setSeo({ ...s, robotsExtra: e.target.value })} />
          <div className="sm:col-span-2">
            <p className="field-label">Default hotel categories for new cities</p>
            <Repeater compact items={s.hotelCategoryTemplates || []} onChange={(v) => setSeo({ ...s, hotelCategoryTemplates: v })} newItem={() => ({ name: '', slug: '' })} addLabel="Add template" render={(t, u) => <div className="grid gap-2 sm:grid-cols-3"><input className="input input-sm" placeholder="Name" value={t.name} onChange={(e) => u({ name: e.target.value })} /><input className="input input-sm" placeholder="slug" value={t.slug} onChange={(e) => u({ slug: e.target.value })} /><input className="input input-sm" type="number" placeholder="Star rating (opt.)" value={t.starRating ?? ''} onChange={(e) => u({ starRating: e.target.value ? Number(e.target.value) : undefined })} /></div>} />
          </div>
          <div className="sm:col-span-2"><Button icon={Save} onClick={saveSeo}>Save SEO settings</Button></div>
        </div>
      )}
    </div>
  );
}

// ───────────── Redirects ─────────────
export function RedirectsPage() {
  const [q, setQ] = useState('');
  const dq = useDebounce(q);
  const { data, reload } = useApi(() => api.get('/admin/seo/redirects', { q: dq || undefined }), [dq]);
  const [edit, setEdit] = useState(null);
  const [del, setDel] = useState(null);
  const toast = useToast();
  const save = async () => { try { if (edit._id) await api.put(`/admin/seo/redirects/${edit._id}`, edit); else await api.post('/admin/seo/redirects', edit); setEdit(null); reload(); toast.success('Redirect saved'); } catch (e) { toast.error(e); } };
  return (
    <div>
      <PageHeader title="Redirects" subtitle="301s are created automatically when a published page’s URL changes or it is deleted — preserving rankings" actions={<Button icon={Plus} onClick={() => setEdit({ from: '', to: '', code: 301, isActive: true })}>Add redirect</Button>} />
      <div className="relative mb-4 max-w-sm"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input className="input pl-9" placeholder="Search URL" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <DataTable rows={data} columns={[{ key: 'from', label: 'From', render: (r) => <code className="text-xs">{r.from}</code> }, { key: 'to', label: 'To', render: (r) => <code className="text-xs">{r.to}</code> }, { key: 'code', label: 'Type', render: (r) => <Badge>{r.code}</Badge> }, { key: 'hits', label: 'Hits' }, { key: 'isActive', label: 'Status', render: (r) => <StatusBadge status={r.isActive ? 'active' : 'closed'} /> }, { key: 'a', label: '', align: 'right', render: (r) => <div className="flex justify-end gap-1"><Button size="xs" variant="ghost" icon={Pencil} onClick={() => setEdit(r)} /><Button size="xs" variant="ghost" icon={Trash2} className="text-danger" onClick={() => setDel(r)} /></div> }]} />
      <Modal open={Boolean(edit)} onClose={() => setEdit(null)} title="Redirect" size="sm" footer={<Button onClick={save}>Save</Button>}>
        {edit && <div className="space-y-3"><Input label="From path" placeholder="/hotels/rajasthan/udaipur/old-slug/" value={edit.from} onChange={(e) => setEdit({ ...edit, from: e.target.value })} /><Input label="To path or URL" value={edit.to} onChange={(e) => setEdit({ ...edit, to: e.target.value })} /><Select label="Type" value={edit.code} onChange={(e) => setEdit({ ...edit, code: Number(e.target.value) })} options={[{ value: 301, label: '301 permanent' }, { value: 302, label: '302 temporary' }]} /><Toggle label="Active" checked={edit.isActive} onChange={(v) => setEdit({ ...edit, isActive: v })} /></div>}
      </Modal>
      <ConfirmDialog open={Boolean(del)} onClose={() => setDel(null)} title="Delete redirect?" onConfirm={async () => { await api.del(`/admin/seo/redirects/${del._id}`); setDel(null); reload(); }} />
    </div>
  );
}

// ───────────── Destinations (states & cities, shared with booking search) ─────────────
export function DestinationsPage() {
  const { data: states, reload: reloadStates } = useApi(() => api.get('/admin/seo/states', { limit: 200, sort: 'name' }), []);
  const [stateId, setStateId] = useState('');
  const { data: cities, reload: reloadCities } = useApi(() => api.get('/admin/seo/cities', { state: stateId || undefined, limit: 200, sort: 'name' }), [stateId]);
  const [edit, setEdit] = useState(null);
  const [del, setDel] = useState(null);
  const toast = useToast();
  const save = async () => {
    const ep = edit.kind === 'state' ? '/admin/seo/states' : '/admin/seo/cities';
    const body = { ...edit, kind: undefined, state: edit.state?._id || edit.state };
    try { if (edit._id) await api.put(`${ep}/${edit._id}`, body); else await api.post(ep, { ...body, status: 'published' }); setEdit(null); reloadStates(); reloadCities(); toast.success('Saved'); } catch (e) { toast.error(e); }
  };
  return (
    <div>
      <PageHeader title="Destinations" subtitle="India → States → Cities. Used by stay search, vendor listings and the SEO CMS." actions={<><Button variant="outline" icon={Plus} onClick={() => setEdit({ kind: 'state', name: '', code: '', isActive: true })}>Add state</Button><Button icon={Plus} onClick={() => setEdit({ kind: 'city', name: '', state: stateId, aliases: [], isPopular: false, isActive: true })}>Add city</Button></>} />
      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <div className="card h-fit divide-y divide-line">
          <button onClick={() => setStateId('')} className={cx('w-full px-4 py-2.5 text-left text-sm font-semibold', !stateId && 'bg-primary-soft text-primary')}>All states</button>
          {states?.map((s) => <div key={s._id} className={cx('flex items-center gap-2 px-4 py-2.5', stateId === s._id && 'bg-primary-soft')}><button className="flex-1 text-left text-sm font-semibold" onClick={() => setStateId(s._id)}>{s.name}</button><Button size="xs" variant="ghost" icon={Pencil} onClick={() => setEdit({ kind: 'state', ...s })} /><Button size="xs" variant="ghost" icon={Trash2} className="text-danger" onClick={() => setDel({ kind: 'state', ...s })} /></div>)}
        </div>
        <DataTable rows={cities} columns={[{ key: 'name', label: 'City', render: (c) => <div className="flex items-center gap-3"><Img src={c.image} className="h-10 w-14 rounded-md" /><div><p className="font-semibold">{c.name}</p><p className="text-xs text-muted">{c.aliases?.join(', ')}</p></div></div> }, { key: 's', label: 'State', render: (c) => c.state?.name }, { key: 'isPopular', label: 'Popular', render: (c) => (c.isPopular ? <Badge tone="primary">Home</Badge> : '—') }, { key: 'isActive', label: 'Status', render: (c) => <StatusBadge status={c.isActive ? 'active' : 'closed'} /> }, { key: 'a', label: '', align: 'right', render: (c) => <div className="flex justify-end gap-1"><Button size="xs" variant="ghost" icon={Pencil} onClick={() => setEdit({ kind: 'city', ...c })} /><Button size="xs" variant="ghost" icon={Trash2} className="text-danger" onClick={() => setDel({ kind: 'city', ...c })} /></div> }]} />
      </div>
      <Modal open={Boolean(edit)} onClose={() => setEdit(null)} title={`${edit?._id ? 'Edit' : 'Add'} ${edit?.kind}`} size="sm" footer={<Button onClick={save}>Save</Button>}>
        {edit && (
          <div className="space-y-3">
            <Input label="Name" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            <SingleImage label="Photo (shown on home & search)" value={edit.image ? { url: edit.image } : null} onChange={(v) => setEdit({ ...edit, image: v?.url || '' })} uploadUrl="/admin/uploads/images" />
            {edit.kind === 'state' ? <Input label="Code" value={edit.code || ''} onChange={(e) => setEdit({ ...edit, code: e.target.value.toUpperCase() })} /> : <>
              <Select label="State" placeholder="Select state" value={edit.state?._id || edit.state || ''} onChange={(e) => setEdit({ ...edit, state: e.target.value })} options={(states || []).map((s) => ({ value: s._id, label: s.name }))} />
              <Input label="Aliases (comma separated)" value={(edit.aliases || []).join(', ')} onChange={(e) => setEdit({ ...edit, aliases: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} />
              <Toggle label="Popular (show on home)" checked={edit.isPopular} onChange={(v) => setEdit({ ...edit, isPopular: v })} />
            </>}
            <Toggle label="Active" checked={edit.isActive} onChange={(v) => setEdit({ ...edit, isActive: v })} />
          </div>
        )}
      </Modal>
      <ConfirmDialog open={Boolean(del)} onClose={() => setDel(null)} title={`Delete ${del?.name}?`} message="Only possible when nothing references it." onConfirm={async () => { try { await api.del(`/admin/seo/${del.kind === 'state' ? 'states' : 'cities'}/${del._id}`); setDel(null); reloadStates(); reloadCities(); } catch (e) { toast.error(e); } }} />
    </div>
  );
}

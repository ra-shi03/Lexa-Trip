import { useState } from 'react';
import { useNavigate, useParams, useSearchParams, Link } from 'react-router';
import { Search, ArrowLeft, Check, X, Ban, Play, Plus, Pencil, Trash2, ShieldCheck } from 'lucide-react';
import { DataTable, PageHeader, StatusBadge, Tabs, Drawer, Button, PageLoader, Input, Toggle, Badge, ConfirmDialog, Modal, Checkbox, Alert, Avatar, Img, EmptyState } from '../../components/ui';
import { DocumentCard } from '../../components/panel/DocumentCard';
import { BUSINESS_TYPES } from '../../lib/businessTypes';
import { useFilters, SearchField, FilterSelect, DateRange, ClearFilters } from '../../components/panel/Filters';
import { useApi, useDebounce } from '../../hooks/useApi';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { dateLabel, dateTime, money, titleCase, timeAgo } from '../../lib/format';

function useListFilters(defaultStatus = '') {
  const [sp] = useSearchParams();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState(sp.get('status') || defaultStatus);
  const [page, setPage] = useState(1);
  return { q, setQ, dq: useDebounce(q), status, setStatus, page, setPage };
}
const SearchBox = ({ value, onChange, placeholder = 'Search' }) => (
  <div className="relative min-w-[240px] max-w-sm flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input className="input pl-9" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} /></div>
);

// ───────────── Customers ─────────────
export function UsersPage() {
  const f = useListFilters();
  const { data, meta, loading, reload } = useApi(() => api.get('/admin/users', { q: f.dq || undefined, status: f.status || undefined, page: f.page }), [f.dq, f.status, f.page]);
  const [open, setOpen] = useState(null);
  const toast = useToast();
  const { data: detail } = useApi(() => api.get(`/admin/users/${open._id}`), [open?._id], { enabled: Boolean(open) });
  const setStatus = async (u, status) => { await api.patch(`/admin/users/${u._id}/status`, { status }); toast.success(`User ${status}`); reload(); setOpen(null); };
  return (
    <div>
      <PageHeader title="Customers" subtitle="Guest accounts registered via mobile OTP" />
      <div className="mb-4 flex flex-wrap gap-3"><SearchBox value={f.q} onChange={f.setQ} placeholder="Name, phone, email" /><Tabs pill value={f.status} onChange={f.setStatus} tabs={[{ value: '', label: 'All' }, { value: 'active', label: 'Active' }, { value: 'blocked', label: 'Blocked' }]} /></div>
      <DataTable rows={data} meta={meta} onPage={f.setPage} loading={loading} onRowClick={setOpen} columns={[
        { key: 'name', label: 'Customer', render: (u) => <div className="flex items-center gap-3"><Avatar name={u.name} size={32} /><div><p className="font-semibold">{u.name || '—'}</p><p className="text-xs text-muted">{u.email}</p></div></div> },
        { key: 'phone', label: 'Mobile' }, { key: 'createdAt', label: 'Joined', render: (u) => dateLabel(u.createdAt) }, { key: 'lastLoginAt', label: 'Last login', render: (u) => (u.lastLoginAt ? timeAgo(u.lastLoginAt) : '—') },
        { key: 'status', label: 'Status', render: (u) => <StatusBadge status={u.status} /> },
      ]} />
      <Drawer open={Boolean(open)} onClose={() => setOpen(null)} title={open?.name || open?.phone} footer={open && (open.status === 'active' ? <Button variant="danger" icon={Ban} onClick={() => setStatus(open, 'blocked')}>Block customer</Button> : <Button icon={Play} onClick={() => setStatus(open, 'active')}>Unblock</Button>)}>
        {detail && (
          <div className="space-y-4 text-sm">
            <div><p className="text-muted">Mobile</p><p className="font-semibold">+91 {detail.phone}</p></div>
            <div><p className="text-muted">Email</p><p className="font-semibold">{detail.email || '—'}</p></div>
            <div><p className="mb-2 font-bold">Booking history ({detail.bookings.length})</p><div className="divide-y divide-line rounded-brand border border-line">{detail.bookings.map((b) => <div key={b._id} className="flex justify-between gap-2 p-3"><div><p className="font-semibold">{b.bookingCode}</p><p className="text-xs text-muted">{b.snapshot?.propertyName || `${b.trip?.from} → ${b.trip?.to}`}</p></div><StatusBadge status={b.status} /></div>)}</div></div>
          </div>
        )}
      </Drawer>
    </div>
  );
}

// ───────────── Vendors ─────────────
/** "Pending" is split into what it means for the admin: still filling in, or waiting for a decision */
function VendorStage({ vendor }) {
  const stage = vendor.status === 'pending' && vendor.onboarding?.stage;
  if (stage === 'incomplete') return <Badge>Profile incomplete</Badge>;
  if (stage === 'review') return <Badge tone="warning">Ready for review</Badge>;
  return <StatusBadge status={vendor.status} />;
}

export function VendorsPage() {
  const f = useListFilters();
  const navigate = useNavigate();
  const { data, meta, loading } = useApi(() => api.get('/admin/vendors', { q: f.dq || undefined, status: f.status || undefined, page: f.page }), [f.dq, f.status, f.page]);
  return (
    <div>
      <PageHeader title="Vendors" subtitle="Hotel owners & property managers" />
      <div className="mb-4 flex flex-wrap gap-3"><SearchBox value={f.q} onChange={f.setQ} placeholder="Business, name, email" /><Tabs pill value={f.status} onChange={(v) => { f.setStatus(v); f.setPage(1); }} tabs={[{ value: '', label: 'All' }, { value: 'pending', label: 'Pending' }, { value: 'approved', label: 'Approved' }, { value: 'rejected', label: 'Rejected' }, { value: 'suspended', label: 'Suspended' }]} /></div>
      <DataTable rows={data} meta={meta} onPage={f.setPage} loading={loading} onRowClick={(v) => navigate(`/admin/vendors/${v._id}`)} columns={[
        { key: 'businessName', label: 'Business', render: (v) => <div><p className="font-semibold">{v.businessName}</p><p className="text-xs text-muted">{v.name} · {v.email}</p></div> },
        { key: 'phone', label: 'Phone' }, { key: 'propertyCount', label: 'Properties' }, { key: 'docs', label: 'Documents', render: (v) => `${v.documents?.filter((d) => d.status === 'verified').length || 0}/${v.documents?.length || 0} verified` },
        { key: 'createdAt', label: 'Registered', render: (v) => dateLabel(v.createdAt) }, { key: 'status', label: 'Status', render: (v) => <VendorStage vendor={v} /> },
      ]} />
    </div>
  );
}

export function VendorDetailPage() {
  const { id } = useParams();
  const { isMaster, can } = useAuth();
  const toast = useToast();
  const { data: v, loading, reload } = useApi(() => api.get(`/admin/vendors/${id}`), [id]);
  const [action, setAction] = useState(null);
  const [perms, setPerms] = useState(null);
  const [commission, setCommission] = useState('');
  if (loading) return <PageLoader />;
  const doAction = async (note) => { try { await api.post(`/admin/vendors/${id}/status`, { action, note }); toast.success('Updated'); setAction(null); reload(); } catch (e) { toast.error(e); } };
  const verifyDoc = async (doc, status) => { try { await api.put(`/admin/vendors/${id}/documents/${doc._id}`, { status }); reload(); } catch (e) { toast.error(e); } };
  const p = perms || v.permissions || {};
  return (
    <div>
      <PageHeader back={<Link to="/admin/vendors" className="mb-1 flex items-center gap-1 text-sm font-semibold text-muted"><ArrowLeft size={15} />Vendors</Link>} title={v.businessName} subtitle={<>{v.name} · {v.email} · {v.phone} · <VendorStage vendor={v} /></>} actions={<>
        {['pending', 'rejected'].includes(v.status) && <Button icon={Check} disabled={v.onboarding.missing.length > 0 || v.onboarding.stage === 'incomplete'} onClick={() => setAction('approve')}>Approve</Button>}
        {v.status === 'pending' && <Button variant="outline" icon={X} onClick={() => setAction('reject')}>Reject</Button>}
        {v.status === 'approved' && <Button variant="danger" icon={Ban} onClick={() => setAction('suspend')}>Suspend</Button>}
        {v.status === 'suspended' && <Button icon={Play} onClick={() => setAction('activate')}>Re-activate</Button>}
      </>} />
      {v.statusNote && <Alert className="mb-4" tone="warning">{v.statusNote}</Alert>}
      {v.status === 'pending' && v.onboarding.stage === 'incomplete' && (
        <Alert className="mb-4" tone="warning" title="Waiting for the vendor">
          {v.onboarding.missing.length ? `Still missing: ${v.onboarding.missing.map((m) => m.label).join(', ')}.` : 'The profile is filled in but not submitted yet.'} You can approve once they submit it.
        </Alert>
      )}
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="card card-pad space-y-3 text-sm">
          <p className="font-bold">Business details</p>
          {[['Type', BUSINESS_TYPES[v.businessType] || '—'], ['GSTIN', v.gstin], ['PAN', v.pan], ['Address', [v.address?.line1, v.address?.city, v.address?.state, v.address?.pincode].filter(Boolean).join(', ')], ['Bank', v.bank?.accountNumber ? `${v.bank.bankName} · ••${v.bank.accountNumber.slice(-4)} · ${v.bank.ifsc}` : '—']].map(([l, val]) => <div key={l} className="flex justify-between gap-4"><span className="text-muted">{l}</span><span className="text-right font-medium">{val || '—'}</span></div>)}
        </div>
        <div className="card card-pad">
          <p className="mb-3 font-bold">Documents</p>
          {!v.documents?.length && <p className="text-sm text-muted">No documents uploaded.</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            {v.documents?.map((d) => (
              <DocumentCard key={d._id} doc={d} fileUrl={`/admin/vendors/${id}/documents/${d._id}/file`} actions={(
                <div className="flex gap-2 pt-1">
                  <Button size="xs" variant="outline" icon={Check} disabled={d.status === 'verified'} onClick={() => verifyDoc(d, 'verified')}>Verify</Button>
                  <Button size="xs" variant="ghost" icon={X} disabled={d.status === 'rejected'} onClick={() => verifyDoc(d, 'rejected')}>Reject</Button>
                </div>
              )} />
            ))}
          </div>
        </div>
        <div className="card card-pad space-y-4">
          <p className="font-bold">Vendor permissions</p>
          <Input label="Max properties" type="number" value={p.maxProperties ?? 10} onChange={(e) => setPerms({ ...p, maxProperties: Number(e.target.value) })} />
          <Toggle label="Can manage inventory" checked={p.canManageInventory} onChange={(x) => setPerms({ ...p, canManageInventory: x })} />
          <Toggle label="Can edit pricing" checked={p.canEditPricing} onChange={(x) => setPerms({ ...p, canEditPricing: x })} />
          <Toggle label="Instant booking" description="Off = request-to-book (vendor approves each booking)" checked={p.instantBooking} onChange={(x) => setPerms({ ...p, instantBooking: x })} />
          <Button size="sm" disabled={!perms} onClick={async () => { await api.put(`/admin/vendors/${id}/permissions`, { permissions: p }); toast.success('Permissions saved'); setPerms(null); reload(); }}>Save permissions</Button>
        </div>
        {isMaster && can('commission') && (
          <div className="card card-pad space-y-3">
            <p className="font-bold">Commission override</p>
            <p className="text-sm text-muted">Current: {v.commissionRate !== undefined && v.commissionRate !== null ? `${v.commissionRate}%` : 'default rules'}</p>
            <div className="flex gap-2"><input className="input" type="number" placeholder="e.g. 12 (empty = default)" value={commission} onChange={(e) => setCommission(e.target.value)} /><Button onClick={async () => { await api.put(`/admin/vendors/${id}/commission`, { commissionRate: commission }); toast.success('Commission updated'); reload(); }}>Save</Button></div>
          </div>
        )}
        <div className="card xl:col-span-2"><p className="border-b border-line px-5 py-3 font-bold">Properties ({v.properties.length})</p><DataTable rows={v.properties} columns={[{ key: 'name', label: 'Property', render: (x) => <Link className="font-semibold text-primary" to={`/admin/properties/${x._id}`}>{x.name}</Link> }, { key: 'c', label: 'City', render: (x) => x.address?.city?.name }, { key: 'minPrice', label: 'From', render: (x) => money(x.minPrice) }, { key: 'status', label: 'Status', render: (x) => <StatusBadge status={x.status} /> }]} /></div>
      </div>
      <ConfirmDialog open={Boolean(action)} onClose={() => setAction(null)} onConfirm={doAction} tone={['approve', 'activate'].includes(action) ? 'primary' : 'danger'} withReason={['reject', 'suspend'].includes(action)} title={`${titleCase(action || '')} vendor?`} message={action === 'suspend' ? 'All their properties will be hidden from search.' : 'The vendor will be notified by email.'} confirmLabel={titleCase(action || '')} />
    </div>
  );
}

// ───────────── Properties (approval queue) ─────────────
export function PropertiesPage() {
  const [sp] = useSearchParams();
  const empty = { q: '', status: sp.get('status') || '', city: '', category: '', vendor: '', flag: '', from: '', to: '' };
  const f = useFilters(empty);
  const v = f.values;
  const navigate = useNavigate();
  const toast = useToast();
  const { data, meta, loading, reload } = useApi(() => api.get('/admin/properties', f.params), f.deps);
  const { data: options } = useApi(() => api.get('/admin/properties/filters'), []);
  const filtered = Boolean(v.q || v.city || v.category || v.vendor || v.flag || v.from || v.to);
  const choices = (list, label = 'name') => (list || []).map((x) => ({ value: x._id, label: x[label] }));
  const [act, setAct] = useState(null);
  const run = async (p, action, note) => { try { await api.post(`/admin/properties/${p._id}/action`, { action, note }); toast.success('Updated'); reload(); setAct(null); } catch (e) { toast.error(e); } };
  return (
    <div>
      <PageHeader title="Properties" subtitle="Review listings, control visibility & featured placement" actions={<Button icon={Plus} to="/admin/properties/new">Add property</Button>} />
      <div className="card card-pad mb-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <SearchField value={v.q} onChange={(q) => f.set({ q })} busy={f.typing} placeholder="Property name, area, city or vendor" />
          <ClearFilters show={filtered} onClear={() => f.set({ ...empty, status: v.status })} />
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          <FilterSelect label="City" all="All cities" value={v.city} onChange={(city) => f.set({ city })} options={choices(options?.cities)} />
          <FilterSelect label="Type" all="All types" value={v.category} onChange={(category) => f.set({ category })} options={choices(options?.categories)} />
          <FilterSelect label="Vendor" all="All vendors" value={v.vendor} onChange={(vendor) => f.set({ vendor })} options={choices(options?.vendors, 'businessName')} />
          <FilterSelect label="Flag" all="Any" value={v.flag} onChange={(flag) => f.set({ flag })} options={[{ value: 'featured', label: 'Featured' }, { value: 'hidden', label: 'Hidden' }]} />
          <DateRange from={v.from} to={v.to} onChange={(range) => f.set(range)} />
        </div>
      </div>
      <Tabs className="mb-4" value={v.status} onChange={(status) => f.set({ status })}
        tabs={[['', 'All', 'all'], ['pending', 'Waiting for approval'], ['approved', 'Live'], ['draft', 'Draft (not submitted)'], ['rejected', 'Rejected'], ['suspended', 'Suspended']].map(([value, label, key]) => ({ value, label, count: meta?.counts?.[key || value] }))} />
      <DataTable rows={data} meta={meta} onPage={f.setPage} loading={loading} empty={<EmptyState title={filtered || v.status ? 'No properties match these filters' : 'No properties yet'} />} columns={[
        { key: 'name', label: 'Property', render: (p) => <button onClick={() => navigate(`/admin/properties/${p._id}`)} className="flex items-center gap-3 text-left"><Img src={p.images?.[0]?.url} className="h-10 w-14 rounded-md" /><div><p className="font-semibold">{p.name}</p><p className="text-xs text-muted">{p.category?.name} · {p.address?.city?.name}</p></div></button> },
        { key: 'vendor', label: 'Vendor', render: (p) => p.vendor?.businessName }, { key: 'minPrice', label: 'From', render: (p) => money(p.minPrice) },
        { key: 'createdAt', label: 'Added', render: (p) => dateLabel(p.createdAt) },
        { key: 'flags', label: 'Flags', render: (p) => <div className="flex gap-1">{p.isFeatured && <Badge tone="primary">Featured</Badge>}{!p.isVisible && <Badge tone="warning">Hidden</Badge>}</div> },
        { key: 'status', label: 'Status', render: (p) => <StatusBadge status={p.status} /> },
        { key: 'a', label: '', align: 'right', render: (p) => (
          <div className="flex justify-end gap-1">
            {p.status === 'pending' && <><Button size="xs" icon={Check} onClick={() => run(p, 'approve')}>Approve</Button><Button size="xs" variant="outline" onClick={() => setAct({ p, action: 'reject' })}>Reject</Button></>}
            {p.status === 'approved' && <Button size="xs" variant="outline" onClick={() => run(p, p.isFeatured ? 'unfeature' : 'feature')}>{p.isFeatured ? 'Unfeature' : 'Feature'}</Button>}
            {p.status === 'approved' && <Button size="xs" variant="ghost" onClick={() => run(p, p.isVisible ? 'hide' : 'show')}>{p.isVisible ? 'Hide' : 'Show'}</Button>}
            {['approved', 'pending'].includes(p.status) && <Button size="xs" variant="ghost" className="text-danger" onClick={() => setAct({ p, action: 'suspend' })}>Suspend</Button>}
            {['suspended', 'rejected'].includes(p.status) && <Button size="xs" variant="outline" onClick={() => run(p, 'approve')}>Restore</Button>}
          </div>
        ) },
      ]} />
      <ConfirmDialog open={Boolean(act)} onClose={() => setAct(null)} withReason title={`${titleCase(act?.action || '')} ${act?.p?.name}?`} message="The vendor will be notified with your note." onConfirm={(note) => run(act.p, act.action, note)} />
    </div>
  );
}

// ───────────── Sub-admins ─────────────
export function SubadminsPage() {
  const { data, reload } = useApi(() => api.get('/admin/subadmins'), []);
  const { data: catalog } = useApi(() => api.get('/admin/permissions'), []);
  const [edit, setEdit] = useState(null);
  const [del, setDel] = useState(null);
  const toast = useToast();
  const save = async () => {
    try {
      if (edit._id) await api.put(`/admin/subadmins/${edit._id}`, edit); else await api.post('/admin/subadmins', edit);
      toast.success('Sub-admin saved'); setEdit(null); reload();
    } catch (e) { toast.error(e); }
  };
  return (
    <div>
      <PageHeader title="Sub-admins" subtitle="Delegate operations to your team. Revenue data (transactions, refunds amounts, payouts, commission, financial reports) is never accessible to sub-admins." actions={<Button icon={Plus} onClick={() => setEdit({ name: '', email: '', phone: '', password: '', permissions: ['dashboard', 'bookings'], status: 'active' })}>Add sub-admin</Button>} />
      <DataTable rows={data} columns={[
        { key: 'name', label: 'Name', render: (a) => <div className="flex items-center gap-3"><Avatar name={a.name} size={32} /><div><p className="font-semibold">{a.name}</p><p className="text-xs text-muted">{a.email}</p></div></div> },
        { key: 'permissions', label: 'Access', render: (a) => <div className="flex max-w-md flex-wrap gap-1">{a.permissions.map((p) => <Badge key={p}>{p}</Badge>)}</div> },
        { key: 'lastLoginAt', label: 'Last login', render: (a) => (a.lastLoginAt ? timeAgo(a.lastLoginAt) : 'Never') },
        { key: 'status', label: 'Status', render: (a) => <StatusBadge status={a.status === 'active' ? 'active' : 'suspended'} /> },
        { key: 'x', label: '', align: 'right', render: (a) => <div className="flex justify-end gap-1"><Button size="xs" variant="ghost" icon={Pencil} onClick={() => setEdit({ ...a, password: '' })} /><Button size="xs" variant="ghost" icon={Trash2} className="text-danger" onClick={() => setDel(a)} /></div> },
      ]} />
      <Modal open={Boolean(edit)} onClose={() => setEdit(null)} title={edit?._id ? 'Edit sub-admin' : 'New sub-admin'} size="lg" footer={<Button onClick={save}>Save</Button>}>
        {edit && catalog && (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Name" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
              <Input label="Email" type="email" disabled={Boolean(edit._id)} value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} />
              <Input label="Phone" value={edit.phone || ''} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} />
              <Input label={edit._id ? 'New password (optional)' : 'Password'} type="password" value={edit.password} onChange={(e) => setEdit({ ...edit, password: e.target.value })} hint="At least 8 characters" />
            </div>
            <div>
              <p className="field-label">Permissions</p>
              <div className="grid gap-2 sm:grid-cols-2">{catalog.assignable.map((p) => <Checkbox key={p} label={catalog.all[p]} checked={edit.permissions.includes(p)} onChange={(on) => setEdit({ ...edit, permissions: on ? [...edit.permissions, p] : edit.permissions.filter((x) => x !== p) })} />)}</div>
              <Alert className="mt-4" tone="warning"><span className="flex items-center gap-2"><ShieldCheck size={15} />Not assignable: {['finance', 'payouts', 'commission', 'revenue_reports'].map((p) => catalog.all[p]).join(' · ')}</span></Alert>
            </div>
            <Toggle label="Account active" checked={edit.status === 'active'} onChange={(on) => setEdit({ ...edit, status: on ? 'active' : 'suspended' })} />
          </div>
        )}
      </Modal>
      <ConfirmDialog open={Boolean(del)} onClose={() => setDel(null)} title={`Remove ${del?.name}?`} onConfirm={async () => { await api.del(`/admin/subadmins/${del._id}`); setDel(null); reload(); }} />
    </div>
  );
}

export function AuditPage() {
  const [page, setPage] = useState(1);
  const { data, meta, loading } = useApi(() => api.get('/admin/audit-logs', { page }), [page]);
  return (
    <div>
      <PageHeader title="Audit log" subtitle="Every admin, sub-admin and vendor action" />
      <DataTable rows={data} meta={meta} onPage={setPage} loading={loading} columns={[{ key: 'createdAt', label: 'When', render: (a) => dateTime(a.createdAt) }, { key: 'actorName', label: 'Who', render: (a) => <div><p className="font-semibold">{a.actorName}</p><p className="text-xs text-muted">{a.actorType}</p></div> }, { key: 'action', label: 'Action', render: (a) => <Badge tone="navy">{a.action}</Badge> }, { key: 'entity', label: 'Entity' }, { key: 'meta', label: 'Details', render: (a) => <span className="text-xs text-muted">{a.meta ? JSON.stringify(a.meta).slice(0, 80) : ''}</span> }]} />
    </div>
  );
}

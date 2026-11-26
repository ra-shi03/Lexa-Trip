import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Save, Send, Plus, Trash2, Pencil, ArrowLeft, Plug, RefreshCw } from 'lucide-react';
import { ImageUploader } from './ImageUploader';
import { Button, Input, Textarea, Select, Tabs, TagInput, Toggle, Checkbox, Modal, StatusBadge, PageLoader, DataTable, Badge, Alert, ConfirmDialog } from '../ui';
import { api } from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { useToast } from '../../context/ToastContext';
import { htmlToText, textToHtml } from '../../lib/plainText';
import { money, dateLabel, dateTime, titleCase } from '../../lib/format';

const EMPTY = {
  name: '', category: '', starRating: 0, shortDescription: '', description: '', _descText: '',
  address: { line1: '', area: '', landmark: '', pincode: '', city: '', state: '' }, geo: { lat: '', lng: '' },
  images: [], amenities: [], checkInTime: '14:00', checkOutTime: '11:00', houseRules: [], childPolicy: '', petPolicy: '',
  cancellationPolicy: { type: 'free', freeCancellationHours: 48, penaltyPercent: 0, text: '' }, contact: { phone: '', email: '' }, tags: [],
};

/**
 * Full property management (vendor + admin). `apiBase` = '/vendor' | '/admin'.
 * Tabs: Details · Location · Photos · Amenities · Policies · Rooms & rates · Pricing rules · Channel manager
 */
export function PropertyEditor({ apiBase, id, listPath, admin }) {
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const toast = useToast();
  const [tab, setTab] = useState('details');
  const [p, setP] = useState(isNew ? EMPTY : null);
  const [busy, setBusy] = useState(false);
  const { data: cats } = useApi(() => api.get('/public/categories'), []);
  const { data: amenities } = useApi(() => api.get('/public/amenities'), []);
  const { data: states } = useApi(() => api.get('/public/states'), []);
  const { data: cities } = useApi(() => api.get('/public/cities', p?.address?.state ? { state: p.address.state } : {}), [p?.address?.state]);
  const { data: vendors } = useApi(() => api.get('/admin/vendors', { limit: 200, status: 'approved' }), [], { enabled: Boolean(admin && isNew) });

  const load = async () => {
    const { data } = await api.get(`${apiBase}/properties/${id}`);
    setP({ ...EMPTY, ...data, _descText: htmlToText(data.description), address: { ...EMPTY.address, ...data.address }, geo: data.geo || { lat: '', lng: '' }, cancellationPolicy: { ...EMPTY.cancellationPolicy, ...data.cancellationPolicy }, contact: { ...EMPTY.contact, ...data.contact } });
  };
  useEffect(() => { if (!isNew) load().catch((e) => toast.error(e)); /* eslint-disable-next-line */ }, [id]);
  if (!p) return <PageLoader />;

  const set = (k, v) => setP((s) => ({ ...s, [k]: v }));
  const setIn = (k, sub, v) => setP((s) => ({ ...s, [k]: { ...s[k], [sub]: v } }));

  const save = async () => {
    if (!p.name || !p.category || !p.address.city || !p.address.state) return toast.error('Name, category, state and city are required');
    setBusy(true);
    try {
      const body = { ...p, geo: p.geo?.lat ? { lat: Number(p.geo.lat), lng: Number(p.geo.lng) } : undefined, amenities: p.amenities.map((a) => a._id || a) };
      delete body.rooms;
      body.description = textToHtml(p._descText);
      delete body._descText;
      if (isNew) {
        const { data } = await api.post(`${apiBase}/properties`, body);
        toast.success('Property created — now add rooms');
        navigate(`${listPath}/${data._id}`, { replace: true });
      } else {
        await api.put(`${apiBase}/properties/${id}`, body);
        toast.success('Saved');
        load();
      }
    } catch (e) { toast.error(e); } finally { setBusy(false); }
  };
  const submit = async () => { try { await api.post(`${apiBase}/properties/${id}/submit`); toast.success('Submitted for approval'); load(); } catch (e) { toast.error(e); } };

  const tabs = [
    { value: 'details', label: 'Details' }, { value: 'location', label: 'Location & contact' }, { value: 'photos', label: `Photos (${p.images.length})` },
    { value: 'amenities', label: 'Amenities' }, { value: 'policies', label: 'Policies' },
    ...(!isNew ? [{ value: 'rooms', label: 'Rooms & rate plans' }, { value: 'pricing', label: 'Pricing rules' }, { value: 'channel', label: 'Channel manager' }] : []),
  ];

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <button onClick={() => navigate(listPath)} className="mb-1 flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink"><ArrowLeft size={15} />Properties</button>
          <h1 className="flex flex-wrap items-center gap-3 text-2xl font-extrabold">{isNew ? 'Add property' : p.name}{!isNew && <StatusBadge status={p.status} />}</h1>
          {p.statusNote && <p className="mt-1 text-sm text-danger">{p.statusNote}</p>}
        </div>
        <div className="flex gap-2">
          {!isNew && !admin && ['draft', 'rejected'].includes(p.status) && <Button variant="outline" icon={Send} onClick={submit}>Submit for approval</Button>}
          {!['rooms', 'pricing', 'channel'].includes(tab) && <Button icon={Save} loading={busy} onClick={save}>{isNew ? 'Create property' : 'Save changes'}</Button>}
        </div>
      </div>
      <Tabs tabs={tabs} value={tab} onChange={setTab} className="mb-6" />

      {tab === 'details' && (
        <div className="space-y-5">
          <section className="card card-pad grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2"><h2 className="text-lg font-extrabold">Basic information</h2><p className="text-sm text-muted">What guests see first on the search results and at the top of your stay page.</p></div>
            {admin && isNew && <Select label="Vendor (owner)" required placeholder="Select vendor" value={p.vendor || ''} onChange={(e) => set('vendor', e.target.value)} options={(vendors || []).map((v) => ({ value: v._id, label: `${v.businessName} (${v.email})` }))} className="md:col-span-2" />}
            <Input label="Property name" required value={p.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Pink City Courtyard Hotel" className="md:col-span-2" />
            <Select label="Property type" required placeholder="Select type" value={p.category?._id || p.category} onChange={(e) => set('category', e.target.value)} options={(cats || []).filter((c) => c.kind !== 'deals').map((c) => ({ value: c._id, label: c.name }))} hint="Hotel, villa, resort, homestay…" />
            <Select label="Star rating" value={p.starRating} onChange={(e) => set('starRating', Number(e.target.value))} options={[0, 1, 2, 3, 4, 5].map((n) => ({ value: n, label: n ? `${'★'.repeat(n)}  ${n} star` : 'Not rated' }))} />
          </section>

          <section className="card card-pad space-y-4">
            <div><h2 className="text-lg font-extrabold">Describe your property</h2><p className="text-sm text-muted">Write naturally, like you’re telling a guest about your stay. No formatting needed.</p></div>
            <Textarea label="Short summary" rows={2} maxLength={300} value={p.shortDescription} onChange={(e) => set('shortDescription', e.target.value)} placeholder="One or two lines that make guests want to click — e.g. “Central hotel near MI Road, ideal for sightseeing and business trips.”" hint={`${p.shortDescription?.length || 0}/300 · shown on search results`} />
            <Textarea label="About this property" rows={8} value={p._descText} onChange={(e) => set('_descText', e.target.value)} placeholder={'Tell guests what makes your place special — the location, the rooms, food, nearby attractions, who it suits best.\n\nPress Enter twice to start a new paragraph. Start lines with “•” to make a list.'} hint={`${p._descText?.length || 0} characters · press Enter twice for a new paragraph`} />
          </section>

          <section className="card card-pad">
            <TagInput label="Search tags" value={p.tags || []} onChange={(v) => set('tags', v)} placeholder="Type a tag and press Enter" hint="Words guests might search for. Helps your property appear in more searches." suggestions={['Lake view', 'Honeymoon', 'Family friendly', 'Near airport', 'Pool', 'Budget', 'Luxury', 'Heritage', 'Pet friendly', 'Business travel']} />
          </section>
        </div>
      )}

      {tab === 'location' && (
        <div className="card card-pad grid gap-4 md:grid-cols-2">
          <Select label="State" required placeholder="Select state" value={p.address.state?._id || p.address.state} onChange={(e) => setP((s) => ({ ...s, address: { ...s.address, state: e.target.value, city: '' } }))} options={(states || []).map((s) => ({ value: s._id, label: s.name }))} />
          <Select label="City" required placeholder="Select city" value={p.address.city?._id || p.address.city} onChange={(e) => setIn('address', 'city', e.target.value)} options={(cities || []).map((c) => ({ value: c._id, label: c.name }))} />
          <Input label="Address line" value={p.address.line1} onChange={(e) => setIn('address', 'line1', e.target.value)} className="md:col-span-2" />
          <Input label="Area / locality" value={p.address.area} onChange={(e) => setIn('address', 'area', e.target.value)} />
          <Input label="Landmark" value={p.address.landmark} onChange={(e) => setIn('address', 'landmark', e.target.value)} />
          <Input label="Pincode" value={p.address.pincode} onChange={(e) => setIn('address', 'pincode', e.target.value)} />
          <div className="grid grid-cols-2 gap-3"><Input label="Latitude" value={p.geo?.lat ?? ''} onChange={(e) => setIn('geo', 'lat', e.target.value)} /><Input label="Longitude" value={p.geo?.lng ?? ''} onChange={(e) => setIn('geo', 'lng', e.target.value)} /></div>
          <Input label="Reception phone" value={p.contact.phone} onChange={(e) => setIn('contact', 'phone', e.target.value)} />
          <Input label="Reservations email" value={p.contact.email} onChange={(e) => setIn('contact', 'email', e.target.value)} />
        </div>
      )}

      {tab === 'photos' && <div className="card card-pad"><p className="mb-4 text-sm text-muted">First photo is the cover. Drag to reorder. Add descriptive alt text for accessibility &amp; SEO.</p><ImageUploader value={p.images} onChange={(v) => set('images', v)} uploadUrl={`${apiBase}/uploads/images`} /></div>}

      {tab === 'amenities' && (
        <div className="card card-pad">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(amenities || []).map((a) => {
              const ids = p.amenities.map((x) => x._id || x);
              return <Checkbox key={a._id} label={a.name} checked={ids.includes(a._id)} onChange={(on) => set('amenities', on ? [...ids, a._id] : ids.filter((x) => x !== a._id))} />;
            })}
          </div>
        </div>
      )}

      {tab === 'policies' && (
        <div className="card card-pad grid gap-4 md:grid-cols-2">
          <Input label="Check-in time" type="time" value={p.checkInTime} onChange={(e) => set('checkInTime', e.target.value)} />
          <Input label="Check-out time" type="time" value={p.checkOutTime} onChange={(e) => set('checkOutTime', e.target.value)} />
          <Select label="Cancellation policy" value={p.cancellationPolicy.type} onChange={(e) => setIn('cancellationPolicy', 'type', e.target.value)} options={[{ value: 'free', label: 'Free cancellation, then first night charged' }, { value: 'partial', label: 'Free cancellation, then % penalty' }, { value: 'non_refundable', label: 'Non-refundable' }]} />
          <Input label="Free cancellation until (hours before check-in)" type="number" min={0} value={p.cancellationPolicy.freeCancellationHours} onChange={(e) => setIn('cancellationPolicy', 'freeCancellationHours', Number(e.target.value))} />
          {p.cancellationPolicy.type === 'partial' && <Input label="Penalty % after free window" type="number" min={0} max={100} value={p.cancellationPolicy.penaltyPercent} onChange={(e) => setIn('cancellationPolicy', 'penaltyPercent', Number(e.target.value))} />}
          <Textarea label="Policy text shown to guests" rows={2} value={p.cancellationPolicy.text} onChange={(e) => setIn('cancellationPolicy', 'text', e.target.value)} className="md:col-span-2" />
          <TagInput label="House rules" value={p.houseRules} onChange={(v) => set('houseRules', v)} placeholder="Type a rule and press Enter" hint="Shown to guests before they book" suggestions={['No smoking', 'No loud music after 10 PM', 'Valid photo ID required at check-in', 'Outside visitors not allowed', 'Unmarried couples allowed']} className="md:col-span-2" />
          <Textarea label="Child policy" rows={2} value={p.childPolicy} onChange={(e) => set('childPolicy', e.target.value)} />
          <Textarea label="Pet policy" rows={2} value={p.petPolicy} onChange={(e) => set('petPolicy', e.target.value)} />
        </div>
      )}

      {tab === 'rooms' && <RoomsManager apiBase={apiBase} propertyId={id} amenities={amenities} />}
      {tab === 'pricing' && <PricingRules apiBase={apiBase} propertyId={id} />}
      {tab === 'channel' && <ChannelManager apiBase={apiBase} propertyId={id} />}
    </div>
  );
}

const ROOM_EMPTY = { name: '', description: '', bedType: '', sizeSqft: '', view: '', baseOccupancy: 2, maxAdults: 2, maxChildren: 1, maxOccupancy: 3, totalRooms: 1, basePrice: '', weekendPrice: '', extraAdultCharge: 0, extraChildCharge: 0, images: [], ratePlans: [{ name: 'Room only · Free cancellation', code: 'EP-FLEX', mealPlan: 'EP', refundable: true, priceAdjustment: 0, isActive: true }], isActive: true };

function RoomsManager({ apiBase, propertyId, amenities = [] }) {
  const { data, reload } = useApi(() => api.get(`${apiBase}/properties/${propertyId}/rooms`), [propertyId]);
  const [edit, setEdit] = useState(null);
  const [del, setDel] = useState(null);
  const toast = useToast();
  const save = async () => {
    try {
      const body = { ...edit, amenities: (edit.amenities || []).map((a) => a._id || a) };
      if (edit._id) await api.put(`${apiBase}/properties/${propertyId}/rooms/${edit._id}`, body); else await api.post(`${apiBase}/properties/${propertyId}/rooms`, body);
      toast.success('Room saved'); setEdit(null); reload();
    } catch (e) { toast.error(e); }
  };
  const setR = (k, v) => setEdit((s) => ({ ...s, [k]: v }));
  const setPlan = (i, k, v) => setEdit((s) => ({ ...s, ratePlans: s.ratePlans.map((r, j) => (j === i ? { ...r, [k]: v } : r)) }));
  return (
    <div>
      <div className="mb-4 flex justify-end"><Button icon={Plus} onClick={() => setEdit({ ...ROOM_EMPTY })}>Add room type</Button></div>
      <DataTable
        rows={data}
        columns={[
          { key: 'name', label: 'Room', render: (r) => <div><p className="font-semibold">{r.name}</p><p className="text-xs text-muted">{r.bedType} · max {r.maxOccupancy} guests</p></div> },
          { key: 'totalRooms', label: 'Inventory' },
          { key: 'basePrice', label: 'Weekday', render: (r) => money(r.basePrice) },
          { key: 'weekendPrice', label: 'Weekend', render: (r) => money(r.weekendPrice || r.basePrice) },
          { key: 'ratePlans', label: 'Rate plans', render: (r) => <div className="flex flex-wrap gap-1">{r.ratePlans?.map((x) => <Badge key={x.code}>{x.code}</Badge>)}</div> },
          { key: 'isActive', label: 'Status', render: (r) => <StatusBadge status={r.isActive ? 'active' : 'closed'} /> },
          { key: 'a', label: '', align: 'right', render: (r) => <div className="flex justify-end gap-1"><Button size="xs" variant="ghost" icon={Pencil} onClick={() => setEdit({ ...ROOM_EMPTY, ...r, amenities: (r.amenities || []).map((a) => a._id || a) })} /><Button size="xs" variant="ghost" icon={Trash2} className="text-danger" onClick={() => setDel(r)} /></div> },
        ]}
      />
      <Modal open={Boolean(edit)} onClose={() => setEdit(null)} title={edit?._id ? 'Edit room type' : 'Add room type'} size="lg" footer={<Button onClick={save}>Save room</Button>}>
        {edit && (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <Input label="Room name" required className="sm:col-span-2" value={edit.name} onChange={(e) => setR('name', e.target.value)} />
              <Input label="Total rooms (inventory)" type="number" min={0} value={edit.totalRooms} onChange={(e) => setR('totalRooms', Number(e.target.value))} />
              <Input label="Weekday price / night" type="number" value={edit.basePrice} onChange={(e) => setR('basePrice', Number(e.target.value))} />
              <Input label="Weekend price (Fri/Sat)" type="number" value={edit.weekendPrice || ''} onChange={(e) => setR('weekendPrice', e.target.value ? Number(e.target.value) : undefined)} />
              <Input label="Bed type" value={edit.bedType} onChange={(e) => setR('bedType', e.target.value)} />
              <Input label="Adults included in price" type="number" value={edit.baseOccupancy} onChange={(e) => setR('baseOccupancy', Number(e.target.value))} />
              <Input label="Max adults" type="number" value={edit.maxAdults} onChange={(e) => setR('maxAdults', Number(e.target.value))} />
              <Input label="Max children" type="number" value={edit.maxChildren} onChange={(e) => setR('maxChildren', Number(e.target.value))} />
              <Input label="Max occupancy" type="number" value={edit.maxOccupancy} onChange={(e) => setR('maxOccupancy', Number(e.target.value))} />
              <Input label="Extra adult / night" type="number" value={edit.extraAdultCharge} onChange={(e) => setR('extraAdultCharge', Number(e.target.value))} />
              <Input label="Extra child / night" type="number" value={edit.extraChildCharge} onChange={(e) => setR('extraChildCharge', Number(e.target.value))} />
              <Input label="Size (sq ft)" type="number" value={edit.sizeSqft || ''} onChange={(e) => setR('sizeSqft', Number(e.target.value))} />
              <Input label="View" value={edit.view || ''} onChange={(e) => setR('view', e.target.value)} />
              <Textarea label="Description" rows={2} className="sm:col-span-3" value={edit.description} onChange={(e) => setR('description', e.target.value)} />
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between"><p className="font-bold">Rate plans (meal plan · refundability)</p><Button size="xs" variant="soft" icon={Plus} onClick={() => setR('ratePlans', [...edit.ratePlans, { name: '', code: '', mealPlan: 'EP', refundable: true, priceAdjustment: 0, isActive: true }])}>Add plan</Button></div>
              <div className="space-y-2">
                {edit.ratePlans.map((r, i) => (
                  <div key={i} className="grid items-end gap-2 rounded-brand border border-line p-3 sm:grid-cols-[1.6fr_1fr_1fr_1fr_auto_auto]">
                    <Input size="sm" label="Plan name" value={r.name} onChange={(e) => setPlan(i, 'name', e.target.value)} />
                    <Input size="sm" label="Code" value={r.code} onChange={(e) => setPlan(i, 'code', e.target.value.toUpperCase())} />
                    <Select size="sm" label="Meals" value={r.mealPlan} onChange={(e) => setPlan(i, 'mealPlan', e.target.value)} options={[{ value: 'EP', label: 'Room only' }, { value: 'CP', label: 'Breakfast' }, { value: 'MAP', label: 'Half board' }, { value: 'AP', label: 'Full board' }]} />
                    <Input size="sm" label="± per night" type="number" value={r.priceAdjustment} onChange={(e) => setPlan(i, 'priceAdjustment', Number(e.target.value))} />
                    <Checkbox label="Refundable" checked={r.refundable} onChange={(v) => setPlan(i, 'refundable', v)} className="pb-2" />
                    <Button size="xs" variant="ghost" icon={Trash2} className="mb-1 text-danger" onClick={() => setR('ratePlans', edit.ratePlans.filter((_, j) => j !== i))} />
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 font-bold">Room features <span className="text-xs font-normal text-muted">shown on the guest's stay page under this room</span></p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
                {amenities.map((a) => { const ids = (edit.amenities || []).map((x) => x._id || x); return <Checkbox key={a._id} label={a.name} checked={ids.includes(a._id)} onChange={(on) => setR('amenities', on ? [...ids, a._id] : ids.filter((x) => x !== a._id))} />; })}
              </div>
            </div>
            <ImageUploader value={edit.images || []} onChange={(v) => setR('images', v)} uploadUrl={`${apiBase}/uploads/images`} max={10} />
            <Toggle label="Room type active" checked={edit.isActive} onChange={(v) => setR('isActive', v)} />
          </div>
        )}
      </Modal>
      <ConfirmDialog open={Boolean(del)} onClose={() => setDel(null)} title={`Delete ${del?.name}?`} message="Inventory for this room will be removed. Rooms with upcoming bookings cannot be deleted." onConfirm={async () => { try { await api.del(`${apiBase}/properties/${propertyId}/rooms/${del._id}`); setDel(null); reload(); } catch (e) { toast.error(e); } }} />
    </div>
  );
}

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function PricingRules({ apiBase, propertyId }) {
  const { data, reload } = useApi(() => api.get(`${apiBase}/properties/${propertyId}/pricing-rules`), [propertyId]);
  const { data: rooms } = useApi(() => api.get(`${apiBase}/properties/${propertyId}/rooms`), [propertyId]);
  const [edit, setEdit] = useState(null);
  const toast = useToast();
  const save = async () => {
    try {
      if (edit._id) await api.put(`${apiBase}/properties/${propertyId}/pricing-rules/${edit._id}`, edit); else await api.post(`${apiBase}/properties/${propertyId}/pricing-rules`, edit);
      setEdit(null); reload(); toast.success('Rule saved');
    } catch (e) { toast.error(e); }
  };
  return (
    <div>
      <Alert className="mb-4">Price precedence: <b>date override</b> (inventory calendar) → <b>highest-priority rule</b> → weekend price → weekday price.</Alert>
      <div className="mb-4 flex justify-end"><Button icon={Plus} onClick={() => setEdit({ name: '', type: 'seasonal', roomType: '', startDate: '', endDate: '', daysOfWeek: [], adjustmentType: 'percent', value: 10, priority: 0, isActive: true })}>Add rule</Button></div>
      <DataTable
        rows={data}
        columns={[
          { key: 'name', label: 'Rule', render: (r) => <div><p className="font-semibold">{r.name}</p><p className="text-xs text-muted">{titleCase(r.type)} · {r.roomType?.name || 'All rooms'}</p></div> },
          { key: 'dates', label: 'Applies', render: (r) => <span className="text-sm">{r.startDate ? `${dateLabel(r.startDate)} – ${dateLabel(r.endDate)}` : 'Always'}{r.daysOfWeek?.length ? ` · ${r.daysOfWeek.map((d) => DOW[d]).join(', ')}` : ''}</span> },
          { key: 'value', label: 'Adjustment', render: (r) => (r.adjustmentType === 'percent' ? `${r.value > 0 ? '+' : ''}${r.value}%` : r.adjustmentType === 'amount' ? `${r.value > 0 ? '+' : ''}${money(r.value)}` : `= ${money(r.value)}`) },
          { key: 'priority', label: 'Priority' },
          { key: 'isActive', label: 'Status', render: (r) => <StatusBadge status={r.isActive ? 'active' : 'closed'} /> },
          { key: 'a', label: '', align: 'right', render: (r) => <div className="flex justify-end gap-1"><Button size="xs" variant="ghost" icon={Pencil} onClick={() => setEdit({ ...r, roomType: r.roomType?._id || '', startDate: r.startDate?.slice(0, 10) || '', endDate: r.endDate?.slice(0, 10) || '' })} /><Button size="xs" variant="ghost" icon={Trash2} className="text-danger" onClick={async () => { await api.del(`${apiBase}/properties/${propertyId}/pricing-rules/${r._id}`); reload(); }} /></div> },
        ]}
      />
      <Modal open={Boolean(edit)} onClose={() => setEdit(null)} title="Pricing rule" footer={<Button onClick={save}>Save rule</Button>}>
        {edit && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Name" className="sm:col-span-2" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="Diwali peak / Monsoon offer" />
            <Select label="Type" value={edit.type} onChange={(e) => setEdit({ ...edit, type: e.target.value })} options={[{ value: 'seasonal', label: 'Seasonal (date range)' }, { value: 'special_date', label: 'Special date(s)' }, { value: 'day_of_week', label: 'Day of week' }]} />
            <Select label="Room type" placeholder="All room types" value={edit.roomType} onChange={(e) => setEdit({ ...edit, roomType: e.target.value })} options={(rooms || []).map((r) => ({ value: r._id, label: r.name }))} />
            {edit.type !== 'day_of_week' && <><Input label="From" type="date" value={edit.startDate} onChange={(e) => setEdit({ ...edit, startDate: e.target.value })} /><Input label="To" type="date" value={edit.endDate} onChange={(e) => setEdit({ ...edit, endDate: e.target.value })} /></>}
            <div className="sm:col-span-2"><p className="field-label">Days of week (optional)</p><div className="flex flex-wrap gap-2">{DOW.map((d, i) => <button key={d} type="button" className={`chip h-8 text-xs ${edit.daysOfWeek.includes(i) ? 'active' : ''}`} onClick={() => setEdit({ ...edit, daysOfWeek: edit.daysOfWeek.includes(i) ? edit.daysOfWeek.filter((x) => x !== i) : [...edit.daysOfWeek, i] })}>{d}</button>)}</div></div>
            <Select label="Adjustment" value={edit.adjustmentType} onChange={(e) => setEdit({ ...edit, adjustmentType: e.target.value })} options={[{ value: 'percent', label: '% change' }, { value: 'amount', label: '₹ change' }, { value: 'fixed_price', label: 'Fixed price' }]} />
            <Input label="Value" type="number" value={edit.value} onChange={(e) => setEdit({ ...edit, value: Number(e.target.value) })} hint="Negative = discount" />
            <Input label="Priority" type="number" value={edit.priority} onChange={(e) => setEdit({ ...edit, priority: Number(e.target.value) })} hint="Higher wins when rules overlap" />
            <Toggle label="Active" checked={edit.isActive} onChange={(v) => setEdit({ ...edit, isActive: v })} />
          </div>
        )}
      </Modal>
    </div>
  );
}

function ChannelManager({ apiBase, propertyId }) {
  const { data, reload } = useApi(() => api.get(`${apiBase}/properties/${propertyId}/channel-manager`), [propertyId]);
  const [cfg, setCfg] = useState(null);
  const toast = useToast();
  useEffect(() => { if (data) setCfg({ enabled: data.config?.enabled || false, provider: data.config?.provider || 'mock', hotelCode: data.config?.hotelCode || '', roomMappings: data.rooms.map((r) => ({ roomTypeId: r._id, name: r.name, channelRoomId: r.channelRoomId || '' })) }); }, [data]);
  if (!cfg) return <PageLoader />;
  const save = async () => { try { await api.put(`${apiBase}/properties/${propertyId}/channel-manager`, cfg); toast.success('Saved'); reload(); } catch (e) { toast.error(e); } };
  const test = async () => { const { data: r } = await api.post(`${apiBase}/properties/${propertyId}/channel-manager/test`); toast[r.ok ? 'success' : 'error'](r.message); reload(); };
  const sync = async () => { const r = await api.post(`${apiBase}/properties/${propertyId}/channel-manager/sync`); toast.success(r.message); reload(); };
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <div className="card card-pad space-y-4">
        <h2 className="flex items-center gap-2 font-extrabold"><Plug size={18} className="text-primary" />Connection</h2>
        <Alert>Syncs availability, rates and reservations with OTAs (Booking.com, MakeMyTrip…) through STAAH / AxisRooms once API access is approved. “mock” is a sandbox for testing.</Alert>
        <Toggle label="Enable channel sync" checked={cfg.enabled} onChange={(v) => setCfg({ ...cfg, enabled: v })} />
        <Select label="Provider" value={cfg.provider} onChange={(e) => setCfg({ ...cfg, provider: e.target.value })} options={(data.providers || []).map((p) => ({ value: p, label: p === 'mock' ? 'Sandbox (mock)' : p.toUpperCase() }))} />
        <Input label="Hotel code at channel manager" value={cfg.hotelCode} onChange={(e) => setCfg({ ...cfg, hotelCode: e.target.value })} />
        <div><p className="field-label">Room mapping</p><div className="space-y-2">{cfg.roomMappings.map((m, i) => <div key={m.roomTypeId} className="grid grid-cols-2 items-center gap-2"><span className="text-sm font-medium">{m.name}</span><input className="input input-sm" placeholder="Channel room ID" value={m.channelRoomId} onChange={(e) => setCfg({ ...cfg, roomMappings: cfg.roomMappings.map((x, j) => (j === i ? { ...x, channelRoomId: e.target.value } : x)) })} /></div>)}</div></div>
        <div className="flex flex-wrap gap-2"><Button onClick={save}>Save</Button><Button variant="outline" onClick={test}>Test connection</Button><Button variant="outline" icon={RefreshCw} onClick={sync} disabled={!cfg.enabled}>Full sync (90 days)</Button></div>
        {data.config?.lastSyncAt && <p className="text-xs text-muted">Last sync {dateTime(data.config.lastSyncAt)} · {data.config.lastSyncStatus}</p>}
      </div>
      <div className="card overflow-hidden">
        <p className="border-b border-line px-4 py-3 font-bold">Sync log</p>
        <div className="max-h-[480px] divide-y divide-line overflow-y-auto">
          {!data.logs.length && <p className="p-4 text-sm text-muted">No sync activity yet.</p>}
          {data.logs.map((l) => <div key={l._id} className="flex items-start gap-3 px-4 py-2.5 text-sm"><StatusBadge status={l.status === 'success' ? 'success' : l.status === 'failed' ? 'failed' : 'pending'} /><div className="flex-1"><p className="font-medium">{titleCase(l.direction)} · {l.kind}</p><p className="text-xs text-muted">{l.message}</p></div><span className="text-xs text-muted">{dateTime(l.createdAt)}</span></div>)}
        </div>
      </div>
    </div>
  );
}

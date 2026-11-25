import { useState } from 'react';
import { ChevronLeft, ChevronRight, Edit3 } from 'lucide-react';
import { api } from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { useToast } from '../../context/ToastContext';
import { Button, Modal, Input, Select, Toggle, Checkbox, Skeleton, Alert, EmptyState } from '../ui';
import { isoDate, addDays, money, cx } from '../../lib/format';

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/**
 * Inventory calendar (room types × dates): available / booked / blocked / price / stop-sell.
 * Click a cell or use "Bulk update" for ranges + weekdays. Shared by vendor & admin.
 */
export function InventoryGrid({ apiBase, propertyId }) {
  const [from, setFrom] = useState(isoDate(new Date()));
  const days = 14;
  const { data, loading, error, reload } = useApi(() => api.get(`${apiBase}/properties/${propertyId}/inventory`, { from, days }), [propertyId, from], { enabled: Boolean(propertyId) });
  const [edit, setEdit] = useState(null);
  const toast = useToast();

  if (!propertyId) return <div className="card"><EmptyState title="Select a property" text="Choose a property above to manage its inventory." /></div>;
  if (error) return <Alert tone="danger">{error.message}</Alert>;
  const dates = Array.from({ length: days }, (_, i) => isoDate(addDays(from, i)));

  const openBulk = (roomTypeId, date) => setEdit({ roomTypeIds: roomTypeId ? [roomTypeId] : data.map((r) => r.roomType._id), from: date || from, to: date || isoDate(addDays(from, 6)), daysOfWeek: [], mode: { price: false, blocked: false, totalRooms: false, closed: false, minStay: false }, set: { price: '', blocked: 0, totalRooms: '', closed: false, minStay: 1 } });
  const save = async () => {
    const set = Object.fromEntries(Object.entries(edit.set).filter(([k]) => edit.mode[k]).map(([k, v]) => [k, k === 'closed' ? v : v === '' ? null : Number(v)]));
    if (!Object.keys(set).length) return toast.error('Choose at least one field to update');
    try {
      const r = await api.put(`${apiBase}/properties/${propertyId}/inventory`, { roomTypeIds: edit.roomTypeIds, from: edit.from, to: edit.to, daysOfWeek: edit.daysOfWeek, set });
      toast.success(`${r.message} · ${r.data.updatedNights} nights`); setEdit(null); reload();
    } catch (e) { toast.error(e); }
  };
  const field = (k, label, input) => (
    <div className="flex items-end gap-3"><Checkbox label="" checked={edit.mode[k]} onChange={(v) => setEdit({ ...edit, mode: { ...edit.mode, [k]: v } })} className="pb-3" /><div className={cx('flex-1', !edit.mode[k] && 'opacity-50')}>{input ?? <Input label={label} type="number" value={edit.set[k]} onChange={(e) => setEdit({ ...edit, mode: { ...edit.mode, [k]: true }, set: { ...edit.set, [k]: e.target.value } })} />}</div></div>
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" icon={ChevronLeft} onClick={() => setFrom(isoDate(addDays(from, -days)))} />
          <input type="date" className="input input-sm w-auto" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Button variant="outline" size="sm" icon={ChevronRight} onClick={() => setFrom(isoDate(addDays(from, days)))} />
          <Button variant="ghost" size="sm" onClick={() => setFrom(isoDate(new Date()))}>Today</Button>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-warning/30" />Low (≤2)</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-danger/20" />Stop-sell</span>
          <Button size="sm" icon={Edit3} onClick={() => openBulk()}>Bulk update</Button>
        </div>
      </div>
      <div className="card overflow-x-auto">
        {loading && !data ? <Skeleton className="m-4 h-40" /> : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-surface">
                <th className="sticky left-0 z-10 min-w-[180px] bg-surface px-4 py-2 text-left text-xs font-bold uppercase text-muted">Room type</th>
                {dates.map((d) => { const dt = new Date(d); const we = [5, 6].includes(dt.getDay()); return <th key={d} className={cx('inv-cell font-semibold', we && 'weekend')}><span className="block text-[10px] text-muted">{DOW[dt.getDay()]}</span>{dt.getDate()}</th>; })}
              </tr>
            </thead>
            <tbody>
              {data?.map((row) => (
                <tr key={row.roomType._id} className="border-t border-line">
                  <td className="sticky left-0 z-10 bg-card px-4 py-2"><p className="font-semibold">{row.roomType.name}</p><p className="text-xs text-muted">{row.roomType.totalRooms} rooms · {money(row.roomType.basePrice)}</p></td>
                  {dates.map((d) => {
                    const c = row.cells.find((x) => x.date === d);
                    const we = [5, 6].includes(new Date(d).getDay());
                    return (
                      <td key={d} className={cx('inv-cell cursor-pointer hover:bg-primary-soft', c?.closed ? 'closed' : c && c.available <= 2 ? 'low' : we && 'weekend')} onClick={() => openBulk(row.roomType._id, d)} title={c ? `Total ${c.total} · Booked ${c.booked} · Blocked ${c.blocked}${c.closed ? ' · STOP-SELL' : ''}` : ''}>
                        <span className="block text-base font-extrabold text-ink">{c ? c.available : '—'}</span>
                        <span className="block text-[10px] text-muted">{c?.booked ? `${c.booked} bkd` : ' '}{c?.blocked ? ` · ${c.blocked} blk` : ''}</span>
                        <span className={cx('block text-[10px]', c?.price ? 'font-bold text-primary' : 'text-muted')}>{c?.price ? money(c.price) : ''}</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="mt-2 text-xs text-muted">Numbers = rooms available to sell. Orange price = date-specific override. Changes sync to the channel manager when connected.</p>

      <Modal open={Boolean(edit)} onClose={() => setEdit(null)} title="Update inventory & rates" footer={<Button onClick={save}>Apply update</Button>}>
        {edit && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3"><Input label="From" type="date" value={edit.from} onChange={(e) => setEdit({ ...edit, from: e.target.value })} /><Input label="To (inclusive)" type="date" value={edit.to} onChange={(e) => setEdit({ ...edit, to: e.target.value })} /></div>
            <div><p className="field-label">Room types</p><div className="flex flex-wrap gap-3">{data.map((r) => <Checkbox key={r.roomType._id} label={r.roomType.name} checked={edit.roomTypeIds.includes(r.roomType._id)} onChange={(v) => setEdit({ ...edit, roomTypeIds: v ? [...edit.roomTypeIds, r.roomType._id] : edit.roomTypeIds.filter((x) => x !== r.roomType._id) })} />)}</div></div>
            <div><p className="field-label">Only on (optional)</p><div className="flex gap-1.5">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => <button key={d} type="button" className={cx('chip h-8 px-2.5 text-xs', edit.daysOfWeek.includes(i) && 'active')} onClick={() => setEdit({ ...edit, daysOfWeek: edit.daysOfWeek.includes(i) ? edit.daysOfWeek.filter((x) => x !== i) : [...edit.daysOfWeek, i] })}>{d}</button>)}</div></div>
            <div className="divider" />
            <p className="text-xs text-muted">Tick the fields you want to change:</p>
            {field('price', 'Price override / night (empty = clear)')}
            {field('blocked', 'Block rooms (not sellable)')}
            {field('totalRooms', 'Total rooms')}
            {field('minStay', 'Minimum stay (nights)')}
            {field('closed', '', <Toggle label="Stop-sell (close sales)" checked={edit.set.closed} onChange={(v) => setEdit({ ...edit, mode: { ...edit.mode, closed: true }, set: { ...edit.set, closed: v } })} />)}
          </div>
        )}
      </Modal>
    </div>
  );
}

/** Property picker + grid (used by vendor & admin inventory pages) */
export function InventoryPage({ apiBase }) {
  const { data: props } = useApi(() => api.get(`${apiBase}/properties`, { limit: 200 }), []);
  const [pid, setPid] = useState('');
  const selected = pid || props?.[0]?._id;
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-2xl font-extrabold">Inventory &amp; rates</h1><p className="text-sm text-muted">Manage availability, blocks, stop-sell and date-wise prices.</p></div>
        <Select className="min-w-[260px]" value={selected || ''} onChange={(e) => setPid(e.target.value)} options={(props || []).map((p) => ({ value: p._id, label: p.name }))} />
      </div>
      <InventoryGrid apiBase={apiBase} propertyId={selected} />
    </div>
  );
}

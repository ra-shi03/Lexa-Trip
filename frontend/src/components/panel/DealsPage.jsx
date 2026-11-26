import { useMemo, useState } from 'react';
import { Plus, Flame, Pencil, Square, CalendarRange, BedDouble, Percent, IndianRupee, Timer, Eye, Info, Check, Building2 } from 'lucide-react';
import { api } from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { useToast } from '../../context/ToastContext';
import { Button, Modal, Input, Select, Toggle, Badge, Tabs, PageHeader, EmptyState, ConfirmDialog, Img, Skeleton, Alert } from '../ui';
import { money, isoDate, addDays, cx, plural, weekday } from '../../lib/format';
import { dealLabel, dealRibbon, dealEnds, STATUS_META } from '../../lib/deals';

/**
 * "Deals & offers" — vendor panel (own properties) and admin panel (every vendor). Shared like InventoryPage.
 * A live deal puts the property into "Deals of the day" on the app + website and discounts the nights it covers.
 *   <DealsPage apiBase="/vendor" />   ·   <DealsPage apiBase="/admin" />
 */
const PCT_CHIPS = [10, 15, 20, 25, 30];
const AMT_CHIPS = [200, 500, 1000];
const fmt = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const nightsIn = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000) + 1;

function presetRange(key) {
  const t = new Date();
  if (key === 'tonight') return [isoDate(t), isoDate(t)];
  if (key === '3d') return [isoDate(t), isoDate(addDays(t, 2))];
  if (key === '5d') return [isoDate(t), isoDate(addDays(t, 4))];
  if (key === '7d') return [isoDate(t), isoDate(addDays(t, 6))];
  if (key === 'weekend') { // Friday + Saturday nights (this week; today if it already is Fri/Sat)
    const day = weekday(t);
    const start = day === 5 || day === 6 ? t : addDays(t, (5 - day + 7) % 7);
    return [isoDate(start), isoDate(addDays(start, weekday(start) === 6 ? 0 : 1))];
  }
  return null;
}
const PRESETS = [['tonight', 'Tonight only'], ['3d', 'Next 3 days'], ['5d', 'Next 5 days'], ['7d', 'Next 7 days'], ['weekend', 'This weekend'], ['custom', 'Custom']];

const price = (base, d) => Math.max(0, d.discountType === 'amount' ? base - Number(d.value || 0) : base * (1 - Number(d.value || 0) / 100));

export function DealsPage({ apiBase }) {
  const toast = useToast();
  const [tab, setTab] = useState('live');
  const [prop, setProp] = useState('');
  const [edit, setEdit] = useState(null);
  const [ending, setEnding] = useState(null);
  const { data: all, meta, loading, error, reload } = useApi(() => api.get(`${apiBase}/deals`, prop ? { property: prop } : {}), [apiBase, prop]);
  const { data: properties } = useApi(() => api.get(`${apiBase}/properties`, { limit: 100, status: 'approved' }), [apiBase]);
  const counts = meta?.counts || {};
  const limits = meta?.limits || { minPercent: 5, maxPercent: 70, minAmount: 50, maxWindowDays: 30 };

  const rows = useMemo(() => (all || []).filter((d) => (tab === 'all' ? true : tab === 'upcoming' ? ['scheduled', 'paused'].includes(d.status) : tab === 'past' ? d.status === 'ended' : d.status === 'live')), [all, tab]);
  const tabs = [
    { value: 'live', label: 'Live today', count: counts.live || 0 },
    { value: 'upcoming', label: 'Upcoming & paused', count: (counts.scheduled || 0) + (counts.paused || 0) },
    { value: 'past', label: 'Ended', count: counts.ended || 0 },
    { value: 'all', label: 'All', count: (all || []).length },
  ];

  const openNew = () => {
    const [s, e] = presetRange('3d');
    setEdit({ property: prop || properties?.[0]?._id || '', discountType: 'percent', value: 20, startDate: s, endDate: e, preset: '3d', roomTypes: [], title: '', isActive: true });
  };
  const openEdit = (d) => setEdit({ _id: d._id, property: d.property._id, discountType: d.discountType, value: d.value, startDate: String(d.startDate).slice(0, 10), endDate: String(d.endDate).slice(0, 10), preset: 'custom', roomTypes: d.roomTypes.map((r) => String(r._id)), title: d.title || '', isActive: d.isActive, status: d.status });
  const toggleActive = async (d) => {
    try { const r = await api.put(`${apiBase}/deals/${d._id}`, { isActive: !d.isActive }); toast.success(r.message); reload(); } catch (e) { toast.error(e); }
  };

  return (
    <div>
      <PageHeader
        title="Deals & offers"
        subtitle="Quiet night? Drop the price for a few days. Live deals appear instantly in “Deals of the day” on the app and website."
        actions={<Button icon={Plus} onClick={openNew} disabled={!properties?.length}>Create deal</Button>}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[['live', 'Live today', Flame, 'text-danger bg-danger/10'], ['scheduled', 'Scheduled', CalendarRange, 'text-primary bg-primary-soft'], ['paused', 'Paused', Square, 'text-warning bg-warning/10'], ['ended', 'Ended', Timer, 'text-muted bg-surface']].map(([k, l, I, c]) => (
          <div key={k} className="card flex items-center gap-3 p-4">
            <span className={cx('grid h-10 w-10 place-items-center rounded-xl', c)}><I size={19} /></span>
            <div><p className="text-xl font-extrabold leading-none">{loading && !all ? '–' : counts[k] || 0}</p><p className="mt-1 text-xs font-semibold text-muted">{l}</p></div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="flex flex-col gap-3 border-b border-line px-4 pt-2 sm:flex-row sm:items-end sm:justify-between">
          <Tabs tabs={tabs} value={tab} onChange={setTab} className="-mb-px border-0" />
          <div className="pb-3 sm:w-64"><Select size="sm" value={prop} onChange={(e) => setProp(e.target.value)} placeholder="All properties" options={(properties || []).map((p) => ({ value: p._id, label: p.name }))} aria-label="Filter by property" /></div>
        </div>

        <div className="p-4">
          {error && <Alert tone="danger">{error.message}</Alert>}
          {loading && !all && <div className="grid gap-3 lg:grid-cols-2">{[0, 1].map((i) => <Skeleton key={i} className="h-36" />)}</div>}
          {!loading && !rows.length && (
            <EmptyState icon={Flame} title={tab === 'live' ? 'No deal is live today' : 'Nothing here yet'}
              text={properties?.length ? 'A deal lowers your price for the nights you pick. Guests see it in “Deals of the day” with your original price crossed out.' : 'Deals can run once a property is approved and live.'}
              action={properties?.length ? <Button icon={Plus} onClick={openNew}>Create your first deal</Button> : null} />
          )}
          <div className="grid gap-3 lg:grid-cols-2">
            {rows.map((d) => <DealCard key={d._id} d={d} onEdit={() => openEdit(d)} onToggle={() => toggleActive(d)} onEnd={() => setEnding(d)} />)}
          </div>
        </div>
      </div>

      <p className="mt-4 flex items-start gap-2 text-xs text-muted"><Info size={14} className="mt-0.5 flex-none" />Deals apply to stay nights inside the date range, on top of your normal price (including weekend and seasonal prices). {limits.minPercent}–{limits.maxPercent}% or a flat amount; up to {limits.maxWindowDays} days; one deal per room at a time.</p>

      {edit && <DealModal apiBase={apiBase} edit={edit} setEdit={setEdit} properties={properties || []} limits={limits} onSaved={() => { setEdit(null); reload(); setTab(edit.startDate <= isoDate(new Date()) ? 'live' : 'upcoming'); }} />}
      <ConfirmDialog open={Boolean(ending)} onClose={() => setEnding(null)}
        title={ending?.status === 'scheduled' ? 'Delete this deal?' : 'End this deal now?'}
        message={ending?.status === 'scheduled' ? 'It hasn’t started yet, so it will be removed.' : 'Guests stop seeing it right away. Bookings already made keep their deal price.'}
        confirmLabel={ending?.status === 'scheduled' ? 'Delete deal' : 'End deal'}
        onConfirm={async () => { try { const r = await api.del(`${apiBase}/deals/${ending._id}`); toast.success(r.message); setEnding(null); reload(); } catch (e) { toast.error(e); } }} />
    </div>
  );
}

function DealCard({ d, onEdit, onToggle, onEnd }) {
  const st = STATUS_META[d.status];
  const base = d.roomTypes.length ? Math.min(...d.roomTypes.map((r) => r.basePrice)) : d.property.minPrice;
  const total = nightsIn(d.startDate, d.endDate);
  const done = d.status === 'ended';
  const startsIn = Math.round((new Date(d.startDate) - new Date(isoDate(new Date()))) / 86400000);
  return (
    <article className={cx('flex flex-col rounded-brand-lg border bg-card p-4 transition', d.status === 'live' ? 'border-danger/30 shadow-card' : 'border-line', done && 'opacity-70')}>
      <div className="flex items-start gap-3">
        <div className="relative flex-none">
          <Img src={d.property.image} alt="" className="h-16 w-16 rounded-xl" />
          <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-danger px-1.5 py-0.5 text-[10px] font-extrabold text-white">{dealRibbon(d)}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate font-extrabold">{d.title || dealLabel(d)}</p>
            <Badge tone={st.tone}>{d.status === 'live' && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />}{st.label}</Badge>
          </div>
          <p className="truncate text-sm text-muted">{d.property.name}{d.property.city ? ` · ${d.property.city}` : ''}</p>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-ink">
            <span className="flex items-center gap-1"><CalendarRange size={13} className="text-muted" />{fmt(d.startDate)}{total > 1 ? ` – ${fmt(d.endDate)}` : ''} · {plural(total, 'night')}</span>
            <span className="flex items-center gap-1"><BedDouble size={13} className="text-muted" />{d.roomTypes.length ? d.roomTypes.map((r) => r.name).join(', ') : 'All rooms'}</span>
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 rounded-brand bg-surface px-3 py-2 text-sm">
        {base > 0 ? <span>From <s className="text-muted">{money(base)}</s> <b className="text-success">{money(price(base, d))}</b> <span className="text-xs text-muted">/ night</span></span> : <span className="text-muted">{dealLabel(d)}</span>}
        <span className={cx('text-xs font-bold', d.status === 'live' ? 'text-danger' : 'text-muted')}>
          {d.status === 'live' ? dealEnds(d) : d.status === 'scheduled' ? (startsIn <= 1 ? 'Starts tomorrow' : `Starts in ${startsIn} days`) : d.status === 'paused' ? 'Hidden from guests' : `Ended ${fmt(d.endDate)}`}
        </span>
      </div>

      {!done && (
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3">
          <Toggle label={d.isActive ? 'On' : 'Paused'} checked={d.isActive} onChange={onToggle} />
          <div className="flex gap-1.5">
            <Button size="sm" variant="ghost" icon={Pencil} onClick={onEdit}>Edit</Button>
            <Button size="sm" variant="ghost" icon={Square} className="text-danger" onClick={onEnd}>{d.status === 'scheduled' ? 'Delete' : 'End now'}</Button>
          </div>
        </div>
      )}
    </article>
  );
}

function DealModal({ apiBase, edit, setEdit, properties, limits, onSaved }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const isEdit = Boolean(edit._id);
  const property = properties.find((p) => p._id === edit.property);
  const { data: rooms, loading: roomsLoading } = useApi(() => api.get(`${apiBase}/properties/${edit.property}/rooms`), [edit.property], { enabled: Boolean(edit.property) });
  const activeRooms = (rooms || []).filter((r) => r.isActive !== false);
  const set = (patch) => setEdit({ ...edit, ...patch });
  const today = isoDate(new Date());
  const isPct = edit.discountType !== 'amount';
  const v = Number(edit.value);
  const chosenRooms = edit.roomTypes.length ? activeRooms.filter((r) => edit.roomTypes.includes(String(r._id))) : activeRooms;
  const cheapest = chosenRooms.length ? Math.min(...chosenRooms.map((r) => r.basePrice)) : 0;

  const problem =
    !edit.property ? 'Choose a property'
      : isPct && !(v >= limits.minPercent && v <= limits.maxPercent) ? `Discount must be ${limits.minPercent}–${limits.maxPercent}%`
        : !isPct && !(v >= limits.minAmount) ? `Flat discount must be at least ₹${limits.minAmount}`
          : !isPct && cheapest && v >= cheapest ? `Must be lower than the room price (${money(cheapest)})`
            : !edit.startDate || !edit.endDate ? 'Choose dates'
              : edit.endDate < edit.startDate ? 'End date is before the start date'
                : !isEdit && edit.startDate < today ? 'Start date can’t be in the past'
                  : nightsIn(edit.startDate, edit.endDate) > limits.maxWindowDays ? `At most ${limits.maxWindowDays} days`
                    : null;

  const save = async () => {
    if (problem) return toast.error(problem);
    setBusy(true);
    try {
      const body = { property: edit.property, discountType: edit.discountType, value: v, startDate: edit.startDate, endDate: edit.endDate, roomTypes: edit.roomTypes, title: edit.title, isActive: edit.isActive };
      const r = isEdit ? await api.put(`${apiBase}/deals/${edit._id}`, body) : await api.post(`${apiBase}/deals`, body);
      toast.success(r.message);
      onSaved();
    } catch (e) { toast.error(e); } finally { setBusy(false); }
  };

  const goesLive = edit.startDate <= today && edit.isActive;
  const toggleRoom = (id) => set({ roomTypes: edit.roomTypes.includes(id) ? edit.roomTypes.filter((x) => x !== id) : [...edit.roomTypes, id] });

  return (
    <Modal open onClose={() => setEdit(null)} title={isEdit ? 'Edit deal' : 'Create a deal'} size="xl"
      footer={(
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <span className={cx('text-sm font-semibold', problem ? 'text-danger' : 'text-muted')}>{problem || (goesLive ? 'Goes live as soon as you save' : edit.isActive ? `Starts ${fmt(edit.startDate)}` : 'Saved as paused')}</span>
          <div className="flex gap-2"><Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button><Button icon={goesLive ? Flame : Check} loading={busy} disabled={Boolean(problem)} onClick={save}>{isEdit ? 'Save changes' : goesLive ? 'Publish deal' : 'Schedule deal'}</Button></div>
        </div>
      )}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-6">
          {/* 1. Property */}
          <section>
            <p className="field-label">Property</p>
            {isEdit ? (
              <div className="flex items-center gap-3 rounded-brand border border-line p-2.5"><Img src={property?.images?.[0]?.url} alt="" className="h-10 w-10 rounded-lg" /><span className="font-semibold">{property?.name}</span></div>
            ) : (
              <div className="grid max-h-[176px] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                {properties.map((p) => {
                  const on = edit.property === p._id;
                  return (
                    <button key={p._id} type="button" onClick={() => set({ property: p._id, roomTypes: [] })}
                      className={cx('flex items-center gap-2.5 rounded-brand border p-2 text-left transition', on ? 'border-primary bg-primary-soft' : 'border-line hover:border-primary/50')}>
                      <Img src={p.images?.[0]?.url} alt="" className="h-10 w-10 flex-none rounded-lg" />
                      <span className="min-w-0"><span className="block truncate text-sm font-bold">{p.name}</span><span className="block truncate text-xs text-muted">{p.address?.city?.name || p.category?.name || ''}{p.minPrice ? ` · from ${money(p.minPrice)}` : ''}</span></span>
                      {on && <Check size={16} className="ml-auto flex-none text-primary" />}
                    </button>
                  );
                })}
                {!properties.length && <p className="text-sm text-muted"><Building2 size={14} className="mr-1 inline" />No approved properties yet.</p>}
              </div>
            )}
          </section>

          {/* 2. Discount */}
          <section>
            <p className="field-label">Discount</p>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-brand bg-surface p-1">
                {[['percent', '% off', Percent], ['amount', '₹ off', IndianRupee]].map(([k, l, I]) => (
                  <button key={k} type="button" onClick={() => set({ discountType: k, value: k === 'percent' ? 20 : 500 })}
                    className={cx('flex h-9 items-center gap-1.5 rounded-[calc(var(--lt-radius)-3px)] px-3.5 text-sm font-bold transition', edit.discountType === k || (k === 'percent' && isPct) ? 'bg-card text-ink shadow-card' : 'text-muted')}><I size={14} />{l}</button>
                ))}
              </div>
              <div className="relative w-32">
                <input type="number" inputMode="numeric" min={isPct ? limits.minPercent : limits.minAmount} max={isPct ? limits.maxPercent : undefined} value={edit.value} onChange={(e) => set({ value: e.target.value })} className="input pr-9 text-lg font-extrabold" aria-label="Discount value" />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted">{isPct ? '%' : '₹'}</span>
              </div>
              {(isPct ? PCT_CHIPS : AMT_CHIPS).map((c) => (
                <button key={c} type="button" onClick={() => set({ value: c })} className={cx('h-9 rounded-full border px-3 text-sm font-bold transition', v === c ? 'border-danger bg-danger text-white' : 'border-line hover:border-danger/50')}>{isPct ? `${c}%` : `₹${c}`}</button>
              ))}
            </div>
          </section>

          {/* 3. When */}
          <section>
            <p className="field-label">Stay dates <span className="font-medium text-muted">(nights the discount applies to)</span></p>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map(([k, l]) => (
                <button key={k} type="button" onClick={() => { const r = presetRange(k); set(r ? { preset: k, startDate: r[0], endDate: r[1] } : { preset: 'custom' }); }}
                  className={cx('h-9 rounded-full border px-3.5 text-sm font-semibold transition', edit.preset === k ? 'border-secondary bg-secondary text-white' : 'border-line hover:border-secondary/40')}>{l}</button>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:max-w-md">
              <Input label="From" type="date" min={isEdit ? undefined : today} value={edit.startDate} onChange={(e) => set({ startDate: e.target.value, preset: 'custom', endDate: e.target.value > edit.endDate ? e.target.value : edit.endDate })} />
              <Input label="To (last night)" type="date" min={edit.startDate || today} value={edit.endDate} onChange={(e) => set({ endDate: e.target.value, preset: 'custom' })} />
            </div>
            {edit.startDate && edit.endDate >= edit.startDate && <p className="mt-2 text-xs font-semibold text-muted">{fmt(edit.startDate)} → {fmt(edit.endDate)} · {plural(nightsIn(edit.startDate, edit.endDate), 'night')}</p>}
          </section>

          {/* 4. Rooms */}
          <section>
            <p className="field-label">Rooms</p>
            {roomsLoading ? <Skeleton className="h-10" /> : (
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => set({ roomTypes: [] })} className={cx('h-10 rounded-full border px-4 text-sm font-bold transition', !edit.roomTypes.length ? 'border-primary bg-primary-soft text-primary' : 'border-line')}>All rooms</button>
                {activeRooms.map((r) => {
                  const on = edit.roomTypes.includes(String(r._id));
                  return <button key={r._id} type="button" onClick={() => toggleRoom(String(r._id))} className={cx('flex h-10 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold transition', on ? 'border-primary bg-primary-soft text-primary' : 'border-line hover:border-primary/40')}>{on && <Check size={14} />}{r.name}<span className="text-xs text-muted">{money(r.basePrice)}</span></button>;
                })}
              </div>
            )}
          </section>

          {/* 5. Name + status */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Deal name (optional)" maxLength={60} placeholder={`e.g. Midweek escape · default “${dealLabel({ discountType: edit.discountType, value: v || 0 })}”`} value={edit.title} onChange={(e) => set({ title: e.target.value })} />
            <div className="self-end rounded-brand border border-line p-3"><Toggle label="Active" description={edit.isActive ? 'Shown to guests on its dates' : 'Saved but hidden from guests'} checked={edit.isActive} onChange={(x) => set({ isActive: x })} /></div>
          </div>
        </div>

        {/* Preview */}
        <aside className="h-fit space-y-3 lg:sticky lg:top-0">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted"><Eye size={14} />What guests see</p>
          <div className="overflow-hidden rounded-brand-lg border border-line bg-card shadow-card">
            <div className="relative">
              <Img src={property?.images?.[0]?.url} alt="" className="h-36 w-full" />
              {v > 0 && <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-danger px-2.5 py-1 text-xs font-extrabold text-white shadow-card"><Flame size={13} />{dealRibbon({ discountType: edit.discountType, value: v })} · Today’s deal</span>}
            </div>
            <div className="p-3.5">
              <p className="truncate font-extrabold">{property?.name || 'Your property'}</p>
              <p className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-danger"><Timer size={12} />{edit.title || dealLabel({ discountType: edit.discountType, value: v || 0 })} · {edit.endDate ? `till ${fmt(edit.endDate)}` : ''}</p>
              <div className="mt-3 space-y-1.5">
                {chosenRooms.slice(0, 4).map((r) => (
                  <div key={r._id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate text-muted">{r.name}</span>
                    <span className="flex-none"><s className="mr-1.5 text-xs text-muted">{money(r.basePrice)}</s><b>{money(price(r.basePrice, { discountType: edit.discountType, value: v }))}</b></span>
                  </div>
                ))}
                {!chosenRooms.length && <p className="text-xs text-muted">{edit.property ? 'No active rooms' : 'Pick a property'}</p>}
              </div>
              <p className="mt-2 text-[11px] text-muted">Per night, before taxes. Weekend & seasonal prices are discounted the same way.</p>
            </div>
          </div>
        </aside>
      </div>
    </Modal>
  );
}

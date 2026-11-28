import { useMemo, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate, useSearchParams } from 'react-router';
import { Briefcase, User, User as UserIcon, Users, Heart, Bell, LifeBuoy, LogOut, Plus, Trash2, Pencil, BedDouble, Bus, Plane, Send, ChevronRight, Camera, Loader2, Smartphone, BadgeCheck, CheckCircle2, Cake, Mail, Lock } from 'lucide-react';
import { PushToggle } from '../../../components/panel/PushToggle';
import { compressForUpload } from '../../../lib/compressImage';
import { Container } from '../../../components/layout/UserLayout';
import { PropertyCard } from '../../../components/stay/StayComponents';
import { Button, Input, Select, Tabs, EmptyState, Skeleton, StatusBadge, Modal, Textarea, Avatar, ErrorState, Badge } from '../../../components/ui';
import { useApi } from '../../../hooks/useApi';
import { api } from '../../../lib/api';
import { useAuth } from '../../../context/AuthContext';
import { useSettings } from '../../../context/SettingsContext';
import { useToast } from '../../../context/ToastContext';
import { dateLabel, money, timeAgo, cx, titleCase, isoDate } from '../../../lib/format';

export function AccountLayout() {
  const { user, logout } = useAuth();
  const { feature } = useSettings();
  const navigate = useNavigate();
  const items = [
    ['/account/trips', 'My trips', Briefcase],
    ['/account', 'Profile', User, true],
    feature('savedTravellers') && ['/account/travellers', 'Saved travellers', Users],
    feature('wishlist') && ['/account/saved', 'Saved stays', Heart],
    ['/account/notifications', 'Notifications', Bell],
    feature('supportTickets') && ['/account/support', 'Help & support', LifeBuoy],
  ].filter(Boolean);
  return (
    <Container className="py-6 sm:py-10">
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="space-y-4">
          <div className="card card-pad flex items-center gap-3"><Avatar name={user?.name} src={user?.avatar} size={44} /><div className="min-w-0"><p className="truncate font-bold">{user?.name || 'Traveller'}</p><p className="text-sm text-muted">+91 {user?.phone}</p></div></div>
          <nav className="card no-scrollbar flex gap-1 overflow-x-auto p-2 lg:flex-col">
            {items.map(([to, label, Icon, end]) => (
              <NavLink key={to} to={to} end={end} className={({ isActive }) => cx('flex flex-none items-center gap-3 rounded-brand px-3 py-2.5 text-sm font-semibold', isActive ? 'bg-primary-soft text-primary' : 'text-ink hover:bg-surface')}><Icon size={17} />{label}</NavLink>
            ))}
            <button onClick={() => { logout('user'); navigate('/'); }} className="flex flex-none items-center gap-3 rounded-brand px-3 py-2.5 text-sm font-semibold text-danger hover:bg-surface"><LogOut size={17} />Sign out</button>
          </nav>
        </aside>
        <div className="min-w-0"><Outlet /></div>
      </div>
    </Container>
  );
}

const GENDERS = [['male', 'Male'], ['female', 'Female'], ['other', 'Other'], ['prefer_not', 'Prefer not to say']];
const ageOf = (dob) => { if (!dob) return null; const d = new Date(dob); const n = new Date(); let a = n.getFullYear() - d.getFullYear(); if (n < new Date(n.getFullYear(), d.getMonth(), d.getDate())) a -= 1; return a >= 0 && a < 130 ? a : null; };

/** Profile: photo upload, personal details, completion meter, unsaved-changes bar. Shared by website & app. */
export function Profile() {
  const { user, update } = useAuth();
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const fileRef = useRef(null);
  const initial = useMemo(() => ({ name: user?.name || '', email: user?.email || '', dob: user?.dob ? String(user.dob).slice(0, 10) : '', gender: user?.gender || '' }), [user]);
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const welcome = Boolean(sp.get('welcome'));
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setErrors((e) => ({ ...e, [k]: undefined })); setSaved(false); };

  const steps = [['Add your name', Boolean(user?.name)], ['Add a profile photo', Boolean(user?.avatar)], ['Add your email for vouchers', Boolean(user?.email)], ['Add your date of birth', Boolean(user?.dob)], ['Select your gender', Boolean(user?.gender)]];
  const done = steps.filter(([, ok]) => ok).length;
  const pct = Math.round((done / steps.length) * 100);
  const nextTip = steps.find(([, ok]) => !ok)?.[0];
  const age = ageOf(form.dob);

  const validate = () => {
    const e = {};
    if (form.name.trim().length < 2) e.name = 'Enter your full name';
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) e.email = 'Enter a valid email address';
    if (form.dob && (new Date(form.dob) > new Date() || new Date(form.dob).getFullYear() < 1900)) e.dob = 'Enter a valid date of birth';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const save = async (e) => {
    e?.preventDefault();
    if (!validate()) return;
    setBusy(true);
    try {
      const { data } = await api.put('/me/profile', form);
      update('user', data);
      setSaved(true);
      toast.success('Profile saved');
      if (sp.get('next')) navigate(sp.get('next'));
    } catch (er) { toast.error(er); } finally { setBusy(false); }
  };

  const pickPhoto = async (file) => {
    if (!file) return;
    if (!/^image\//.test(file.type)) return toast.error('Please choose an image');
    setPhotoBusy(true);
    try {
      const [small] = await compressForUpload([file]);
      const fd = new FormData();
      fd.append('avatar', small);
      const { data } = await api.upload('/me/profile/avatar', fd);
      update('user', data);
      toast.success('Profile photo updated');
    } catch (er) { toast.error(er); } finally { setPhotoBusy(false); if (fileRef.current) fileRef.current.value = ''; }
  };
  const removePhoto = async () => {
    setPhotoBusy(true);
    try { const { data } = await api.put('/me/profile', { removeAvatar: true }); update('user', data); toast.success('Photo removed'); } catch (er) { toast.error(er); } finally { setPhotoBusy(false); }
  };

  return (
    <form onSubmit={save} className="mx-auto max-w-2xl pb-24" noValidate>
      {/* Header: photo + completion */}
      <section className="overflow-hidden rounded-[22px] bg-secondary text-white">
        <div className="relative px-5 pb-5 pt-6">
          <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-primary/25 blur-2xl" />
          <div className="relative flex items-center gap-4">
            <div className="group relative flex-none">
              <button type="button" onClick={() => fileRef.current?.click()} className="relative block rounded-full ring-4 ring-white/20 transition group-hover:ring-primary" aria-label="Change profile photo">
                <Avatar name={form.name || 'G'} src={user?.avatar} size={92} />
                <span className={cx('absolute inset-0 grid place-items-center rounded-full bg-black/50 text-white transition', photoBusy ? 'opacity-100' : 'opacity-0 group-hover:opacity-100')}>{photoBusy ? <Loader2 size={24} className="spin" /> : <Camera size={24} />}</span>
              </button>
              <button type="button" onClick={() => fileRef.current?.click()} className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full bg-primary text-white shadow-pop" aria-label="Upload photo"><Camera size={15} /></button>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => pickPhoto(e.target.files?.[0])} />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-extrabold !text-white">{welcome ? 'Complete your profile' : form.name || 'Your profile'}</h1>
              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-white/75"><Smartphone size={14} />+91 {user?.phone}<span className="ml-1 inline-flex items-center gap-1 rounded-full bg-success/25 px-2 py-0.5 text-[11px] font-bold text-white"><BadgeCheck size={12} />Verified</span></p>
              {user?.avatar && <button type="button" onClick={removePhoto} className="mt-2 text-xs font-semibold text-white/70 underline-offset-2 hover:text-white hover:underline">Remove photo</button>}
            </div>
          </div>
          <div className="relative mt-5">
            <div className="mb-1.5 flex items-center justify-between text-xs font-semibold"><span>Profile {pct}% complete</span>{nextTip ? <span className="text-white/70">Next: {nextTip}</span> : <span className="flex items-center gap-1 text-success"><CheckCircle2 size={13} />All set!</span>}</div>
            <div className="h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-700" style={{ width: `${pct}%` }} /></div>
          </div>
        </div>
      </section>

      {/* Personal details */}
      <section className="card card-pad mt-4 space-y-5">
        <h2 className="flex items-center gap-2 font-extrabold"><UserIcon size={18} className="text-primary" />Personal details</h2>
        <div>
          <label className="field-label" htmlFor="pf-name">Full name</label>
          <div className="relative"><UserIcon size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" /><input id="pf-name" className="input h-12 rounded-full pl-11" autoComplete="name" placeholder="As on your ID" value={form.name} onChange={(e) => set('name', e.target.value)} aria-invalid={Boolean(errors.name)} /></div>
          {errors.name && <p className="field-error animate-fade-up">{errors.name}</p>}
        </div>
        <div>
          <p className="field-label">Gender</p>
          <div className="flex flex-wrap gap-2">{GENDERS.map(([v, l]) => <button key={v} type="button" aria-pressed={form.gender === v} onClick={() => set('gender', form.gender === v ? '' : v)} className={cx('chip h-10 transition', form.gender === v && 'active')}>{l}</button>)}</div>
        </div>
        <div>
          <label className="field-label" htmlFor="pf-dob">Date of birth</label>
          <div className="relative"><Cake size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" /><input id="pf-dob" type="date" max={isoDate(new Date())} className="input h-12 rounded-full pl-11" value={form.dob} onChange={(e) => set('dob', e.target.value)} aria-invalid={Boolean(errors.dob)} /></div>
          {errors.dob ? <p className="field-error animate-fade-up">{errors.dob}</p> : age !== null && <p className="field-hint flex items-center gap-1.5"><Cake size={13} aria-hidden />You’re {age} years old</p>}
        </div>
        <div>
          <label className="field-label" htmlFor="pf-email">Email</label>
          <div className="relative"><Mail size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" /><input id="pf-email" type="email" className="input h-12 rounded-full pl-11" autoComplete="email" placeholder="you@example.com" value={form.email} onChange={(e) => set('email', e.target.value)} aria-invalid={Boolean(errors.email)} /></div>
          {errors.email ? <p className="field-error animate-fade-up">{errors.email}</p> : <p className="field-hint">Booking vouchers and receipts are sent here</p>}
        </div>
      </section>

      {/* Mobile (read-only) */}
      <section className="card card-pad mt-4">
        <h2 className="mb-3 flex items-center gap-2 font-extrabold"><Smartphone size={18} className="text-primary" />Mobile number</h2>
        <div className="flex items-center justify-between gap-3 rounded-full border border-line bg-surface px-5 py-3">
          <span className="flex items-center gap-2 font-semibold"><Lock size={15} className="text-muted" />+91 {user?.phone}</span>
          <span className="inline-flex items-center gap-1 text-xs font-bold text-success"><BadgeCheck size={14} />Verified</span>
        </div>
        <p className="field-hint">Your mobile number is your login. To change it, contact support.</p>
      </section>

      {/* Shortcuts */}
      <section className="mt-4 grid grid-cols-3 gap-3">
        {[['/account/trips', 'My trips', Briefcase], ['/account/saved', 'Saved', Heart], ['/account/travellers', 'Travellers', Users]].map(([to, l, Icon]) => (
          <Link key={to} to={to} className="hover-lift flex flex-col items-center gap-2 rounded-brand-lg border border-line bg-card py-4 text-xs font-bold"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary-soft text-primary"><Icon size={19} /></span>{l}</Link>
        ))}
      </section>

      {/* Save bar — appears when something changed */}
      <div className={cx('sticky bottom-4 z-20 mt-6 transition-all duration-300', dirty || saved ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-6 opacity-0')}>
        <div className="flex items-center gap-2 rounded-full border border-line bg-card p-2 pl-5 shadow-pop">
          <span className="min-w-0 flex-1 whitespace-nowrap text-sm font-semibold">{saved && !dirty ? <span className="flex items-center gap-1.5 text-success"><CheckCircle2 size={16} />All changes saved</span> : 'Unsaved changes'}</span>
          {dirty && <Button type="button" size="sm" variant="ghost" className="rounded-full" onClick={() => { setForm(initial); setErrors({}); }}>Discard</Button>}
          <Button type="submit" size="sm" className="rounded-full px-5" loading={busy} disabled={!dirty}>{welcome ? 'Save & continue' : 'Save'}</Button>
        </div>
      </div>
    </form>
  );
}

const TYPE_ICON = { hotel: BedDouble, bus: Bus, flight: Plane };
export function Trips() {
  const [tab, setTab] = useState('upcoming');
  const { data, loading, error, reload } = useApi(() => api.get('/me/bookings', { tab }), [tab]);
  return (
    <div>
      <h1 className="mb-4 text-xl font-extrabold">My trips</h1>
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'upcoming', label: 'Upcoming' }, { value: 'completed', label: 'Completed' }, { value: 'cancelled', label: 'Cancelled' }]} className="mb-4" />
      <div className="space-y-3">
        {loading && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        {error && <ErrorState error={error} onRetry={reload} />}
        {!loading && !data?.length && <div className="card"><EmptyState icon={Briefcase} title={`No ${tab} trips`} text="When you book, your trips will show up here." action={<Button to="/">Start exploring</Button>} /></div>}
        {data?.map((b) => {
          const Icon = TYPE_ICON[b.type];
          return (
            <Link key={b._id} to={`/booking/${b._id}`} className="card flex items-center gap-4 p-4 transition hover:shadow-card">
              <span className="grid h-12 w-12 flex-none place-items-center rounded-brand bg-primary-soft text-primary"><Icon size={22} /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{b.type === 'hotel' ? b.snapshot?.propertyName : `${b.trip?.from} → ${b.trip?.to}`}</p>
                <p className="text-sm text-muted">{b.type === 'hotel' ? `${dateLabel(b.checkIn)} – ${dateLabel(b.checkOut)} · ${b.snapshot?.city}` : `${dateLabel(b.trip?.departure)} · ${b.trip?.operator || b.trip?.airline}`}</p>
                <p className="text-xs text-muted">{b.bookingCode}</p>
              </div>
              <div className="text-right"><StatusBadge status={b.status} /><p className="mt-1 text-sm font-bold">{money(b.pricing?.totalAmount)}</p></div>
              <ChevronRight size={18} className="text-muted" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}

const EMPTY_T = { fullName: '', gender: '', dob: '', phone: '', email: '', idType: '', idNumber: '' };
export function Travellers() {
  const { data, loading, reload } = useApi(() => api.get('/me/travellers'), []);
  const [edit, setEdit] = useState(null);
  const toast = useToast();
  const save = async () => {
    try {
      if (edit._id) await api.put(`/me/travellers/${edit._id}`, edit); else await api.post('/me/travellers', edit);
      setEdit(null); reload(); toast.success('Traveller saved');
    } catch (e) { toast.error(e); }
  };
  const remove = async (id) => { await api.del(`/me/travellers/${id}`); reload(); };
  return (
    <div>
      <div className="mb-4 flex items-center justify-between"><h1 className="text-xl font-extrabold">Saved travellers</h1><Button size="sm" icon={Plus} onClick={() => setEdit({ ...EMPTY_T })}>Add traveller</Button></div>
      {loading ? <Skeleton className="h-24" /> : !data?.length ? <div className="card"><EmptyState icon={Users} title="No saved travellers" text="Save family & friends to book faster." /></div> : (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.map((t) => (
            <div key={t._id} className="card card-pad flex items-start justify-between gap-3">
              <div><p className="font-bold">{t.fullName}</p><p className="text-sm text-muted">{[titleCase(t.gender || ''), t.dob && dateLabel(t.dob, { day: 'numeric', month: 'short', year: 'numeric' }), t.idType && `${titleCase(t.idType)} ••${t.idNumber?.slice(-4)}`].filter(Boolean).join(' · ')}</p></div>
              <div className="flex gap-1"><button onClick={() => setEdit({ ...t, dob: t.dob?.slice(0, 10) || '' })} className="grid h-8 w-8 place-items-center rounded-full hover:bg-surface" aria-label="Edit"><Pencil size={15} /></button><button onClick={() => remove(t._id)} className="grid h-8 w-8 place-items-center rounded-full text-danger hover:bg-surface" aria-label="Delete"><Trash2 size={15} /></button></div>
            </div>
          ))}
        </div>
      )}
      <Modal open={Boolean(edit)} onClose={() => setEdit(null)} title={edit?._id ? 'Edit traveller' : 'Add traveller'} footer={<Button onClick={save}>Save</Button>}>
        {edit && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Full name (as on ID)" className="sm:col-span-2" value={edit.fullName} onChange={(e) => setEdit({ ...edit, fullName: e.target.value })} />
            <Select label="Gender" placeholder="Select" value={edit.gender} onChange={(e) => setEdit({ ...edit, gender: e.target.value })} options={['male', 'female', 'other']} />
            <Input label="Date of birth" type="date" value={edit.dob} onChange={(e) => setEdit({ ...edit, dob: e.target.value })} />
            <Select label="ID type" placeholder="Select" value={edit.idType} onChange={(e) => setEdit({ ...edit, idType: e.target.value })} options={[{ value: 'aadhaar', label: 'Aadhaar' }, { value: 'passport', label: 'Passport' }, { value: 'pan', label: 'PAN' }, { value: 'driving_licence', label: 'Driving licence' }, { value: 'voter_id', label: 'Voter ID' }]} />
            <Input label="ID number" value={edit.idNumber} onChange={(e) => setEdit({ ...edit, idNumber: e.target.value })} />
          </div>
        )}
      </Modal>
    </div>
  );
}

export function Saved() {
  const { data, loading } = useApi(() => api.get('/me/wishlist'), []);
  return (
    <div>
      <h1 className="mb-4 text-xl font-extrabold">Saved stays</h1>
      {loading ? <Skeleton className="h-48" /> : !data?.length ? <div className="card"><EmptyState icon={Heart} title="Nothing saved yet" text="Tap the heart on any stay to save it here." /></div> : <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">{data.map((p) => <PropertyCard key={p._id} p={p} />)}</div>}
    </div>
  );
}

export function Notifications() {
  const { data, loading, reload } = useApi(() => api.get('/me/notifications'), []);
  return (
    <div>
      <div className="mb-4 flex items-center justify-between"><h1 className="text-xl font-extrabold">Notifications</h1><Button size="sm" variant="outline" onClick={async () => { await api.post('/me/notifications/read'); reload(); }}>Mark all read</Button></div>
      <PushToggle role="user" onMessage={reload} />
      <div className="card divide-y divide-line">
        {loading && <Skeleton className="m-4 h-16" />}
        {!loading && !data?.length && <EmptyState icon={Bell} title="You’re all caught up" />}
        {data?.map((n) => (
          <Link key={n._id} to={n.data?.bookingId ? `/booking/${n.data.bookingId}` : '#'} className={cx('flex gap-3 p-4 hover:bg-surface', !n.read && 'bg-primary-soft/30')}>
            <span className={cx('mt-1.5 h-2 w-2 flex-none rounded-full', n.read ? 'bg-transparent' : 'bg-primary')} />
            <div className="flex-1"><p className="text-sm font-bold">{n.title}</p><p className="text-sm text-muted">{n.body}</p></div>
            <span className="text-xs text-muted">{timeAgo(n.createdAt)}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function Support() {
  const [sp] = useSearchParams();
  const { data, reload } = useApi(() => api.get('/me/support'), []);
  const { data: bookings } = useApi(() => api.get('/me/bookings', { tab: 'upcoming' }), []);
  const [form, setForm] = useState(sp.get('booking') ? { subject: '', message: '', bookingId: sp.get('booking') } : null);
  const [open, setOpen] = useState(null);
  const [reply, setReply] = useState('');
  const toast = useToast();
  const submit = async () => { try { await api.post('/me/support', form); setForm(null); reload(); toast.success('Request submitted — we’ll get back soon'); } catch (e) { toast.error(e); } };
  const sendReply = async () => { const { data: t } = await api.post(`/me/support/${open._id}/reply`, { message: reply }); setOpen(t); setReply(''); reload(); };
  return (
    <div>
      <div className="mb-4 flex items-center justify-between"><h1 className="text-xl font-extrabold">Help &amp; support</h1><Button size="sm" icon={Plus} onClick={() => setForm({ subject: '', message: '', bookingId: '' })}>New request</Button></div>
      <div className="card divide-y divide-line">
        {!data?.length && <EmptyState icon={LifeBuoy} title="No support requests" text="Need help with a booking? Raise a request and our team will respond." />}
        {data?.map((t) => (
          <button key={t._id} onClick={() => setOpen(t)} className="flex w-full items-center gap-3 p-4 text-left hover:bg-surface">
            <div className="flex-1"><p className="font-bold">{t.subject}</p><p className="text-xs text-muted">{t.booking?.bookingCode || 'General'} · updated {timeAgo(t.updatedAt)}</p></div><StatusBadge status={t.status} />
          </button>
        ))}
      </div>
      <Modal open={Boolean(form)} onClose={() => setForm(null)} title="New support request" footer={<Button onClick={submit} disabled={!form?.subject || !form?.message}>Submit</Button>}>
        {form && (
          <div className="space-y-4">
            <Select label="Related booking" placeholder="Not about a booking" value={form.bookingId} onChange={(e) => setForm({ ...form, bookingId: e.target.value })} options={(bookings || []).map((b) => ({ value: b._id, label: `${b.bookingCode} · ${b.snapshot?.propertyName || `${b.trip?.from} → ${b.trip?.to}`}` }))} />
            <Input label="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
            <Textarea label="How can we help?" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
          </div>
        )}
      </Modal>
      <Modal open={Boolean(open)} onClose={() => setOpen(null)} title={open?.subject} footer={open?.status !== 'closed' && <div className="flex w-full gap-2"><input className="input flex-1" value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Write a reply" /><Button icon={Send} onClick={sendReply} disabled={!reply} /></div>}>
        <div className="space-y-3">{open?.messages?.map((m, i) => <div key={i} className={cx('max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm', m.from === 'user' ? 'ml-auto bg-secondary text-white' : 'bg-surface')}><p>{m.text}</p><p className={cx('mt-1 text-[10px]', m.from === 'user' ? 'text-white/60' : 'text-muted')}>{m.from === 'admin' ? 'LexaTrip support · ' : ''}{timeAgo(m.at)}</p></div>)}</div>
        {open && <Badge className="mt-4">{titleCase(open.status)}</Badge>}
      </Modal>
    </div>
  );
}

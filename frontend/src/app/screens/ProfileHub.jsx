import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Briefcase, Heart, Users, Bell, Percent, LifeBuoy, HelpCircle, FileText, ShieldCheck, LogOut, User, Trash2, AlertTriangle, ChevronRight } from 'lucide-react';
import { Avatar, Button, ConfirmDialog } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { useToast } from '@/context/ToastContext';

const Row = ({ to, icon: Icon, label, hint }) => (
  <Link to={to} className="flex items-center gap-3.5 px-4 py-3.5 active:bg-surface">
    <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary-soft text-primary"><Icon size={18} /></span>
    <span className="flex-1"><span className="block text-[15px] font-semibold">{label}</span>{hint && <span className="block text-xs text-muted">{hint}</span>}</span>
    <ChevronRight size={17} className="text-muted" />
  </Link>
);

/** Profile & settings hub (account links, help, legal pages from the admin CMS). */
export default function ProfileHub() {
  const { user, logout } = useAuth();
  const { feature, brand } = useSettings();
  const navigate = useNavigate();
  const toast = useToast();
  const [confirmDel, setConfirmDel] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { data: pages } = useApi(() => api.get('/public/pages'), [], { live: 'content' });
  const legalIcon = { 'terms-and-conditions': FileText, 'privacy-policy': ShieldCheck };

  const signOut = () => { logout('user'); try { sessionStorage.removeItem('lt_splash'); } catch { /* ignore */ } navigate('/app', { replace: true }); };
  const deleteAccount = async () => {
    setDeleting(true);
    try { await api.del('/me/account'); toast.success('Your account has been deleted'); setConfirmDel(false); signOut(); }
    catch (e) { setConfirmDel(false); if (!e.silent) toast.error(e); } finally { setDeleting(false); }
  };

  return (
    <div className="pb-6">
      <Link to={user ? '/account' : '/login'} className="m-4 flex items-center gap-3.5 rounded-brand-lg bg-secondary p-4 text-white">
        <Avatar name={user?.name || 'G'} src={user?.avatar} size={52} />
        <div className="min-w-0 flex-1"><p className="truncate text-lg font-extrabold">{user ? user.name || 'Add your name' : 'Sign in or sign up'}</p><p className="text-sm text-white/70">{user ? `+91 ${user.phone}` : 'Track trips, save stays & book faster'}</p></div>
        <ChevronRight size={18} className="text-white/60" />
      </Link>
      <div className="divide-y divide-line border-y border-line bg-card">
        <Row to="/account/trips" icon={Briefcase} label="My trips" hint="Upcoming, completed & cancelled" />
        {feature('wishlist') && <Row to="/account/saved" icon={Heart} label="Saved stays" />}
        {feature('savedTravellers') && <Row to="/account/travellers" icon={Users} label="Saved travellers" />}
        <Row to="/account/notifications" icon={Bell} label="Notifications" />
        {feature('coupons') && <Row to="/offers" icon={Percent} label="Offers & coupons" />}
      </div>
      <p className="px-4 pb-1 pt-5 text-xs font-bold uppercase tracking-wide text-muted">Help</p>
      <div className="divide-y divide-line border-y border-line bg-card">
        {feature('supportTickets') && <Row to="/account/support" icon={LifeBuoy} label="Help & support" />}
        <Row to="/p/faq" icon={HelpCircle} label="FAQs" />
        {pages?.map((p) => { const I = legalIcon[p.slug] || FileText; return <Row key={p.slug} to={`/p/${p.slug}`} icon={I} label={p.title} />; })}
      </div>
      {user && <div className="mt-5 border-y border-line bg-card"><Row to="/account" icon={User} label="Edit profile" /></div>}
      {user && <div className="px-4 pt-5"><Button variant="outline" block icon={LogOut} className="text-danger" onClick={signOut}>Sign out</Button></div>}
      {user && (
        <div className="mx-4 mt-4 rounded-brand-lg border border-danger/30 bg-danger/5 p-4">
          <p className="flex items-center gap-2 text-sm font-extrabold text-danger"><AlertTriangle size={16} />Danger zone</p>
          <p className="mt-1 text-xs text-muted">Permanently removes your profile, saved stays and travellers. This can’t be undone.</p>
          <button onClick={() => setConfirmDel(true)} className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-danger text-[15px] font-bold text-white shadow-md transition hover:brightness-110 active:scale-[.98]"><Trash2 size={18} />Delete account</button>
        </div>
      )}
      <ConfirmDialog open={confirmDel} onClose={() => setConfirmDel(false)} onConfirm={deleteAccount} loading={deleting} title="Delete your account?" message="This permanently deletes your profile, saved stays and saved travellers. Your past bookings stay on record for invoices. You can’t undo this." confirmLabel="Yes, delete my account" />
      <p className="pt-6 text-center text-xs text-muted">{brand.appName} · v1.0.0</p>
    </div>
  );
}

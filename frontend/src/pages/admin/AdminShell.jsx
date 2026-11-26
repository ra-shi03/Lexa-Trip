import { Navigate, useNavigate } from 'react-router';
import {
  LayoutDashboard, Users, Store, Building2, CalendarDays, CalendarCheck, Receipt, RotateCcw, Wallet, Percent, BarChart3, Layers, MapPin, Tag, Image, FileText,
  HelpCircle, Star, LifeBuoy, Palette, ToggleLeft, Plug, UserCog, ScrollText, Globe, FolderOpen, FileSpreadsheet, Network, ArrowLeftRight, Images, Bot, Settings, Smartphone, LogIn, Globe2,
} from 'lucide-react';
import { PanelLayout } from '../../components/layout/PanelLayout';
import { PanelLogin } from '../../components/panel/PanelLogin';
import { PageLoader } from '../../components/ui';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export function AdminLogin() {
  const { login } = useAuth();
  const toast = useToast();
  // Throws on failure so the form can shake; the toast shows the server's message.
  const submit = async (form) => {
    try {
      const { data } = await api.post('/auth/admin/login', form);
      login('admin', data.token, data.admin);
    } catch (er) { toast.error(er); throw er; }
  };
  return <PanelLogin onSubmit={submit} />;
}

/** Navigation is filtered by the admin's effective permissions (sub-admins never see revenue items). */
export function AdminShell() {
  const { admin, ready, logout, can, isMaster } = useAuth();
  const navigate = useNavigate();
  if (!ready.admin) return <PageLoader />;
  if (!admin) return <Navigate to="/admin/login" replace />;
  const groups = [
    { items: [{ to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true, perm: 'dashboard' }] },
    { section: 'Operations', items: [
      { to: '/admin/bookings', label: 'Bookings', icon: CalendarCheck, perm: 'bookings' },
      { to: '/admin/properties', label: 'Properties', icon: Building2, perm: 'properties' },
      { to: '/admin/inventory', label: 'Inventory', icon: CalendarDays, perm: 'inventory' },
      { to: '/admin/deals', label: 'Deals & offers', icon: Percent, perm: 'inventory' },
      { to: '/admin/vendors', label: 'Vendors', icon: Store, perm: 'vendors' },
      { to: '/admin/users', label: 'Customers', icon: Users, perm: 'users' },
      { to: '/admin/reviews', label: 'Reviews', icon: Star, perm: 'reviews' },
      { to: '/admin/support', label: 'Support', icon: LifeBuoy, perm: 'support' },
      { to: '/admin/ai-conversations', label: 'AI conversations', icon: Bot, perm: 'support' },
    ] },
    { section: 'Revenue', items: [
      { to: '/admin/finance/transactions', label: 'Transactions', icon: Receipt, perm: 'finance' },
      { to: '/admin/finance/refunds', label: 'Refunds', icon: RotateCcw, perm: 'finance' },
      { to: '/admin/finance/payouts', label: 'Vendor payouts', icon: Wallet, perm: 'payouts' },
      { to: '/admin/finance/commission', label: 'Commission rules', icon: Percent, perm: 'commission' },
      { to: '/admin/reports', label: 'Reports', icon: BarChart3, perm: 'revenue_reports' },
    ] },
    { section: 'SEO CMS', items: [
      { to: '/admin/seo', label: 'SEO overview', icon: Globe, perm: 'seo', end: true },
      { to: '/admin/seo/explorer', label: 'Content explorer', icon: FolderOpen, perm: 'seo' },
      { to: '/admin/seo/media', label: 'Media library', icon: Images, perm: 'media' },
      { to: '/admin/seo/import', label: 'Bulk import', icon: FileSpreadsheet, perm: 'seo' },
      { to: '/admin/seo/sitemap', label: 'Sitemap & Search Console', icon: Network, perm: 'seo' },
      { to: '/admin/seo/redirects', label: 'Redirects', icon: ArrowLeftRight, perm: 'seo' },
    ] },
    { section: 'Catalogue & content', items: [
      { to: '/admin/catalog/destinations', label: 'Destinations', icon: MapPin, perm: 'catalog' },
      { to: '/admin/catalog/categories', label: 'Categories', icon: Layers, perm: 'catalog' },
      { to: '/admin/catalog/amenities', label: 'Amenities', icon: Tag, perm: 'catalog' },
      { to: '/admin/coupons', label: 'Coupons', icon: Percent, perm: 'coupons' },
      { to: '/admin/banners', label: 'Banners', icon: Image, perm: 'content' },
      { to: '/admin/pages', label: 'Static pages', icon: FileText, perm: 'content' },
      { to: '/admin/faqs', label: 'FAQs', icon: HelpCircle, perm: 'content' },
    ] },
    { section: 'Settings', items: [
      { to: '/admin/settings/appearance', label: 'Theme & branding', icon: Palette, perm: 'appearance' },
      { to: '/admin/settings/home', label: 'Home page content', icon: Image, perm: 'appearance' },
      { to: '/admin/settings/login-page', label: 'Login page', icon: LogIn, perm: 'appearance' },
      { to: '/admin/settings/mobile-app', label: 'Mobile app', icon: Smartphone, perm: 'appearance' },
      { to: '/admin/settings/features', label: 'App features', icon: ToggleLeft, perm: 'appearance' },
      { to: '/admin/settings/integrations', label: 'Integrations', icon: Plug, perm: 'integrations' },
      { to: '/admin/settings/business', label: 'Tax & commission', icon: Settings, perm: 'finance' },
      { to: '/admin/settings/region', label: 'Region & time', icon: Globe2, master: true },
      { to: '/admin/subadmins', label: 'Sub-admins', icon: UserCog, master: true },
      { to: '/admin/audit', label: 'Audit log', icon: ScrollText, master: true },
    ] },
  ];
  const nav = groups.map((g) => ({ ...g, items: g.items.filter((i) => (i.master ? isMaster : can(i.perm))) })).filter((g) => g.items.length);
  return <PanelLayout nav={nav} account={admin} roleLabel={isMaster ? 'Admin' : 'Sub-admin'} homeTo="/admin" notificationsTo="/admin/notifications" onLogout={() => { logout('admin'); navigate('/admin/login'); }} />;
}

/** Route-level permission guard */
export function RequirePerm({ perm, master, children }) {
  const { can, isMaster } = useAuth();
  if ((master && !isMaster) || (perm && !can(perm))) {
    return <div className="card card-pad text-center"><h2 className="text-lg font-bold">Access restricted</h2><p className="mt-1 text-sm text-muted">{master || ['finance', 'payouts', 'commission', 'revenue_reports'].includes(perm) ? 'This area is limited to the master admin.' : 'You don’t have permission to view this page.'}</p></div>;
  }
  return children;
}

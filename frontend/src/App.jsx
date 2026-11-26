import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { UserLayout } from './components/layout/UserLayout';
import { PageLoader } from './components/ui';
import { Protected, GuestOnly } from './components/auth/Protected';
import { SwitchMode, OpenApp } from './components/auth/SwitchMode';
import { useSettings } from './context/SettingsContext';
import Home from './pages/user/Home';
import Search from './pages/user/Search';
import PropertyDetail from './pages/user/PropertyDetail';
import { StaticPage, Offers, NotFound } from './pages/user/Misc';

// Guest flows that are not on the first screen
const Checkout = lazy(() => import('./pages/user/Checkout'));
const BookingDetail = lazy(() => import('./pages/user/BookingDetail'));
const AiPage = lazy(() => import('./pages/user/AiPage'));
const BusSearchPage = lazy(() => import('./pages/user/Bus').then((m) => ({ default: m.BusSearchPage })));
const BusSeatsPage = lazy(() => import('./pages/user/Bus').then((m) => ({ default: m.BusSeatsPage })));
const FlightsPage = lazy(() => import('./pages/user/Flights').then((m) => ({ default: m.FlightsPage })));
const FlightBookPage = lazy(() => import('./pages/user/Flights').then((m) => ({ default: m.FlightBookPage })));
const acc = (name) => lazy(() => import('./pages/user/account/Account').then((m) => ({ default: m[name] })));
const AccountLayout = acc('AccountLayout');
const Profile = acc('Profile');
const Trips = acc('Trips');
const Travellers = acc('Travellers');
const Saved = acc('Saved');
const Notifications = acc('Notifications');
const Support = acc('Support');

// Vendor panel (separate chunk)
const v = (name) => lazy(() => import('./pages/vendor/Vendor').then((m) => ({ default: m[name] })));
const VendorAuth = v('VendorAuth');
const VendorShell = v('VendorShell');
const VendorDashboard = v('VendorDashboard');
const VendorProperties = v('VendorProperties');
const VendorPropertyEdit = v('VendorPropertyEdit');
const VendorInventory = v('VendorInventory');
const VendorDeals = v('VendorDeals');
const VendorBookings = v('VendorBookings');
const VendorEarnings = v('VendorEarnings');
const VendorReports = v('VendorReports');
const VendorProfile = v('VendorProfile');
const PanelNotifications = v('PanelNotifications');

// Admin panel (separate chunks)
const mod = (loader, name) => lazy(() => loader().then((m) => ({ default: name ? m[name] : m.default })));
const shell = () => import('./pages/admin/AdminShell');
const AdminLogin = mod(shell, 'AdminLogin');
const AdminShell = mod(shell, 'AdminShell');
const AdminDashboard = mod(() => import('./pages/admin/Dashboard'));
const people = () => import('./pages/admin/People');
const ops = () => import('./pages/admin/Operations');
const res = () => import('./pages/admin/Resources');
const settings = () => import('./pages/admin/settings/Settings');
const seoHome = () => import('./pages/admin/seo/SeoHome');
const seoEd = () => import('./pages/admin/seo/Editors');
const seoTools = () => import('./pages/admin/seo/SeoTools');

const A = {
  Users: mod(people, 'UsersPage'), Vendors: mod(people, 'VendorsPage'), VendorDetail: mod(people, 'VendorDetailPage'), Properties: mod(people, 'PropertiesPage'), Subadmins: mod(people, 'SubadminsPage'), Audit: mod(people, 'AuditPage'),
  Bookings: mod(ops, 'AdminBookings'), Inventory: mod(ops, 'AdminInventory'), Deals: mod(ops, 'AdminDeals'), PropertyEdit: mod(ops, 'AdminPropertyEdit'), Reviews: mod(ops, 'ReviewsPage'), Support: mod(ops, 'SupportPage'), AiLogs: mod(ops, 'AiConversationsPage'),
  Transactions: mod(ops, 'TransactionsPage'), Refunds: mod(ops, 'RefundsPage'), Payouts: mod(ops, 'PayoutsPage'), Reports: mod(ops, 'AdminReports'),
  Categories: mod(res, 'Categories'), Amenities: mod(res, 'Amenities'), Coupons: mod(res, 'Coupons'), Banners: mod(res, 'Banners'), Pages: mod(res, 'Pages'), Faqs: mod(res, 'Faqs'), Commission: mod(res, 'CommissionRules'),
  Appearance: mod(settings, 'AppearanceSettings'), HomeContent: mod(settings, 'HomeContentSettings'), MobileApp: mod(settings, 'MobileAppSettings'), Region: mod(settings, 'RegionSettings'), LoginPage: mod(settings, 'LoginPageSettings'), Features: mod(settings, 'FeatureSettings'), Integrations: mod(settings, 'IntegrationSettings'), Business: mod(settings, 'BusinessSettings'),
  SeoOverview: mod(seoHome, 'SeoOverview'), SeoExplorer: mod(seoHome, 'SeoExplorer'),
  HotelEditor: mod(seoEd, 'HotelEditor'), ItineraryEditor: mod(seoEd, 'ItineraryEditor'), ArticleEditor: mod(seoEd, 'ArticleEditor'), NodeEditor: mod(seoEd, 'NodeEditor'),
  Media: mod(seoTools, 'MediaLibrary'), Import: mod(seoTools, 'BulkImport'), Sitemap: mod(seoTools, 'SitemapPage'), Redirects: mod(seoTools, 'RedirectsPage'), Destinations: mod(seoTools, 'DestinationsPage'),
};

const S = (el) => <Suspense fallback={<PageLoader />}>{el}</Suspense>;

const RequireUser = ({ children }) => <Protected role="user">{children}</Protected>;

/** Hides a service route when the master admin disables it */
function Feature({ name, children }) {
  const { feature, loading } = useSettings();
  if (loading) return <PageLoader />;
  return feature(name) ? children : <NotFound />;
}

const P = (perm, el, master) => S(<Protected role="admin" perm={perm} master={master}>{el}</Protected>);

const router = createBrowserRouter([
  { path: '/login', element: <OpenApp /> }, // the website has no login/sign-up page: customers continue in the app
  {
    element: <UserLayout />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/search', element: <Feature name="hotels"><Search /></Feature> },
      { path: '/stay/:slug', element: <Feature name="hotels"><PropertyDetail /></Feature> },
      { path: '/checkout', element: <RequireUser>{S(<Checkout />)}</RequireUser> },
      { path: '/booking/:id', element: <RequireUser>{S(<BookingDetail />)}</RequireUser> },
      { path: '/bus', element: <Feature name="buses">{S(<BusSearchPage />)}</Feature> },
      { path: '/bus/:tripId', element: <Feature name="buses">{S(<BusSeatsPage />)}</Feature> },
      { path: '/flights', element: <Feature name="flights">{S(<FlightsPage />)}</Feature> },
      { path: '/flights/book', element: <Feature name="flights">{S(<FlightBookPage />)}</Feature> },
      { path: '/ai', element: S(<AiPage />) },
      { path: '/app', element: <SwitchMode to="app" /> },
      { path: '/offers', element: <Offers /> },
      { path: '/p/:slug', element: <StaticPage /> },
      {
        path: '/account',
        element: <RequireUser>{S(<AccountLayout />)}</RequireUser>,
        children: [
          { index: true, element: S(<Profile />) },
          { path: 'trips', element: S(<Trips />) },
          { path: 'travellers', element: S(<Travellers />) },
          { path: 'saved', element: S(<Saved />) },
          { path: 'notifications', element: S(<Notifications />) },
          { path: 'support', element: S(<Support />) },
        ],
      },
      { path: '*', element: <NotFound /> },
    ],
  },
  { path: '/vendor/login', element: S(<GuestOnly role="vendor" to="/vendor"><VendorAuth mode="login" /></GuestOnly>) },
  { path: '/vendor/register', element: S(<GuestOnly role="vendor" to="/vendor"><VendorAuth mode="register" /></GuestOnly>) },
  {
    path: '/vendor',
    element: S(<Protected role="vendor"><VendorShell /></Protected>),
    children: [
      { index: true, element: S(<VendorDashboard />) },
      { path: 'properties', element: S(<VendorProperties />) },
      { path: 'properties/:id', element: S(<VendorPropertyEdit />) },
      { path: 'inventory', element: S(<VendorInventory />) },
      { path: 'deals', element: S(<VendorDeals />) },
      { path: 'bookings', element: S(<VendorBookings />) },
      { path: 'earnings', element: S(<VendorEarnings />) },
      { path: 'reports', element: S(<VendorReports />) },
      { path: 'profile', element: S(<VendorProfile />) },
      { path: 'notifications', element: S(<PanelNotifications endpoint="/vendor/notifications" />) },
    ],
  },
  { path: '/admin/login', element: S(<GuestOnly role="admin" to="/admin"><AdminLogin /></GuestOnly>) },
  {
    path: '/admin',
    element: S(<Protected role="admin"><AdminShell /></Protected>),
    children: [
      { index: true, element: P('dashboard', <AdminDashboard />) },
      { path: 'users', element: P('users', <A.Users />) },
      { path: 'vendors', element: P('vendors', <A.Vendors />) },
      { path: 'vendors/:id', element: P('vendors', <A.VendorDetail />) },
      { path: 'properties', element: P('properties', <A.Properties />) },
      { path: 'properties/:id', element: P('properties', <A.PropertyEdit />) },
      { path: 'inventory', element: P('inventory', <A.Inventory />) },
      { path: 'deals', element: P('inventory', <A.Deals />) },
      { path: 'bookings', element: P('bookings', <A.Bookings />) },
      { path: 'reviews', element: P('reviews', <A.Reviews />) },
      { path: 'support', element: P('support', <A.Support />) },
      { path: 'ai-conversations', element: P('support', <A.AiLogs />) },
      { path: 'notifications', element: S(<PanelNotifications endpoint="/admin/notifications" />) },
      { path: 'finance/transactions', element: P('finance', <A.Transactions />) },
      { path: 'finance/refunds', element: P('finance', <A.Refunds />) },
      { path: 'finance/payouts', element: P('payouts', <A.Payouts />) },
      { path: 'finance/commission', element: P('commission', <A.Commission />) },
      { path: 'reports', element: P('revenue_reports', <A.Reports />) },
      { path: 'catalog/destinations', element: P('catalog', <A.Destinations />) },
      { path: 'catalog/categories', element: P('catalog', <A.Categories />) },
      { path: 'catalog/amenities', element: P('catalog', <A.Amenities />) },
      { path: 'coupons', element: P('coupons', <A.Coupons />) },
      { path: 'banners', element: P('content', <A.Banners />) },
      { path: 'pages', element: P('content', <A.Pages />) },
      { path: 'faqs', element: P('content', <A.Faqs />) },
      { path: 'settings/appearance', element: P('appearance', <A.Appearance />) },
      { path: 'settings/home', element: P('appearance', <A.HomeContent />) },
      { path: 'settings/login-page', element: P('appearance', <A.LoginPage />) },
      { path: 'settings/mobile-app', element: P('appearance', <A.MobileApp />) },
      { path: 'settings/features', element: P('appearance', <A.Features />) },
      { path: 'settings/integrations', element: P('integrations', <A.Integrations />) },
      { path: 'settings/business', element: P('finance', <A.Business />) },
      { path: 'settings/region', element: P(null, <A.Region />, true) }, // master admin only
      { path: 'subadmins', element: P(null, <A.Subadmins />, true) },
      { path: 'audit', element: P(null, <A.Audit />, true) },
      { path: 'seo', element: P('seo', <A.SeoOverview />) },
      { path: 'seo/explorer', element: P('seo', <A.SeoExplorer />) },
      { path: 'seo/hotels/:id', element: P('seo', <A.HotelEditor />) },
      { path: 'seo/itineraries/:id', element: P('seo', <A.ItineraryEditor />) },
      { path: 'seo/articles/:id', element: P('seo', <A.ArticleEditor />) },
      { path: 'seo/locations/:type/:id', element: P('seo', <A.NodeEditor />) },
      { path: 'seo/media', element: P('media', <A.Media />) },
      { path: 'seo/import', element: P('seo', <A.Import />) },
      { path: 'seo/sitemap', element: P('seo', <A.Sitemap />) },
      { path: 'seo/redirects', element: P('seo', <A.Redirects />) },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}

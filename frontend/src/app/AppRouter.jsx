import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router';
import { AppShell } from './AppShell';
import Splash from './screens/Splash';
import Onboarding from './screens/Onboarding';
import AppHome from './screens/AppHome';
import ProfileHub from './screens/ProfileHub';
import { PageLoader } from '@/components/ui';
import { Protected, GuestOnly } from '@/components/auth/Protected';
import { useSettings } from '@/context/SettingsContext';
import Search from './screens/Search';
import PropertyDetail from './screens/PropertyDetail';
import Login from './screens/Login';
import { StaticPage, Offers, NotFound } from './screens/Misc';

// Every screen lives in app/screens (separate from the website's pages/); only API, settings, auth and UI primitives are shared
const Checkout = lazy(() => import('./screens/Checkout'));
const BookingDetail = lazy(() => import('./screens/BookingDetail'));
const AiPage = lazy(() => import('./screens/AiPage'));
const BusSearchPage = lazy(() => import('./screens/Bus').then((m) => ({ default: m.BusSearchPage })));
const BusSeatsPage = lazy(() => import('./screens/Bus').then((m) => ({ default: m.BusSeatsPage })));
const FlightsPage = lazy(() => import('./screens/Flights').then((m) => ({ default: m.FlightsPage })));
const FlightBookPage = lazy(() => import('./screens/Flights').then((m) => ({ default: m.FlightBookPage })));
const acc = (n) => lazy(() => import('./screens/account/Account').then((m) => ({ default: m[n] })));
const Profile = acc('Profile'); const Trips = acc('Trips'); const Travellers = acc('Travellers'); const Saved = acc('Saved'); const Notifications = acc('Notifications'); const Support = acc('Support');

const S = (el) => <Suspense fallback={<PageLoader />}>{el}</Suspense>;
const Pad = ({ children }) => <div className="px-4 py-4">{children}</div>;
const Authed = ({ children }) => <Protected role="user">{S(children)}</Protected>;
function Feature({ name, children }) {
  const { feature, loading } = useSettings();
  if (loading) return <PageLoader />;
  return feature(name) ? S(children) : <NotFound />;
}

const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/app" replace /> }, // the app always launches at /app
  { path: '/app', element: <Splash /> },
  { path: '/onboarding', element: <Onboarding /> },
  { path: '/login', element: <GuestOnly role="user" to="/home"><Login /></GuestOnly> }, // after a successful login → /home
  {
    element: <Protected role="user"><AppShell /></Protected>, // the app requires sign-in: everything after login lives here
    children: [
      { path: '/home', element: <AppHome /> },
      { path: '/search', element: <Feature name="hotels"><Search /></Feature> },
      { path: '/stay/:slug', element: <Feature name="hotels"><PropertyDetail /></Feature> },
      { path: '/checkout', element: <Authed><Checkout /></Authed> },
      { path: '/booking/:id', element: <Authed><BookingDetail /></Authed> },
      { path: '/bus', element: <Feature name="buses"><BusSearchPage /></Feature> },
      { path: '/bus/:tripId', element: <Feature name="buses"><BusSeatsPage /></Feature> },
      { path: '/flights', element: <Feature name="flights"><FlightsPage /></Feature> },
      { path: '/flights/book', element: <Feature name="flights"><FlightBookPage /></Feature> },
      { path: '/ai', element: S(<AiPage />) },
      { path: '/offers', element: <Offers /> },
      { path: '/p/:slug', element: <StaticPage /> },
      { path: '/profile', element: <ProfileHub /> },
      { path: '/menu', element: <Navigate to="/profile" replace /> }, // old address
      { path: '/account', element: <Authed><Pad><Profile /></Pad></Authed> },
      { path: '/account/trips', element: <Authed><Pad><Trips /></Pad></Authed> },
      { path: '/account/travellers', element: <Authed><Pad><Travellers /></Pad></Authed> },
      { path: '/account/saved', element: <Authed><Pad><Saved /></Pad></Authed> },
      { path: '/account/notifications', element: <Authed><Pad><Notifications /></Pad></Authed> },
      { path: '/account/support', element: <Authed><Pad><Support /></Pad></Authed> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);

export default function AppRouter() { return <RouterProvider router={router} />; }

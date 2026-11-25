import { useEffect } from 'react';
import { PageLoader } from '../ui';
import { switchMode } from '../../lib/mode';

/** /app → open the customer app experience; /web → back to the website experience */
export function SwitchMode({ to }) {
  useEffect(() => { switchMode(to); }, [to]);
  return <PageLoader label={to === 'app' ? 'Opening the app…' : 'Opening the website…'} />;
}

/** Website → customer app. Login and sign-up live only in the app (/app), so any website "/login" hands over to it. */
export function OpenApp() {
  useEffect(() => { window.location.replace('/app'); }, []);
  return <PageLoader label="Opening the LexaTrip app…" />;
}

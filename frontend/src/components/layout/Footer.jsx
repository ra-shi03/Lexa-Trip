import { Link } from 'react-router';
import { Mail, Phone } from 'lucide-react';
import { Logo } from './Logo';
import { useSettings } from '../../context/SettingsContext';
import { useApi } from '../../hooks/useApi';
import { api } from '../../lib/api';

import { platformParts } from '../../lib/format';
export function Footer() {
  const { brand, feature } = useSettings();
  const { data: pages } = useApi(() => api.get('/public/pages'), [], { live: 'content' });
  return (
    <footer className="mt-16 border-t border-line bg-surface pb-24 md:pb-0">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-sm text-muted">{brand.tagline} Hotels, villas, resorts, buses and flights across India.</p>
          <div className="mt-4 space-y-1.5 text-sm text-muted">
            {brand.supportEmail && <a href={`mailto:${brand.supportEmail}`} className="flex items-center gap-2 hover:text-ink"><Mail size={15} />{brand.supportEmail}</a>}
            {brand.supportPhone && <a href={`tel:${brand.supportPhone}`} className="flex items-center gap-2 hover:text-ink"><Phone size={15} />{brand.supportPhone}</a>}
          </div>
        </div>
        <FooterCol title="Book">
          {feature('hotels') && <Link to="/search">Hotels & stays</Link>}
          {feature('buses') && <Link to="/bus">Bus tickets</Link>}
          {feature('flights') && <Link to="/flights">Flights</Link>}
          <Link to="/offers">Offers</Link>
        </FooterCol>
        <FooterCol title="Help">
          <Link to="/p/faq">FAQs</Link>
          <Link to="/account/support">Support</Link>
          {pages?.filter((p) => ['contact-us', 'about-us', 'cancellation-policy'].includes(p.slug)).map((p) => <Link key={p.slug} to={`/p/${p.slug}`}>{p.title}</Link>)}
        </FooterCol>
        <FooterCol title="Partners & legal">
          <Link to="/vendor/register">List your property</Link>
          {pages?.filter((p) => ['terms-and-conditions', 'privacy-policy'].includes(p.slug)).map((p) => <Link key={p.slug} to={`/p/${p.slug}`}>{p.title}</Link>)}
        </FooterCol>
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-7xl px-4 py-5 text-xs text-muted sm:px-6">© {platformParts().year} {brand.appName}. All rights reserved.</p>
      </div>
    </footer>
  );
}

function FooterCol({ title, children }) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-bold">{title}</h3>
      <div className="flex flex-col gap-2 text-sm text-muted [&_a:hover]:text-ink">{children}</div>
    </div>
  );
}

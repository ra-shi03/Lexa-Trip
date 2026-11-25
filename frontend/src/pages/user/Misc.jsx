import { Link, useParams } from 'react-router';
import { Copy, Compass } from 'lucide-react';
import { Container } from '../../components/layout/UserLayout';
import { PageLoader, ErrorState, EmptyState, Button, Badge } from '../../components/ui';
import { useApi } from '../../hooks/useApi';
import { api } from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import { money, dateLabel, titleCase } from '../../lib/format';

export function StaticPage() {
  const { slug } = useParams();
  const isFaq = slug === 'faq';
  const { data, loading, error } = useApi(() => (isFaq ? api.get('/public/faqs') : api.get(`/public/pages/${slug}`)), [slug]);
  if (loading) return <PageLoader />;
  if (error) return <Container className="py-16"><ErrorState error={error} /></Container>;
  if (isFaq) {
    const groups = data.reduce((acc, f) => ({ ...acc, [f.category]: [...(acc[f.category] || []), f] }), {});
    return (
      <Container className="max-w-3xl py-10">
        <title>FAQs | LexaTrip</title>
        <h1 className="text-3xl font-extrabold">Frequently asked questions</h1>
        {Object.entries(groups).map(([cat, items]) => (
          <section key={cat} className="mt-8">
            <h2 className="mb-3 text-lg font-bold">{titleCase(cat)}</h2>
            <div className="space-y-2">{items.map((f) => <details key={f._id} className="card group px-5 py-4"><summary className="cursor-pointer list-none font-semibold">{f.question}</summary><p className="mt-2 text-sm text-muted">{f.answer}</p></details>)}</div>
          </section>
        ))}
      </Container>
    );
  }
  return (
    <Container className="max-w-3xl py-10">
      <title>{`${data.metaTitle || data.title} | LexaTrip`}</title>
      {data.metaDescription && <meta name="description" content={data.metaDescription} />}
      <h1 className="text-3xl font-extrabold">{data.title}</h1>
      <div className="prose-lt mt-6" dangerouslySetInnerHTML={{ __html: data.content }} />
    </Container>
  );
}

export function Offers() {
  const { data, loading } = useApi(() => api.get('/public/offers'), []);
  const toast = useToast();
  return (
    <Container className="py-10">
      <title>Offers | LexaTrip</title>
      <h1 className="text-3xl font-extrabold">Offers &amp; coupons</h1>
      <p className="mt-1 text-muted">Apply these codes at checkout.</p>
      {loading ? <PageLoader /> : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data?.map((o) => (
            <div key={o._id} className="card card-pad flex flex-col">
              <div className="flex flex-wrap gap-1.5">{o.services.map((s) => <Badge key={s} tone="primary">{titleCase(s)}</Badge>)}</div>
              <p className="mt-3 text-lg font-extrabold">{o.title}</p>
              <p className="mt-1 flex-1 text-sm text-muted">{o.description}</p>
              <p className="mt-2 text-xs text-muted">{o.minAmount ? `Min. booking ${money(o.minAmount)}` : ''}{o.validTo ? ` · valid till ${dateLabel(o.validTo)}` : ''}</p>
              <button onClick={() => { navigator.clipboard?.writeText(o.code); toast.success('Code copied'); }} className="mt-4 flex items-center justify-between rounded-brand border border-dashed border-primary bg-primary-soft px-4 py-2.5 font-bold tracking-wider text-primary">{o.code}<Copy size={15} /></button>
            </div>
          ))}
          {!data?.length && <EmptyState title="No offers right now" />}
        </div>
      )}
    </Container>
  );
}

export function NotFound() {
  return (
    <Container className="py-20">
      <title>Page not found | LexaTrip</title>
      <EmptyState icon={Compass} title="Looks like you’re lost" text="The page you’re looking for doesn’t exist." action={<div className="flex gap-2"><Button to="/">Go home</Button><Link to="/search" className="btn btn-outline">Explore stays</Link></div>} />
    </Container>
  );
}

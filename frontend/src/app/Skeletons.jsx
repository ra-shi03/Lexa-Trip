import { useLocation } from 'react-router';
import { Skeleton } from '@/components/ui';
import { cx } from '@/lib/format';

/**
 * Screen-shaped loading placeholders for the guest app (shimmer from `.skeleton` in components.css).
 * Each mirrors the real screen's layout so content "fills in" instead of jumping in after a spinner.
 * Purely decorative → aria-hidden; one visually-hidden status line announces the wait to screen readers.
 */
const Busy = ({ label = 'Loading' }) => <span role="status" className="sr-only">{label}…</span>;
const n = (k) => Array.from({ length: k }, (_, i) => i);

export function SkeletonText({ lines = 3, className }) {
  return (
    <div className={cx('space-y-2', className)} aria-hidden="true">
      {n(lines).map((i) => <Skeleton key={i} className={cx('h-3.5', i === lines - 1 ? 'w-3/5' : 'w-full')} />)}
    </div>
  );
}

/** Mirrors <PropertyCard>: 4:3 photo, name + rating, city line, price */
export function PropertyCardSkeleton({ className }) {
  return (
    <div className={className} aria-hidden="true">
      <Skeleton className="aspect-[4/3] w-full rounded-brand-lg" />
      <div className="mt-3 flex items-center justify-between gap-3"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-4 w-8" /></div>
      <Skeleton className="mt-2 h-3 w-1/2" />
      <Skeleton className="mt-2 h-3.5 w-1/3" />
    </div>
  );
}

/** Mirrors <PropertyRow> on phone width: photo on top, details, price row */
export function PropertyRowSkeleton() {
  return (
    <div className="card overflow-hidden" aria-hidden="true">
      <Skeleton className="h-52 w-full rounded-none" />
      <div className="space-y-2.5 p-4">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <div className="flex gap-1.5 pt-1">{n(3).map((i) => <Skeleton key={i} className="h-6 w-16 rounded-full" />)}</div>
      </div>
      <div className="flex items-end justify-between border-t border-line p-4">
        <div className="space-y-1.5"><Skeleton className="h-6 w-24" /><Skeleton className="h-3 w-16" /></div>
        <Skeleton className="h-10 w-28 rounded-full" />
      </div>
    </div>
  );
}

/** Explore (before the screen mounts): search pill, filter chips, result cards */
export function SearchSkeleton() {
  return (
    <div className="space-y-4 px-4 py-4">
      <Busy label="Loading stays" />
      <div aria-hidden="true" className="space-y-4">
        <Skeleton className="h-12 w-full rounded-full" />
        <div className="flex gap-2 overflow-hidden">{n(4).map((i) => <Skeleton key={i} className="h-9 w-24 flex-none rounded-full" />)}</div>
        {n(2).map((i) => <PropertyRowSkeleton key={i} />)}
      </div>
    </div>
  );
}

/** Trip / booking card in My trips */
export function TripCardSkeleton() {
  return (
    <div className="card flex gap-3 p-4" aria-hidden="true">
      <Skeleton className="h-16 w-16 flex-none rounded-xl" />
      <div className="min-w-0 flex-1 space-y-2"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-3 w-1/2" /><Skeleton className="h-3 w-1/3" /></div>
      <Skeleton className="h-6 w-16 flex-none rounded-full" />
    </div>
  );
}

/** One row of a divided list (notifications, travellers) */
export function ListRowSkeleton({ avatar }) {
  return (
    <div className="flex items-center gap-3 p-4" aria-hidden="true">
      {avatar ? <Skeleton className="h-10 w-10 flex-none rounded-full" /> : <Skeleton className="h-2 w-2 flex-none rounded-full" />}
      <div className="flex-1 space-y-2"><Skeleton className="h-3.5 w-1/2" /><Skeleton className="h-3 w-4/5" /></div>
      <Skeleton className="h-3 w-10 flex-none" />
    </div>
  );
}

export function ListSkeleton({ rows = 4, avatar }) {
  return <div className="card divide-y divide-line"><Busy />{n(rows).map((i) => <ListRowSkeleton key={i} avatar={avatar} />)}</div>;
}

/** Home: hero + search, quick services, categories, offers, destinations, featured */
export function HomeSkeleton({ withHero = true, tiles = 4 }) {
  return (
    <div className="pb-6">
      <Busy label="Loading home" />
      {withHero && (
        <div className="rounded-b-[32px] bg-secondary px-4 pb-6 pt-11" aria-hidden="true">
          <div className="flex items-center gap-3"><span className="skeleton-dark h-[46px] w-[46px] rounded-full" /><div className="space-y-1.5"><span className="skeleton-dark block h-3 w-24" /><span className="skeleton-dark block h-3.5 w-20" /></div></div>
          <span className="skeleton-dark mt-8 block h-7 w-48" />
          <span className="skeleton-dark mt-2 block h-3.5 w-64" />
          <span className="mt-5 block h-[52px] rounded-full bg-white/90" />
        </div>
      )}
      {tiles > 0 && <QuickServicesSkeleton count={tiles} />}
      <div className="pt-7" aria-hidden="true">
        <Skeleton className="mx-4 mb-3 h-5 w-36" />
        <div className="flex gap-3 overflow-hidden px-4">{n(5).map((i) => <div key={i} className="flex w-[92px] flex-none flex-col items-center gap-2"><Skeleton className="h-[72px] w-[72px] rounded-2xl" /><Skeleton className="h-3 w-14" /></div>)}</div>
      </div>
      <div className="pt-7" aria-hidden="true">
        <Skeleton className="mx-4 mb-3 h-5 w-32" />
        <div className="flex gap-3 overflow-hidden px-4"><Skeleton className="h-40 w-[280px] flex-none rounded-brand-lg" /><Skeleton className="h-40 w-[230px] flex-none rounded-brand-lg" /></div>
      </div>
      <DestinationsSkeleton />
    </div>
  );
}

export function QuickServicesSkeleton({ count = 4 }) {
  return (
    <div className="grid gap-2.5 px-4 pt-5" style={{ gridTemplateColumns: `repeat(${Math.min(count, 4)}, 1fr)` }} aria-hidden="true">
      {n(count).map((i) => <div key={i} className="flex flex-col items-center gap-2 rounded-brand-lg border border-line bg-card py-3.5"><Skeleton className="h-11 w-11 rounded-2xl" /><Skeleton className="h-3 w-12" /></div>)}
    </div>
  );
}

export function DestinationsSkeleton() {
  return (
    <div className="pt-7" aria-hidden="true">
      <Skeleton className="mx-4 mb-3 h-5 w-44" />
      <div className="flex gap-3 overflow-hidden px-4">{n(3).map((i) => <Skeleton key={i} className="h-52 w-40 flex-none rounded-brand-lg" />)}</div>
    </div>
  );
}

/** Stay details: gallery, title block, highlights, rooms */
export function PropertyDetailSkeleton() {
  return (
    <div className="pb-12">
      <Busy label="Loading stay" />
      <div aria-hidden="true">
        <Skeleton className="aspect-[4/3] w-full rounded-none" />
        <div className="space-y-3 px-4 pt-5">
          <div className="flex gap-2"><Skeleton className="h-6 w-20 rounded-full" /><Skeleton className="h-6 w-24" /></div>
          <Skeleton className="h-7 w-4/5" />
          <Skeleton className="h-3.5 w-3/5" />
          <Skeleton className="h-7 w-28 rounded-full" />
        </div>
        <div className="flex gap-2 overflow-hidden px-4 pt-5">{n(4).map((i) => <Skeleton key={i} className="h-9 w-24 flex-none rounded-full" />)}</div>
        <div className="px-4 pt-6"><SkeletonText lines={4} /></div>
        <div className="space-y-3 px-4 pt-7">
          <Skeleton className="h-5 w-40" />
          {n(2).map((i) => (
            <div key={i} className="card flex gap-3 p-3"><Skeleton className="h-24 w-28 flex-none rounded-xl" /><div className="flex-1 space-y-2 pt-1"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/2" /><Skeleton className="mt-3 h-9 w-24 rounded-full" /></div></div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Booking voucher: status banner, summary card, guest + payment cards */
export function BookingSkeleton() {
  return (
    <div className="space-y-4 px-4 py-6">
      <Busy label="Loading booking" />
      <div aria-hidden="true" className="space-y-4">
        <Skeleton className="h-4 w-24" />
        <div className="card space-y-3 p-5"><div className="flex justify-between"><Skeleton className="h-5 w-32" /><Skeleton className="h-6 w-24 rounded-full" /></div><Skeleton className="h-3.5 w-2/3" /><Skeleton className="h-3.5 w-1/2" /></div>
        <div className="card flex gap-3 p-4"><Skeleton className="h-20 w-24 flex-none rounded-xl" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/2" /><Skeleton className="h-3 w-2/5" /></div></div>
        <div className="card space-y-3 p-5">{n(4).map((i) => <div key={i} className="flex justify-between"><Skeleton className="h-3.5 w-28" /><Skeleton className="h-3.5 w-16" /></div>)}</div>
      </div>
    </div>
  );
}

/** Bus seat map: header, stepper, deck grid */
export function SeatMapSkeleton() {
  return (
    <div className="px-4 py-6">
      <Busy label="Loading seats" />
      <div aria-hidden="true">
        <Skeleton className="h-6 w-40" /><Skeleton className="mt-2 h-3.5 w-64" />
        <div className="mt-5 grid grid-cols-3 gap-2">{n(3).map((i) => <Skeleton key={i} className="h-1.5 rounded-full" />)}</div>
        <div className="card mt-5 p-5">
          <div className="mb-4 flex justify-between"><Skeleton className="h-4 w-20" /><Skeleton className="h-8 w-8 rounded-full" /></div>
          <div className="grid grid-cols-[1fr_1fr_0.6fr_1fr] gap-2.5">{n(32).map((i) => (i % 4 === 2 ? <span key={i} /> : <Skeleton key={i} className="h-10 rounded-lg" />))}</div>
        </div>
      </div>
    </div>
  );
}

/** Static page / FAQ */
export function ArticleSkeleton() {
  return (
    <div className="px-4 py-8">
      <Busy />
      <div aria-hidden="true"><Skeleton className="h-8 w-3/4" /><SkeletonText lines={5} className="mt-6" /><SkeletonText lines={4} className="mt-6" /></div>
    </div>
  );
}

/** Offers & coupons grid */
export function OffersSkeleton({ count = 4 }) {
  return (
    <div className="mt-6 grid gap-4 sm:grid-cols-2" aria-hidden="true">
      {n(count).map((i) => (
        <div key={i} className="card card-pad space-y-3"><div className="flex gap-1.5"><Skeleton className="h-5 w-14 rounded-full" /><Skeleton className="h-5 w-14 rounded-full" /></div><Skeleton className="h-5 w-3/4" /><SkeletonText lines={2} /><Skeleton className="h-11 w-full" /></div>
      ))}
    </div>
  );
}

/** Checkout: progress, summary card, guest form, price box */
export function CheckoutSkeleton() {
  return (
    <div className="px-4 pt-4">
      <Busy label="Fetching the latest price" />
      <div aria-hidden="true" className="space-y-4">
        <div className="grid grid-cols-3 gap-2">{n(3).map((i) => <div key={i} className="space-y-1.5"><Skeleton className="h-1.5 rounded-full" /><Skeleton className="mx-auto h-3 w-16" /></div>)}</div>
        <div className="card overflow-hidden"><div className="flex gap-3 p-4"><Skeleton className="h-20 w-24 flex-none rounded-xl" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/2" /><Skeleton className="h-3 w-2/5" /></div></div><div className="grid grid-cols-2 gap-px border-t border-line"><div className="space-y-2 p-3.5"><Skeleton className="h-3 w-12" /><Skeleton className="h-4 w-24" /></div><div className="space-y-2 p-3.5"><Skeleton className="h-3 w-12" /><Skeleton className="h-4 w-24" /></div></div></div>
        <div className="card card-pad space-y-3"><Skeleton className="h-5 w-32" />{n(3).map((i) => <Skeleton key={i} className="h-11 w-full" />)}</div>
        <div className="card card-pad space-y-3">{n(3).map((i) => <div key={i} className="flex justify-between"><Skeleton className="h-3.5 w-28" /><Skeleton className="h-3.5 w-16" /></div>)}<div className="flex justify-between border-t border-line pt-3"><Skeleton className="h-5 w-20" /><Skeleton className="h-5 w-24" /></div></div>
      </div>
    </div>
  );
}

/** AI itinerary being generated: day cards */
export function ItinerarySkeleton() {
  return (
    <div className="space-y-3" aria-hidden="true">
      {n(3).map((i) => (
        <div key={i} className="card card-pad space-y-3"><div className="flex items-center gap-3"><Skeleton className="h-9 w-9 flex-none rounded-full" /><Skeleton className="h-4 w-1/2" /></div><SkeletonText lines={3} /></div>
      ))}
    </div>
  );
}

/** Generic app screen: title + a few cards (lazy screens, feature gate, profile) */
export function ScreenSkeleton({ cards = 3 }) {
  return (
    <div className="space-y-4 px-4 py-5">
      <Busy />
      <div aria-hidden="true" className="space-y-4"><Skeleton className="h-6 w-40" />{n(cards).map((i) => <TripCardSkeleton key={i} />)}</div>
    </div>
  );
}

/**
 * Before the app shell exists (session check on launch / deep link): draws the shell itself —
 * home → full home skeleton; any other screen → top bar + generic screen.
 */
export function AppBootSkeleton() {
  const { pathname } = useLocation();
  if (pathname === '/home') return <div className="app-frame"><HomeSkeleton /></div>;
  const body = pathname.startsWith('/stay/') ? <PropertyDetailSkeleton /> : pathname.startsWith('/search') ? <SearchSkeleton /> : pathname.startsWith('/booking/') ? <BookingSkeleton /> : pathname.startsWith('/checkout') ? <CheckoutSkeleton /> : pathname.startsWith('/bus/') ? <SeatMapSkeleton /> : <ScreenSkeleton />;
  return (
    <div className="app-frame">
      <div className="pt-safe flex h-16 items-center gap-3 border-b border-line px-3" aria-hidden="true"><Skeleton className="h-10 w-10 rounded-full" /><Skeleton className="h-5 w-36" /></div>
      {body}
    </div>
  );
}

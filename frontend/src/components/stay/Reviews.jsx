import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import { Modal, Button, Input, Textarea, Avatar } from '../ui';
import { cx, timeAgo, plural } from '../../lib/format';

const WORDS = ['', 'Terrible', 'Poor', 'Okay', 'Good', 'Excellent'];
const STAR_ON = 'fill-[#f5a524] text-[#f5a524]'; // same amber as <Stars>

export function StarRow({ value, size = 14, className }) {
  return (
    <span className={cx('inline-flex gap-0.5', className)} role="img" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => <Star key={n} size={size} className={n <= Math.round(value) ? STAR_ON : 'text-line'} />)}
    </span>
  );
}

/** "Rate your stay" — bottom sheet on phones. `booking` null = closed. */
export function ReviewSheet({ booking, onClose, onDone }) {
  const toast = useToast();
  const [form, setForm] = useState({ rating: 0, title: '', comment: '' });
  const [busy, setBusy] = useState(false);
  useEffect(() => { setForm({ rating: 0, title: '', comment: '' }); }, [booking?._id]);
  const submit = async () => {
    setBusy(true);
    try {
      const r = await api.post('/me/reviews', { bookingId: booking._id, ...form });
      toast.success(r.message);
      onDone?.();
      onClose();
    } catch (e) { if (!e.silent) toast.error(e); } finally { setBusy(false); }
  };
  return (
    <Modal open={Boolean(booking)} onClose={onClose} title="Rate your stay" size="sm"
      footer={<Button block loading={busy} disabled={!form.rating} onClick={submit}>Submit review</Button>}>
      {booking && (
        <div className="space-y-4">
          <div className="text-center">
            <p className="font-bold">{booking.snapshot?.propertyName}</p>
            <div className="mt-3 flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" onClick={() => setForm({ ...form, rating: n })} aria-label={`${n} ${n === 1 ? 'star' : 'stars'}`} aria-pressed={form.rating === n} className="p-1 transition active:scale-90">
                  <Star size={36} className={n <= form.rating ? STAR_ON : 'text-line'} />
                </button>
              ))}
            </div>
            <p className="mt-1 min-h-5 text-sm font-semibold text-muted">{form.rating ? WORDS[form.rating] : 'Tap a star to rate'}</p>
          </div>
          <Input label="Title (optional)" maxLength={120} placeholder="Sum it up in a line" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <Textarea label="Your review (optional)" maxLength={2000} rows={4} placeholder="What did you like? What could be better?" value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} />
        </div>
      )}
    </Modal>
  );
}

/** The guest's own review of a booking, with its moderation state. */
export function MyReview({ review }) {
  const note = { pending: 'Waiting for approval', approved: 'Published', rejected: 'Not published' }[review.status];
  return (
    <div className="card card-pad mt-4">
      <div className="flex items-center justify-between gap-3"><p className="font-bold">Your review</p><span className="text-xs font-semibold text-muted">{note}</span></div>
      <StarRow value={review.rating} size={18} className="mt-2" />
      {review.title && <p className="mt-2 font-semibold">{review.title}</p>}
      {review.comment && <p className="mt-1 text-sm text-muted">{review.comment}</p>}
    </div>
  );
}

export function ReviewCard({ r }) {
  return (
    <div className="card card-pad">
      <div className="flex items-center gap-3">
        <Avatar name={r.user?.name} size={34} />
        <div><p className="text-sm font-bold">{r.user?.name || 'Guest'}</p><p className="text-xs text-muted">{timeAgo(r.createdAt)}</p></div>
      </div>
      <StarRow value={r.rating} className="mt-3" />
      {r.title && <p className="mt-2 font-semibold">{r.title}</p>}
      {r.comment && <p className="mt-1 text-sm text-muted">{r.comment}</p>}
    </div>
  );
}

/** Average + 5→1 bars + latest reviews, with "see all". */
export function ReviewsList({ propertyId, rating, breakdown, reviews }) {
  const [all, setAll] = useState(null);
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const count = rating?.count || 0;
  if (!count) return <p className="card card-pad text-sm text-muted">No reviews yet. Guests can rate this stay after they’ve stayed here.</p>;
  const total = Object.values(breakdown || {}).reduce((a, b) => a + b, 0) || 1;
  const seeAll = async () => {
    setLoading(true);
    try { setAll((await api.get(`/public/properties/${propertyId}/reviews`)).data); } catch (e) { if (!e.silent) toast.error(e); } finally { setLoading(false); }
  };
  return (
    <>
      <div className="card card-pad mb-4 flex items-center gap-5">
        <div className="text-center">
          <p className="text-4xl font-extrabold">{rating.avg.toFixed(1)}</p>
          <StarRow value={rating.avg} className="mt-1" />
          <p className="mt-1 text-xs text-muted">{plural(count, 'review')}</p>
        </div>
        <div className="flex-1 space-y-1">
          {[5, 4, 3, 2, 1].map((s) => (
            <div key={s} className="flex items-center gap-2 text-xs text-muted">
              <span className="w-3 text-right">{s}</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface"><span className="block h-full rounded-full bg-primary" style={{ width: `${((breakdown?.[s] || 0) / total) * 100}%` }} /></span>
              <span className="w-6 tabular-nums">{breakdown?.[s] || 0}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{reviews.slice(0, 4).map((r) => <ReviewCard key={r._id} r={r} />)}</div>
      {count > Math.min(reviews.length, 4) && <Button variant="outline" block className="mt-4" loading={loading} onClick={seeAll}>See all {count} reviews</Button>}
      <Modal open={Boolean(all)} onClose={() => setAll(null)} title="Guest reviews">
        <div className="space-y-3">{all?.map((r) => <ReviewCard key={r._id} r={r} />)}</div>
      </Modal>
    </>
  );
}

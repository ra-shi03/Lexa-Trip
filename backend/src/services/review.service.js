import { Review } from '../models/Misc.js';
import { toDay } from '../utils/helpers.js';
import { today } from '../utils/clock.js';

/** Guests rate a stay once it is over: checked out / completed, or its check-out day has arrived. */
export function canReviewBooking(b) {
  if (b.type !== 'hotel') return false;
  if (['checked_out', 'completed'].includes(b.status)) return true;
  return ['confirmed', 'checked_in'].includes(b.status) && toDay(b.checkOut) <= today();
}

/** Adds `canReview` (still to be rated) and `review` (the guest's own, with moderation status) to bookings. */
export async function withReviewState(bookings, userId) {
  const mine = await Review.find({ user: userId, booking: { $in: bookings.map((b) => b._id) } }).select('booking rating title comment status createdAt').lean();
  const byBooking = new Map(mine.map((r) => [String(r.booking), r]));
  return bookings.map((b) => {
    const review = byBooking.get(String(b._id)) || null;
    return { ...b, review, canReview: !review && canReviewBooking(b) };
  });
}

/** { 5: n, 4: n, … } of approved reviews, for the rating bars. */
export async function ratingBreakdown(propertyId) {
  const rows = await Review.aggregate([{ $match: { property: propertyId, status: 'approved' } }, { $group: { _id: '$rating', n: { $sum: 1 } } }]);
  return Object.fromEntries([5, 4, 3, 2, 1].map((s) => [s, rows.find((r) => r._id === s)?.n || 0]));
}

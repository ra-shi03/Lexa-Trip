import User from '../../models/User.js';
import Vendor from '../../models/Vendor.js';
import Property from '../../models/Property.js';
import Booking from '../../models/Booking.js';
import { Review, SupportTicket, AuditLog } from '../../models/Misc.js';
import SeoHotel from '../../models/seo/SeoHotel.js';
import { ok } from '../../utils/response.js';
import { addDays, toDay } from '../../utils/helpers.js';

/**
 * Master admin sees revenue/commission; sub-admins get the same dashboard
 * WITHOUT any revenue figures (computed server-side, never sent).
 */
export async function dashboard(req, res) {
  const isMaster = req.admin.role === 'master';
  const since = addDays(new Date(), -30);
  const live = { $nin: ['pending_payment', 'failed', 'expired'] };

  const [users, vendors, properties, bookingsByType, byStatus, pendingVendors, pendingProperties, pendingReviews, openTickets, seoDrafts, recentActivity, recentBookings] = await Promise.all([
    User.countDocuments(),
    Vendor.countDocuments(),
    Property.countDocuments(),
    Booking.aggregate([{ $match: { status: live } }, { $group: { _id: '$type', count: { $sum: 1 } } }]),
    Booking.aggregate([{ $match: { status: live } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Vendor.countDocuments({ status: 'pending' }),
    Property.countDocuments({ status: 'pending' }),
    Review.countDocuments({ status: 'pending' }),
    SupportTicket.countDocuments({ status: { $in: ['open', 'in_progress'] } }),
    SeoHotel.countDocuments({ status: 'review' }),
    AuditLog.find().sort({ createdAt: -1 }).limit(10).lean(),
    Booking.find({ status: live }).sort({ createdAt: -1 }).limit(8).select('bookingCode type status snapshot trip.from trip.to primaryGuest.name createdAt pricing.totalAmount').lean(),
  ]);

  const trendGroup = { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, bookings: { $sum: 1 } };
  if (isMaster) {
    trendGroup.revenue = { $sum: '$pricing.totalAmount' };
    trendGroup.commission = { $sum: '$commission.amount' };
  }
  const trend = await Booking.aggregate([{ $match: { status: live, createdAt: { $gte: since } } }, { $group: trendGroup }, { $sort: { _id: 1 } }]);

  const data = {
    totals: { users, vendors, properties, bookings: bookingsByType.reduce((s, b) => s + b.count, 0) },
    bookingsByType: Object.fromEntries(bookingsByType.map((b) => [b._id, b.count])),
    bookingsByStatus: Object.fromEntries(byStatus.map((b) => [b._id, b.count])),
    pending: { vendors: pendingVendors, properties: pendingProperties, reviews: pendingReviews, tickets: openTickets, seoReview: seoDrafts },
    trend,
    recentActivity,
    recentBookings: isMaster ? recentBookings : recentBookings.map(({ pricing, ...b }) => b),
    today: toDay(new Date()),
  };

  if (isMaster) {
    const rev = await Booking.aggregate([
      { $match: { paymentStatus: { $in: ['paid', 'partially_refunded'] } } },
      { $group: { _id: '$type', gross: { $sum: '$pricing.totalAmount' }, commission: { $sum: '$commission.amount' } } },
    ]);
    const refunds = await Booking.aggregate([{ $match: { 'cancellation.refundAmount': { $gt: 0 } } }, { $group: { _id: null, amount: { $sum: '$cancellation.refundAmount' } } }]);
    data.revenue = {
      gross: rev.reduce((s, r) => s + r.gross, 0),
      commission: rev.reduce((s, r) => s + (r.commission || 0), 0),
      byService: Object.fromEntries(rev.map((r) => [r._id, { gross: r.gross, commission: r.commission }])),
      refunds: refunds[0]?.amount || 0,
    };
  }
  ok(res, data);
}

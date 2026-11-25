import Property from '../../models/Property.js';
import Booking from '../../models/Booking.js';
import { Payout } from '../../models/Finance.js';
import { Notification } from '../../models/Misc.js';
import { Inventory } from '../../models/Inventory.js';
import { publicUrlFor } from '../../middlewares/upload.js';
import { ok } from '../../utils/response.js';
import { ApiError } from '../../utils/ApiError.js';
import { toDay, addDays } from '../../utils/helpers.js';

export async function dashboard(req, res) {
  const vendor = req.vendor._id;
  const today = toDay(new Date());
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const live = { $nin: ['pending_payment', 'failed', 'expired', 'cancelled'] };
  const [properties, statusCounts, arrivals, departures, pendingApproval, month, recent, inv] = await Promise.all([
    Property.aggregate([{ $match: { vendor } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Booking.aggregate([{ $match: { vendor, status: { $ne: 'pending_payment' } } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Booking.countDocuments({ vendor, checkIn: today, status: 'confirmed' }),
    Booking.countDocuments({ vendor, checkOut: today, status: 'checked_in' }),
    Booking.countDocuments({ vendor, status: 'pending_approval' }),
    Booking.aggregate([{ $match: { vendor, status: live, createdAt: { $gte: monthStart } } }, { $group: { _id: null, bookings: { $sum: 1 }, gross: { $sum: '$pricing.totalAmount' }, net: { $sum: '$vendorPayoutAmount' }, commission: { $sum: '$commission.amount' } } }]),
    Booking.find({ vendor, status: { $ne: 'pending_payment' } }).sort({ createdAt: -1 }).limit(8).select('bookingCode snapshot checkIn checkOut status pricing.totalAmount primaryGuest.name').lean(),
    Inventory.aggregate([
      { $match: { property: { $in: (await Property.find({ vendor }).select('_id').lean()).map((p) => p._id) }, date: { $gte: today, $lt: addDays(today, 30) } } },
      { $group: { _id: null, total: { $sum: '$totalRooms' }, booked: { $sum: '$booked' } } },
    ]),
  ]);
  ok(res, {
    properties: Object.fromEntries(properties.map((p) => [p._id, p.count])),
    bookings: Object.fromEntries(statusCounts.map((s) => [s._id, s.count])),
    today: { arrivals, departures, pendingApproval },
    month: month[0] || { bookings: 0, gross: 0, net: 0, commission: 0 },
    occupancyNext30: inv[0]?.total ? Math.round((inv[0].booked / inv[0].total) * 100) : 0,
    recent,
    accountStatus: req.vendor.status,
  });
}

export async function updateProfile(req, res) {
  const allowed = ['name', 'phone', 'businessName', 'businessType', 'gstin', 'pan', 'address'];
  for (const k of allowed) if (req.body[k] !== undefined) req.vendor[k] = req.body[k];
  await req.vendor.save();
  ok(res, req.vendor, undefined, 'Profile updated');
}

export async function updateBank(req, res) {
  const { accountHolder, accountNumber, ifsc, bankName, upiId } = req.body;
  if (ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(ifsc)) throw ApiError.badRequest('Invalid IFSC code');
  req.vendor.bank = { accountHolder, accountNumber, ifsc: ifsc?.toUpperCase(), bankName, upiId };
  await req.vendor.save();
  ok(res, req.vendor.bank, undefined, 'Bank details saved');
}

export async function uploadDocument(req, res) {
  if (!req.file) throw ApiError.badRequest('Choose a file');
  req.vendor.documents.push({ type: req.body.type || 'other', url: publicUrlFor(req.file.path) });
  await req.vendor.save();
  ok(res, req.vendor.documents, undefined, 'Document uploaded for verification');
}

export async function earnings(req, res) {
  const vendor = req.vendor._id;
  const [totals, unpaid, payouts] = await Promise.all([
    Booking.aggregate([
      { $match: { vendor, paymentStatus: { $in: ['paid', 'partially_refunded'] }, status: { $in: ['confirmed', 'checked_in', 'checked_out', 'completed', 'cancelled'] } } },
      { $group: { _id: null, gross: { $sum: '$pricing.totalAmount' }, commission: { $sum: '$commission.amount' }, net: { $sum: '$vendorPayoutAmount' } } },
    ]),
    Booking.aggregate([
      { $match: { vendor, payout: null, status: { $in: ['checked_out', 'completed'] } } },
      { $group: { _id: null, amount: { $sum: '$vendorPayoutAmount' }, count: { $sum: 1 } } },
    ]),
    Payout.find({ vendor }).sort({ createdAt: -1 }).limit(50).lean(),
  ]);
  ok(res, { totals: totals[0] || { gross: 0, commission: 0, net: 0 }, pendingPayout: unpaid[0] || { amount: 0, count: 0 }, payouts });
}

export async function notifications(req, res) {
  const items = await Notification.find({ recipientType: 'vendor', recipient: req.vendor._id }).sort({ createdAt: -1 }).limit(50).lean();
  ok(res, items, { unread: items.filter((n) => !n.read).length });
}

export async function markRead(req, res) {
  await Notification.updateMany({ recipientType: 'vendor', recipient: req.vendor._id }, { read: true });
  ok(res, null);
}

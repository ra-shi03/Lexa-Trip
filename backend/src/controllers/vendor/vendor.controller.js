import { removePrivateFile, sendPrivateFile } from '../../services/privateStorage.service.js';
import { onboarding, vendorView, publicDocuments, isProfileLocked } from '../../services/vendorOnboarding.service.js';
import { notify } from '../../services/notification/notification.service.js';
import Property from '../../models/Property.js';
import Booking from '../../models/Booking.js';
import { Payout } from '../../models/Finance.js';
import { Notification } from '../../models/Misc.js';
import { Inventory } from '../../models/Inventory.js';
import { ok } from '../../utils/response.js';
import { ApiError } from '../../utils/ApiError.js';
import { toDay, addDays } from '../../utils/helpers.js';

import { today as platformToday } from '../../utils/clock.js';
export async function dashboard(req, res) {
  const vendor = req.vendor._id;
  const today = platformToday();
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

// Format checks run only on values being changed, so older records can still be saved
const FORMATS = [
  ['phone', /^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'],
  ['pan', /^[A-Z]{5}\d{4}[A-Z]$/i, 'Enter a valid PAN (e.g. ABCDE1234F)'],
  ['gstin', /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/i, 'Enter a valid GSTIN (e.g. 08ABCDE1234F1Z5)'],
];
const BANK_FORMATS = [
  ['accountNumber', /^\d{9,18}$/, 'Account number must be 9 to 18 digits'],
  ['upiId', /^[\w.-]{2,256}@[a-z][a-z0-9.-]{1,64}$/i, 'Enter a valid UPI ID (e.g. name@okhdfcbank)'],
];

export async function updateProfile(req, res) {
  for (const [key, pattern, message] of FORMATS) {
    const value = req.body[key];
    if (value && value !== req.vendor[key] && !pattern.test(value)) throw ApiError.badRequest(message);
  }
  const pincode = req.body.address?.pincode;
  if (pincode && pincode !== req.vendor.address?.pincode && !/^[1-9]\d{5}$/.test(pincode)) throw ApiError.badRequest('Enter a valid 6-digit pincode');
  const allowed = ['name', 'phone', 'businessName', 'businessType', 'gstin', 'pan', 'address'];
  for (const k of allowed) if (req.body[k] !== undefined) req.vendor[k] = req.body[k];
  await req.vendor.save();
  ok(res, req.vendor, undefined, 'Profile updated');
}

export async function updateBank(req, res) {
  const { accountHolder, accountNumber, ifsc, bankName, upiId } = req.body;
  if (ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(ifsc)) throw ApiError.badRequest('Invalid IFSC code');
  for (const [key, pattern, message] of BANK_FORMATS) {
    const value = req.body[key];
    if (value && value !== req.vendor.bank?.[key] && !pattern.test(value)) throw ApiError.badRequest(message);
  }
  req.vendor.bank = { accountHolder, accountNumber, ifsc: ifsc?.toUpperCase(), bankName, upiId };
  await req.vendor.save();
  ok(res, req.vendor.bank, undefined, 'Bank details saved');
}

const DOCUMENT_TYPES = ['gst_certificate', 'pan', 'trade_licence', 'property_proof', 'id_proof', 'cancelled_cheque'];

/** One document per type: a new upload replaces the old file. */
export async function uploadDocument(req, res) {
  const { file, vendor } = req;
  if (!file) throw ApiError.badRequest('Choose a file');
  const { type } = req.body;
  const existing = vendor.documents.filter((d) => d.type === type);
  let problem;
  if (!DOCUMENT_TYPES.includes(type)) problem = ApiError.badRequest('Choose a document type');
  else if (isProfileLocked(vendor) && !existing.some((d) => d.status === 'rejected')) problem = ApiError.forbidden('Only a document the admin rejected can be uploaded again');
  if (problem) {
    await removePrivateFile(file.key);
    throw problem;
  }
  const replaced = existing.map((d) => d.file);
  existing.forEach((d) => vendor.documents.pull(d._id));
  vendor.documents.push({ type, file: file.key, mime: file.mimetype });
  await vendor.save();
  await Promise.all(replaced.filter(Boolean).map(removePrivateFile));
  ok(res, publicDocuments(vendor.documents), undefined, 'Document uploaded for verification');
}

/** A vendor can open only their own documents. */
export async function documentFile(req, res) {
  await sendPrivateFile(res, req.vendor.documents.id(req.params.docId));
}

/** Ask the admin to approve the account — only once everything required is filled in */
export async function submitProfile(req, res) {
  const { stage, missing } = onboarding(req.vendor);
  if (stage === 'approved') throw ApiError.conflict('Your account is already approved');
  if (stage === 'review') throw ApiError.conflict('Your profile is already under review');
  if (stage === 'suspended') throw ApiError.forbidden('Your vendor account is suspended');
  if (missing.length) throw ApiError.badRequest(`Complete your profile first: ${missing.map((m) => m.label).join(', ')}`, missing);
  req.vendor.set({ status: 'pending', statusNote: undefined, submittedAt: new Date() });
  await req.vendor.save();
  await notify({ recipientType: 'admin', title: 'Vendor ready for approval', body: `${req.vendor.businessName} (${req.vendor.email}) submitted their business profile`, type: 'vendor_pending', data: { vendorId: req.vendor._id } });
  ok(res, vendorView(req.vendor), undefined, 'Submitted for approval');
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

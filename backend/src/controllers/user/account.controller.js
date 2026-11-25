import { z } from 'zod';
import User from '../../models/User.js';
import Booking from '../../models/Booking.js';
import Property from '../../models/Property.js';
import { Notification, Review, SupportTicket } from '../../models/Misc.js';
import { ok, created } from '../../utils/response.js';
import { publicUrlFor } from '../../middlewares/upload.js';
import { ApiError } from '../../utils/ApiError.js';

export const schemas = {
  profile: z.object({
    name: z.string().trim().min(2, 'Enter your full name').max(80).optional(),
    email: z.string().trim().toLowerCase().email('Enter a valid email').max(120).optional().or(z.literal('')),
    dob: z.string().refine((v) => v === '' || (!Number.isNaN(Date.parse(v)) && new Date(v) <= new Date() && new Date(v).getFullYear() >= 1900), 'Enter a valid date of birth').optional(),
    gender: z.enum(['male', 'female', 'other', 'prefer_not', '']).optional(),
    removeAvatar: z.boolean().optional(),
  }),
  traveller: z.object({
    fullName: z.string().trim().min(2),
    gender: z.enum(['male', 'female', 'other', '']).optional(),
    dob: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().optional(),
    idType: z.enum(['aadhaar', 'passport', 'pan', 'driving_licence', 'voter_id', '']).optional(),
    idNumber: z.string().optional(),
    nationality: z.string().optional(),
  }),
  review: z.object({ bookingId: z.string(), rating: z.coerce.number().int().min(1).max(5), title: z.string().max(120).optional(), comment: z.string().max(2000).optional() }),
  ticket: z.object({ subject: z.string().trim().min(3).max(150), message: z.string().trim().min(3).max(3000), bookingId: z.string().optional(), category: z.string().optional() }),
};

export async function updateProfile(req, res) {
  const { removeAvatar, dob, ...rest } = req.body;
  Object.assign(req.user, rest);
  if (dob !== undefined) req.user.dob = dob ? new Date(dob) : undefined;
  if (removeAvatar) req.user.avatar = undefined;
  await req.user.save();
  ok(res, req.user, undefined, 'Profile updated');
}

export async function uploadAvatar(req, res) {
  if (!req.file) throw ApiError.badRequest('Choose a photo');
  req.user.avatar = publicUrlFor(req.file.path);
  await req.user.save();
  ok(res, req.user, undefined, 'Profile photo updated');
}

// ── Saved travellers ──
export async function listTravellers(req, res) {
  ok(res, req.user.savedTravellers);
}
export async function addTraveller(req, res) {
  req.user.savedTravellers.push(req.body);
  await req.user.save();
  created(res, req.user.savedTravellers);
}
export async function updateTraveller(req, res) {
  const t = req.user.savedTravellers.id(req.params.id);
  if (!t) throw ApiError.notFound();
  t.set(req.body);
  await req.user.save();
  ok(res, req.user.savedTravellers);
}
export async function removeTraveller(req, res) {
  req.user.savedTravellers.pull(req.params.id);
  await req.user.save();
  ok(res, req.user.savedTravellers);
}

// ── Wishlist (saved properties) ──
export async function wishlist(req, res) {
  const u = await User.findById(req.user._id).populate({ path: 'wishlist', select: 'name slug images minPrice rating starRating address', populate: { path: 'address.city', select: 'name' } }).lean();
  ok(res, u.wishlist);
}
export async function toggleWishlist(req, res) {
  const id = req.params.propertyId;
  if (!(await Property.exists({ _id: id }))) throw ApiError.notFound();
  const has = req.user.wishlist.some((w) => String(w) === id);
  if (has) req.user.wishlist.pull(id);
  else req.user.wishlist.push(id);
  await req.user.save();
  ok(res, { saved: !has, wishlist: req.user.wishlist });
}

// ── Notifications ──
export async function notifications(req, res) {
  const items = await Notification.find({ recipientType: 'user', recipient: req.user._id }).sort({ createdAt: -1 }).limit(50).lean();
  ok(res, items, { unread: items.filter((n) => !n.read).length });
}
export async function markNotificationsRead(req, res) {
  await Notification.updateMany({ recipientType: 'user', recipient: req.user._id, read: false }, { read: true });
  ok(res, null);
}

// ── Reviews ──
export async function createReview(req, res) {
  const b = await Booking.findOne({ _id: req.body.bookingId, user: req.user._id, type: 'hotel' });
  if (!b) throw ApiError.notFound('Booking not found');
  if (!['checked_out', 'completed'].includes(b.status) && new Date(b.checkOut) > new Date()) throw ApiError.badRequest('You can review after your stay');
  const review = await Review.create({ property: b.property, user: req.user._id, booking: b._id, rating: req.body.rating, title: req.body.title, comment: req.body.comment });
  created(res, review, 'Thanks! Your review will appear after moderation.');
}

// ── Support ──
export async function tickets(req, res) {
  ok(res, await SupportTicket.find({ user: req.user._id }).sort({ updatedAt: -1 }).populate('booking', 'bookingCode type').lean());
}
export async function createTicket(req, res) {
  const t = await SupportTicket.create({ user: req.user._id, booking: req.body.bookingId, subject: req.body.subject, category: req.body.category, messages: [{ from: 'user', text: req.body.message }] });
  created(res, t, 'Support request submitted');
}
export async function replyTicket(req, res) {
  const t = await SupportTicket.findOne({ _id: req.params.id, user: req.user._id });
  if (!t) throw ApiError.notFound();
  t.messages.push({ from: 'user', text: String(req.body.message || '').slice(0, 3000) });
  if (t.status === 'resolved') t.status = 'open';
  await t.save();
  ok(res, t);
}

/** Delete account: anonymises the profile (bookings are kept for vendor/finance records) and signs the guest out everywhere. */
export async function deleteAccount(req, res) {
  const now = new Date();
  const upcoming = await Booking.countDocuments({
    user: req.user._id,
    status: { $in: ['confirmed', 'pending_approval', 'checked_in'] },
    $or: [{ checkOut: { $gte: now } }, { 'trip.departure': { $gte: now.toISOString() } }],
  });
  if (upcoming) throw ApiError.badRequest(`You have ${upcoming} upcoming trip${upcoming > 1 ? 's' : ''}. Cancel or complete them before deleting your account.`);
  const u = req.user;
  u.phone = `deleted_${u._id}`;
  u.name = 'Deleted user';
  u.email = undefined; u.avatar = undefined; u.dob = undefined; u.gender = '';
  u.savedTravellers = []; u.wishlist = []; u.favouriteCities = [];
  u.status = 'blocked';
  await u.save();
  ok(res, { deleted: true }, null, 'Account deleted');
}

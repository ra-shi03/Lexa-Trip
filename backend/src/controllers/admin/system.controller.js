import Booking from '../../models/Booking.js';
import Property from '../../models/Property.js';
import { Review, SupportTicket, AuditLog, Notification, AiConversation } from '../../models/Misc.js';
import { getSettings, updateSettingsSection, SETTINGS_SECTIONS } from '../../services/settings.service.js';
import { isAiConfigured } from '../../services/ai/gemini.js';
import { gscConfigured } from '../../services/seo/gsc.service.js';
import { audit } from '../../services/audit.service.js';
import { publicUrlFor } from '../../middlewares/upload.js';
import { env } from '../../config/env.js';
import { ok } from '../../utils/response.js';
import { ApiError } from '../../utils/ApiError.js';
import { buildListQuery, pageMeta } from '../../utils/queryBuilder.js';

/** Which permission is needed to edit each settings section */
export const SECTION_PERMISSION = {
  brand: 'appearance', theme: 'appearance', features: 'appearance', homeSections: 'appearance', home: 'appearance', app: 'appearance', auth: 'appearance', social: 'content',
  booking: 'integrations', integrations: 'integrations', seo: 'seo', tax: 'finance', commission: 'commission',
};

export async function getAllSettings(req, res) {
  const s = await getSettings({ fresh: true });
  const out = { ...s };
  if (req.admin.role !== 'master') {
    delete out.commission;
    delete out.tax;
  }
  // Integration *status* (keys live in .env and are never returned)
  out.integrationStatus = {
    payment: { provider: env.payment.provider, configured: env.payment.provider === 'mock' || Boolean(env.payment.razorpayKeyId) },
    ai: { provider: env.ai.provider, configured: await isAiConfigured() },
    sms: { provider: env.otpProvider, configured: env.otpProvider !== 'console' },
    email: { configured: Boolean(env.smtp.host) },
    bus: { provider: env.busProvider, sandbox: env.busProvider === 'mock' },
    flight: { provider: env.flightProvider, sandbox: env.flightProvider === 'mock' },
    channelManager: { provider: env.channelManagerProvider, sandbox: env.channelManagerProvider === 'mock' },
    searchConsole: { configured: gscConfigured() },
  };
  ok(res, out);
}

export async function updateSettings(req, res) {
  const { section } = req.params;
  if (!SETTINGS_SECTIONS.includes(section)) throw ApiError.badRequest('Unknown settings section');
  const perm = SECTION_PERMISSION[section];
  if (req.admin.role !== 'master' && !req.admin.permissions.includes(perm)) throw ApiError.forbidden();
  if (req.admin.role !== 'master' && ['finance', 'commission'].includes(perm)) throw ApiError.forbidden('Restricted to the master admin');
  const s = await updateSettingsSection(section, req.body, req.admin._id);
  audit(req, `settings.${section}`, 'Setting', null);
  ok(res, s, undefined, 'Settings saved');
}

export async function uploadAsset(req, res) {
  if (!req.file) throw ApiError.badRequest('Choose a file');
  ok(res, { url: publicUrlFor(req.file.path) });
}

// ─── Reviews ───
export async function reviews(req, res) {
  const { filter, skip, limit, page, sort } = buildListQuery(req.query, { searchFields: ['comment', 'title'], filterFields: ['status', 'property'] });
  const [items, total] = await Promise.all([
    Review.find(filter).sort(sort).skip(skip).limit(limit).populate('user', 'name phone').populate('property', 'name').lean(),
    Review.countDocuments(filter),
  ]);
  ok(res, items, pageMeta(total, page, limit));
}
export async function moderateReview(req, res) {
  const r = await Review.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
  if (!r) throw ApiError.notFound();
  const agg = await Review.aggregate([{ $match: { property: r.property, status: 'approved' } }, { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } }]);
  await Property.updateOne({ _id: r.property }, { rating: { avg: Math.round((agg[0]?.avg || 0) * 10) / 10, count: agg[0]?.count || 0 } });
  ok(res, r, undefined, `Review ${req.body.status}`);
}

// ─── Support ───
export async function tickets(req, res) {
  const { filter, skip, limit, page, sort } = buildListQuery(req.query, { searchFields: ['subject'], filterFields: ['status', 'category'] });
  const [items, total] = await Promise.all([
    SupportTicket.find(filter).sort(sort).skip(skip).limit(limit).populate('user', 'name phone').populate('booking', 'bookingCode type').lean(),
    SupportTicket.countDocuments(filter),
  ]);
  ok(res, items, pageMeta(total, page, limit));
}
export async function replyTicket(req, res) {
  const t = await SupportTicket.findById(req.params.id);
  if (!t) throw ApiError.notFound();
  if (req.body.message) t.messages.push({ from: 'admin', text: req.body.message });
  if (req.body.status) t.status = req.body.status;
  await t.save();
  ok(res, t);
}

// ─── Bookings (all services) — admin specific extras ───
export async function bookingStats(_req, res) {
  const stats = await Booking.aggregate([{ $group: { _id: { type: '$type', status: '$status' }, count: { $sum: 1 } } }]);
  ok(res, stats);
}

// ─── Audit / notifications / AI logs ───
export async function auditLogs(req, res) {
  const { filter, skip, limit, page } = buildListQuery(req.query, { searchFields: ['action', 'actorName'], filterFields: ['entity', 'actorType'] });
  const [items, total] = await Promise.all([AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), AuditLog.countDocuments(filter)]);
  ok(res, items, pageMeta(total, page, limit));
}
export async function notifications(_req, res) {
  const items = await Notification.find({ recipientType: 'admin' }).sort({ createdAt: -1 }).limit(50).lean();
  ok(res, items, { unread: items.filter((n) => !n.read).length });
}
export async function markNotificationsRead(_req, res) {
  await Notification.updateMany({ recipientType: 'admin', read: false }, { read: true });
  ok(res, null);
}
export async function aiConversations(_req, res) {
  ok(res, await AiConversation.find().sort({ updatedAt: -1 }).limit(100).populate('user', 'name phone').lean());
}

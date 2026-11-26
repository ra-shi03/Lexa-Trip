import User from '../../models/User.js';
import Vendor from '../../models/Vendor.js';
import Admin from '../../models/Admin.js';
import Property from '../../models/Property.js';
import Booking from '../../models/Booking.js';
import { notify, sendEmail } from '../../services/notification/notification.service.js';
import { audit } from '../../services/audit.service.js';
import { revokeAllSessions } from '../../services/token.service.js';
import { ok, created } from '../../utils/response.js';
import { ApiError } from '../../utils/ApiError.js';
import { buildListQuery, pageMeta } from '../../utils/queryBuilder.js';
import { PERMISSIONS, SUBADMIN_ASSIGNABLE } from '../../constants/permissions.js';

// ─────────── Customers ───────────
export async function users(req, res) {
  const { filter, skip, limit, page, sort } = buildListQuery(req.query, { searchFields: ['name', 'phone', 'email'], filterFields: ['status'] });
  const [items, total] = await Promise.all([User.find(filter).sort(sort).skip(skip).limit(limit).select('-savedTravellers').lean(), User.countDocuments(filter)]);
  ok(res, items, pageMeta(total, page, limit));
}
export async function user(req, res) {
  const u = await User.findById(req.params.id).lean();
  if (!u) throw ApiError.notFound();
  const bookings = await Booking.find({ user: u._id }).sort({ createdAt: -1 }).limit(50).select('bookingCode type status snapshot trip.from trip.to pricing.totalAmount createdAt').lean();
  ok(res, { ...u, bookings });
}
export async function setUserStatus(req, res) {
  const u = await User.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
  if (!u) throw ApiError.notFound();
  if (u.status !== 'active') await revokeAllSessions('user', u._id);
  audit(req, `user.${req.body.status}`, 'User', u._id);
  ok(res, u, undefined, `User ${req.body.status}`);
}

// ─────────── Vendors ───────────
export async function vendors(req, res) {
  const { filter, skip, limit, page, sort } = buildListQuery(req.query, { searchFields: ['name', 'email', 'businessName', 'phone'], filterFields: ['status'] });
  const [items, total] = await Promise.all([Vendor.find(filter).sort(sort).skip(skip).limit(limit).lean(), Vendor.countDocuments(filter)]);
  const counts = await Property.aggregate([{ $match: { vendor: { $in: items.map((v) => v._id) } } }, { $group: { _id: '$vendor', count: { $sum: 1 } } }]);
  const map = Object.fromEntries(counts.map((c) => [String(c._id), c.count]));
  ok(res, items.map((v) => ({ ...v, propertyCount: map[String(v._id)] || 0 })), pageMeta(total, page, limit));
}
export async function vendor(req, res) {
  const v = await Vendor.findById(req.params.id).lean();
  if (!v) throw ApiError.notFound();
  const [properties, bookings] = await Promise.all([
    Property.find({ vendor: v._id }).select('name status address.city minPrice').populate('address.city', 'name').lean(),
    Booking.find({ vendor: v._id }).sort({ createdAt: -1 }).limit(30).select('bookingCode status snapshot checkIn pricing.totalAmount').lean(),
  ]);
  ok(res, { ...v, properties, bookings });
}
/** approve | reject | suspend | activate */
export async function setVendorStatus(req, res) {
  const map = { approve: 'approved', reject: 'rejected', suspend: 'suspended', activate: 'approved' };
  const status = map[req.body.action];
  if (!status) throw ApiError.badRequest('Unknown action');
  const v = await Vendor.findByIdAndUpdate(req.params.id, { status, statusNote: req.body.note }, { new: true });
  if (!v) throw ApiError.notFound();
  if (status === 'suspended') { await Property.updateMany({ vendor: v._id }, { isVisible: false }); await revokeAllSessions('vendor', v._id); }
  if (req.body.action === 'activate') await Property.updateMany({ vendor: v._id, status: 'approved' }, { isVisible: true });
  await notify({ recipientType: 'vendor', recipient: v._id, title: `Account ${status}`, body: req.body.note || '', type: 'vendor_status' });
  await sendEmail({ to: v.email, subject: `Your LexaTrip partner account is ${status}`, html: `<p>Hi ${v.name},</p><p>Your account status is now <b>${status}</b>.</p>${req.body.note ? `<p>${req.body.note}</p>` : ''}` });
  audit(req, `vendor.${req.body.action}`, 'Vendor', v._id, { note: req.body.note });
  ok(res, v, undefined, `Vendor ${status}`);
}
export async function updateVendorPermissions(req, res) {
  const v = await Vendor.findByIdAndUpdate(req.params.id, { permissions: req.body.permissions }, { new: true, runValidators: true });
  audit(req, 'vendor.permissions', 'Vendor', v._id, req.body.permissions);
  ok(res, v, undefined, 'Permissions updated');
}
export async function verifyVendorDocument(req, res) {
  const v = await Vendor.findById(req.params.id);
  const d = v?.documents.id(req.params.docId);
  if (!d) throw ApiError.notFound();
  d.status = req.body.status;
  d.note = req.body.note;
  await v.save();
  ok(res, v.documents);
}
/** Commission override per vendor — revenue permission */
export async function setVendorCommission(req, res) {
  const rate = req.body.commissionRate === '' || req.body.commissionRate === null ? undefined : Number(req.body.commissionRate);
  const v = await Vendor.findByIdAndUpdate(req.params.id, rate === undefined ? { $unset: { commissionRate: 1 } } : { commissionRate: rate }, { new: true });
  audit(req, 'vendor.commission', 'Vendor', v._id, { rate });
  ok(res, v, undefined, 'Commission updated');
}

// ─────────── Property approval ───────────
/** approve | reject | suspend | feature | unfeature | show | hide */
export async function propertyAction(req, res) {
  const p = await Property.findById(req.params.id);
  if (!p) throw ApiError.notFound();
  const { action, note } = req.body;
  const updates = {
    approve: { status: 'approved', isVisible: true },
    reject: { status: 'rejected' },
    suspend: { status: 'suspended', isVisible: false },
    feature: { isFeatured: true },
    unfeature: { isFeatured: false },
    show: { isVisible: true },
    hide: { isVisible: false },
  }[action];
  if (!updates) throw ApiError.badRequest('Unknown action');
  if (action === 'approve') {
    const v = await Vendor.findById(p.vendor).lean();
    if (v?.status !== 'approved') throw ApiError.conflict('Approve the vendor account first');
  }
  p.set({ ...updates, statusNote: note });
  await p.save();
  if (['approve', 'reject', 'suspend'].includes(action)) {
    await notify({ recipientType: 'vendor', recipient: p.vendor, title: `Property ${updates.status}: ${p.name}`, body: note || '', type: 'property_status', data: { propertyId: p._id } });
  }
  audit(req, `property.${action}`, 'Property', p._id, { note });
  ok(res, p, undefined, 'Property updated');
}

// ─────────── Sub-admins (master only) ───────────
export async function permissionCatalog(_req, res) {
  ok(res, { all: PERMISSIONS, assignable: SUBADMIN_ASSIGNABLE });
}
export async function subadmins(_req, res) {
  ok(res, await Admin.find({ role: 'subadmin' }).sort({ createdAt: -1 }).populate('createdBy', 'name').lean());
}
export async function createSubadmin(req, res) {
  const { name, email, phone, password, permissions = [] } = req.body;
  if (!password || password.length < 8) throw ApiError.badRequest('Password must be at least 8 characters');
  if (await Admin.exists({ email })) throw ApiError.conflict('Email already in use');
  const a = await Admin.create({ name, email, phone, password, role: 'subadmin', permissions: permissions.filter((p) => SUBADMIN_ASSIGNABLE.includes(p)), createdBy: req.admin._id });
  audit(req, 'subadmin.create', 'Admin', a._id, { permissions: a.permissions });
  const out = a.toObject();
  delete out.password;
  created(res, out, 'Sub-admin created');
}
export async function updateSubadmin(req, res) {
  const a = await Admin.findOne({ _id: req.params.id, role: 'subadmin' }).select('+password');
  if (!a) throw ApiError.notFound();
  const { name, phone, permissions, status, password } = req.body;
  if (name) a.name = name;
  if (phone !== undefined) a.phone = phone;
  if (permissions) a.permissions = permissions.filter((p) => SUBADMIN_ASSIGNABLE.includes(p));
  if (status) a.status = status;
  if (password) {
    if (password.length < 8) throw ApiError.badRequest('Password must be at least 8 characters');
    a.password = password;
  }
  await a.save();
  if (a.status !== 'active' || password) await revokeAllSessions('admin', a._id); // suspended or password reset → sign out everywhere
  audit(req, 'subadmin.update', 'Admin', a._id, { permissions: a.permissions, status: a.status });
  const out = a.toObject();
  delete out.password;
  ok(res, out, undefined, 'Sub-admin updated');
}
export async function deleteSubadmin(req, res) {
  const del = await Admin.deleteOne({ _id: req.params.id, role: 'subadmin' });
  if (del.deletedCount) await revokeAllSessions('admin', req.params.id);
  audit(req, 'subadmin.delete', 'Admin', req.params.id);
  ok(res, null, undefined, 'Sub-admin removed');
}

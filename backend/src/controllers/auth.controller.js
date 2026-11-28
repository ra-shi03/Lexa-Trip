import { vendorView } from '../services/vendorOnboarding.service.js';
import { z } from 'zod';
import User from '../models/User.js';
import Vendor from '../models/Vendor.js';
import Admin from '../models/Admin.js';
import { issueSession, rotateSession, revokeSession, revokeAllSessions } from '../services/token.service.js';
import { sendOtp, verifyOtp } from '../services/otp.service.js';
import { notify } from '../services/notification/notification.service.js';
import { ok, created } from '../utils/response.js';
import { ApiError } from '../utils/ApiError.js';
import { PERMISSIONS, REVENUE_PERMISSIONS } from '../constants/permissions.js';
import { getSettings } from '../services/settings.service.js';

const phoneSchema = z.string().max(15).trim().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number');

export const schemas = {
  sendOtp: z.object({ phone: phoneSchema, mode: z.enum(['login', 'signup']).optional() }),
  verifyOtp: z.object({
    phone: phoneSchema,
    otp: z.string().trim().length(6),
    mode: z.enum(['login', 'signup']).optional(),
    name: z.string().trim().min(2, 'Enter your full name').max(80).optional(),
    email: z.string().trim().toLowerCase().email('Enter a valid email').max(120).optional().or(z.literal('')),
  }),
  vendorRegister: z.object({
    name: z.string().trim().min(2),
    email: z.string().trim().email(),
    phone: phoneSchema,
    password: z.string().min(8, 'Password must be at least 8 characters').max(72).regex(/[A-Za-z]/, 'Include a letter').regex(/\d/, 'Include a number'),
    businessName: z.string().trim().min(2),
  }),
  login: z.object({ email: z.string().trim().toLowerCase().email().max(120), password: z.string().min(1).max(72) }),
};

// ── Guest (customer) ──
/**
 * Guest auth has two tabs in the apps:  Login (existing account)  /  Sign up (new account).
 * `mode` is optional for backward compatibility; without it the old "login or auto-create" behaviour applies.
 */
export async function userSendOtp(req, res) {
  const { phone, mode } = req.body;
  if (mode) {
    const exists = await User.exists({ phone });
    if (mode === 'login' && !exists) throw ApiError.notFound('No account found with this number. Please sign up first.');
    if (mode === 'signup' && exists) throw ApiError.conflict('This number is already registered. Please log in.');
  }
  const out = await sendOtp(phone);
  ok(res, out, undefined, 'OTP sent');
}

export async function userVerifyOtp(req, res) {
  const { phone, otp, name, email, mode } = req.body;
  if (mode === 'signup' && !name) throw ApiError.badRequest('Enter your full name to create an account');
  if (mode === 'signup' && (await getSettings()).auth?.emailField === 'required' && !email) throw ApiError.badRequest('Email address is required');
  await verifyOtp(phone, otp);
  let user = await User.findOne({ phone });
  if (mode === 'login' && !user) throw ApiError.notFound('No account found with this number. Please sign up first.');
  if (mode === 'signup' && user) throw ApiError.conflict('This number is already registered. Please log in.');
  const isNew = !user;
  if (!user) user = await User.create({ phone, name: name || '', email: email || undefined });
  if (user.status === 'blocked') throw ApiError.forbidden('Your account has been blocked. Please contact support.');
  user.lastLoginAt = new Date();
  await user.save();
  ok(res, { ...(await issueSession(req, res, 'user', user._id)), user, isNew });
}

export async function userMe(req, res) {
  ok(res, req.user);
}

// ── Vendor ──
export async function vendorRegister(req, res) {
  if (await Vendor.exists({ email: req.body.email })) throw ApiError.conflict('An account with this email already exists');
  const vendor = await Vendor.create(req.body);
  await notify({ recipientType: 'admin', title: 'New vendor registration', body: `${vendor.businessName} (${vendor.email}) registered and has to complete their profile`, type: 'vendor_pending', data: { vendorId: vendor._id } });
  created(res, { ...(await issueSession(req, res, 'vendor', vendor._id)), vendor: vendorView(vendor) }, 'Registered — complete your business profile to get approved');
}

export async function vendorLogin(req, res) {
  const vendor = await Vendor.findOne({ email: req.body.email }).select('+password');
  if (!vendor || !(await vendor.checkPassword(req.body.password))) throw ApiError.unauthorized('Invalid email or password');
  if (vendor.status === 'suspended') throw ApiError.forbidden('Your vendor account is suspended');
  vendor.lastLoginAt = new Date();
  await vendor.save();
  ok(res, { ...(await issueSession(req, res, 'vendor', vendor._id)), vendor: vendorView(vendor) });
}

export async function vendorMe(req, res) {
  ok(res, vendorView(req.vendor));
}

// ── Admin / Sub-admin ──
export async function adminLogin(req, res) {
  const admin = await Admin.findOne({ email: req.body.email }).select('+password');
  if (!admin || !(await admin.checkPassword(req.body.password))) throw ApiError.unauthorized('Invalid email or password');
  if (admin.status !== 'active') throw ApiError.forbidden('Your admin account is suspended');
  admin.lastLoginAt = new Date();
  await admin.save();
  const a = admin.toObject();
  delete a.password;
  ok(res, { ...(await issueSession(req, res, 'admin', admin._id)), admin: { ...a, effectivePermissions: effectivePermissions(admin) } });
}

export const effectivePermissions = (admin) =>
  admin.role === 'master' ? Object.keys(PERMISSIONS) : admin.permissions.filter((p) => !REVENUE_PERMISSIONS.includes(p));

export async function adminMe(req, res) {
  ok(res, { ...req.admin.toObject(), effectivePermissions: effectivePermissions(req.admin) });
}

export async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 8 || newPassword.length > 72 || !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) throw ApiError.badRequest('New password must be 8–72 characters with a letter and a number');
  const Model = req.admin ? Admin : Vendor;
  const acc = await Model.findById((req.admin || req.vendor)._id).select('+password');
  if (!(await acc.checkPassword(currentPassword || ''))) throw ApiError.badRequest('Current password is incorrect');
  acc.password = newPassword;
  await acc.save();
  // Sign out every other device; this one keeps its session
  await revokeAllSessions(req.admin ? 'admin' : 'vendor', acc._id, { exceptReq: req, reason: 'password_change' });
  ok(res, null, undefined, 'Password updated — other devices have been signed out');
}

// ── Sessions (all audiences) ──
/** POST /auth/:type/refresh — web: httpOnly cookie, app: { refreshToken } → new access (+ rotated refresh) token */
export const refresh = (type) => async (req, res) => ok(res, await rotateSession(req, res, type));

/** POST /auth/:type/logout — revokes this device's refresh token. Works with an expired access token. */
export const logout = (type) => async (req, res) => { await revokeSession(req, res, type); ok(res, null, undefined, 'Signed out'); };

/** POST /auth/:type/logout-all — signs the account out on every device (requires a valid access token). */
export const logoutAll = (type) => async (req, res) => {
  const n = await revokeAllSessions(type, req[type]._id);
  await revokeSession(req, res, type);
  ok(res, { revoked: n }, undefined, 'Signed out on all devices');
};

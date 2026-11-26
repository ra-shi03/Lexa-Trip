import { Router } from 'express';
import { loginLimiter, otpLimiter, otpIpLimiter, refreshLimiter } from '../middlewares/security.js';
import * as c from '../controllers/auth.controller.js';
import { validate } from '../middlewares/validate.js';
import { requireUser, requireVendor, requireAdmin } from '../middlewares/auth.js';

const r = Router();
// Guest
r.post('/user/send-otp', otpIpLimiter, otpLimiter, validate(c.schemas.sendOtp), c.userSendOtp);
r.post('/user/verify-otp', otpIpLimiter, loginLimiter, validate(c.schemas.verifyOtp), c.userVerifyOtp);
r.get('/user/me', requireUser, c.userMe);

// Vendor
r.post('/vendor/register', loginLimiter, validate(c.schemas.vendorRegister), c.vendorRegister);
r.post('/vendor/login', loginLimiter, validate(c.schemas.login), c.vendorLogin);
r.get('/vendor/me', requireVendor, c.vendorMe);
r.post('/vendor/change-password', requireVendor, c.changePassword);

// Admin & sub-admin
r.post('/admin/login', loginLimiter, validate(c.schemas.login), c.adminLogin);
r.get('/admin/me', requireAdmin, c.adminMe);
r.post('/admin/change-password', requireAdmin, c.changePassword);

// Sessions: short-lived access token + rotating refresh token (cookie on web, body on the app)
const GUARD = { user: requireUser, vendor: requireVendor, admin: requireAdmin };
for (const type of ['user', 'vendor', 'admin']) {
  r.post(`/${type}/refresh`, refreshLimiter, c.refresh(type));
  r.post(`/${type}/logout`, c.logout(type));
  r.post(`/${type}/logout-all`, GUARD[type], c.logoutAll(type));
}

export default r;

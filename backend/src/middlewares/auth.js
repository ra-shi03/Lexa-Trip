import { ApiError } from '../utils/ApiError.js';
import User from '../models/User.js';
import Vendor from '../models/Vendor.js';
import Admin from '../models/Admin.js';
import { verifyAccessToken } from '../services/token.service.js';
import { onboarding, isProfileLocked } from '../services/vendorOnboarding.service.js';

const MODELS = { user: User, vendor: Vendor, admin: Admin };

function readToken(req) {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
}

async function resolve(req, type) {
  const token = readToken(req);
  if (!token) return null;
  let payload;
  try {
    payload = verifyAccessToken(token, type);
  } catch (e) {
    // TOKEN_EXPIRED → the client silently renews via POST /auth/<type>/refresh and retries
    throw new ApiError(401, 'Session expired, please sign in again', { code: e.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID' });
  }
  if (payload.type !== type) return null;
  const account = await MODELS[type].findById(payload.id);
  if (!account) throw ApiError.unauthorized();
  if (['suspended', 'blocked', 'inactive'].includes(account.status)) {
    throw ApiError.forbidden('Your account is not active. Please contact support.');
  }
  return account;
}

/** Customer (guest app) authentication */
export const requireUser = async (req, _res, next) => {
  const user = await resolve(req, 'user');
  if (!user) throw ApiError.unauthorized();
  req.user = user;
  next();
};

/** Attaches the user if a valid token is present, otherwise continues anonymously. */
export const optionalUser = async (req, _res, next) => {
  try {
    req.user = (await resolve(req, 'user')) || undefined;
  } catch {
    req.user = undefined;
  }
  next();
};

export const requireVendor = async (req, _res, next) => {
  const vendor = await resolve(req, 'vendor');
  if (!vendor) throw ApiError.unauthorized();
  req.vendor = vendor;
  next();
};

/** Verified details are read-only after approval. */
export const requireEditableProfile = (req, _res, next) => {
  if (isProfileLocked(req.vendor)) throw ApiError.forbidden('Your account is approved, so business details, bank and documents are locked. Contact support to change them.');
  next();
};

/** The one exception for documents: the admin rejected one and wants it again. */
export const requireDocumentSlot = (req, res, next) => {
  if (isProfileLocked(req.vendor) && !req.vendor.documents.some((d) => d.status === 'rejected')) return requireEditableProfile(req, res, next);
  return next();
};

/** Properties, inventory, bookings and money screens open only after admin approval. */
export const requireApprovedVendor = (req, _res, next) => {
  if (req.vendor?.status !== 'approved') {
    const { stage } = onboarding(req.vendor);
    throw ApiError.forbidden(stage === 'review' ? 'Your profile is under review. This opens after admin approval.' : 'Complete your business profile and get it approved first');
  }
  next();
};

export const requireAdmin = async (req, _res, next) => {
  const admin = await resolve(req, 'admin');
  if (!admin) throw ApiError.unauthorized();
  req.admin = admin;
  next();
};

import { ApiError } from '../utils/ApiError.js';
import User from '../models/User.js';
import Vendor from '../models/Vendor.js';
import Admin from '../models/Admin.js';
import { verifyAccessToken } from '../services/token.service.js';

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

/** Vendor must be approved for operations that affect live inventory. */
export const requireApprovedVendor = (req, _res, next) => {
  if (req.vendor?.status !== 'approved') {
    throw ApiError.forbidden('Your vendor account is awaiting admin approval');
  }
  next();
};

export const requireAdmin = async (req, _res, next) => {
  const admin = await resolve(req, 'admin');
  if (!admin) throw ApiError.unauthorized();
  req.admin = admin;
  next();
};

import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import RefreshToken from '../models/RefreshToken.js';
import User from '../models/User.js';
import Vendor from '../models/Vendor.js';
import Admin from '../models/Admin.js';

/**
 * Sessions = short-lived access JWT (Authorization: Bearer) + long-lived opaque refresh token.
 *  - web  (X-Client: web): refresh token lives in an httpOnly, SameSite=Strict cookie scoped to /api/v1/auth/<type>
 *                          → page JavaScript can never read it.
 *  - app  (X-Client: app): refresh token is returned in the body; the app keeps it in secure storage.
 * Refresh tokens rotate on every use; reuse of a rotated token revokes that device's whole chain.
 */
export const ACCOUNT_TYPES = ['user', 'vendor', 'admin'];
const MODELS = { user: User, vendor: Vendor, admin: Admin };
const INACTIVE = ['suspended', 'blocked', 'inactive'];
const JWT_OPTS = { issuer: 'lexatrip' };
const RACE_GRACE_MS = 20_000; // two tabs refreshing at the same moment is not theft

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const newRaw = () => crypto.randomBytes(48).toString('base64url');
export const cookieName = (type) => `lt_rt_${type}`;
const cookiePath = (type) => `/api/v1/auth/${type}`;
const isApp = (req) => String(req.get('x-client') || '').toLowerCase() === 'app';

/** Audience = account type, so a guest token can never be replayed against admin/vendor APIs. */
export function signAccessToken(id, type) {
  return jwt.sign({ id: String(id), type }, env.jwtSecret, { ...JWT_OPTS, algorithm: 'HS256', audience: type, expiresIn: env.auth.accessTtl });
}

export function verifyAccessToken(token, type) {
  return jwt.verify(token, env.jwtSecret, { ...JWT_OPTS, algorithms: ['HS256'], audience: type });
}

/** Reads the refresh token from the body (app) or the audience cookie (web). */
export function readRefreshToken(req, type) {
  const fromBody = typeof req.body?.refreshToken === 'string' ? req.body.refreshToken : '';
  if (fromBody) return fromBody.slice(0, 200);
  const raw = req.headers.cookie || '';
  const name = cookieName(type);
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim()).slice(0, 200);
  }
  return '';
}

async function createRefresh(type, accountId, family, req) {
  const raw = newRaw();
  const expiresAt = new Date(Date.now() + env.auth.refreshDays[type] * 86_400_000);
  await RefreshToken.create({
    tokenHash: sha256(raw), accountType: type, account: accountId, family, expiresAt,
    client: isApp(req) ? 'app' : 'web', userAgent: String(req.get('user-agent') || '').slice(0, 300), ip: req.ip,
  });
  return { raw, expiresAt };
}

/** Puts the refresh token where the client expects it and returns the token fields for the JSON body. */
function deliver(req, res, type, accountId, refresh) {
  const accessToken = signAccessToken(accountId, type);
  const { exp } = jwt.decode(accessToken);
  const out = { token: accessToken, accessToken, expiresIn: exp - Math.floor(Date.now() / 1000) }; // `token` kept for older clients
  if (isApp(req)) {
    out.refreshToken = refresh.raw;
    out.refreshExpiresAt = refresh.expiresAt;
  } else {
    res.cookie(cookieName(type), refresh.raw, { httpOnly: true, secure: env.isProd, sameSite: 'strict', path: cookiePath(type), expires: refresh.expiresAt });
  }
  return out;
}

export function clearRefreshCookie(res, type) {
  res.clearCookie(cookieName(type), { httpOnly: true, secure: env.isProd, sameSite: 'strict', path: cookiePath(type) });
}

/** New sign-in → new token family. */
export async function issueSession(req, res, type, accountId) {
  const refresh = await createRefresh(type, accountId, crypto.randomUUID(), req);
  return deliver(req, res, type, accountId, refresh);
}

/** Exchanges a refresh token for a new access + refresh token (rotation with reuse detection). */
export async function rotateSession(req, res, type) {
  const raw = readRefreshToken(req, type);
  const fail = (code = 'REFRESH_INVALID') => { clearRefreshCookie(res, type); return new ApiError(401, 'Your session has expired. Please sign in again.', { code }); };
  if (!raw) throw fail();
  const doc = await RefreshToken.findOne({ tokenHash: sha256(raw) });
  if (!doc || doc.accountType !== type) throw fail();
  const now = new Date();

  if (doc.revokedAt) {
    // Concurrent refresh from another tab/request: the token was rotated moments ago — not an attack.
    if (doc.revokedReason === 'rotated' && now - doc.revokedAt < RACE_GRACE_MS) throw new ApiError(401, 'Session was just renewed', { code: 'REFRESH_RACE' });
    if (doc.revokedReason === 'rotated') await RefreshToken.updateMany({ family: doc.family, revokedAt: null }, { revokedAt: now, revokedReason: 'reuse' });
    throw fail();
  }
  if (doc.expiresAt <= now) throw fail('REFRESH_EXPIRED');

  const account = await MODELS[type].findById(doc.account).select('status').lean();
  if (!account || INACTIVE.includes(account.status)) {
    await RefreshToken.updateMany({ family: doc.family, revokedAt: null }, { revokedAt: now, revokedReason: 'logout_all' });
    throw fail('ACCOUNT_INACTIVE');
  }

  const raw2 = newRaw();
  // Atomic claim: only one concurrent request can rotate a given token
  const claimed = await RefreshToken.findOneAndUpdate(
    { _id: doc._id, revokedAt: null },
    { revokedAt: now, revokedReason: 'rotated', replacedBy: sha256(raw2) },
  );
  if (!claimed) throw new ApiError(401, 'Session was just renewed', { code: 'REFRESH_RACE' });
  const expiresAt = new Date(Date.now() + env.auth.refreshDays[type] * 86_400_000);
  await RefreshToken.create({
    tokenHash: sha256(raw2), accountType: type, account: doc.account, family: doc.family, expiresAt,
    client: doc.client, userAgent: String(req.get('user-agent') || '').slice(0, 300), ip: req.ip,
  });
  return deliver(req, res, type, doc.account, { raw: raw2, expiresAt });
}

/** Logout on this device: revokes the presented token's family. Always succeeds (idempotent). */
export async function revokeSession(req, res, type) {
  const raw = readRefreshToken(req, type);
  if (raw) {
    const doc = await RefreshToken.findOne({ tokenHash: sha256(raw), accountType: type }).select('family').lean();
    if (doc) await RefreshToken.updateMany({ family: doc.family, revokedAt: null }, { revokedAt: new Date(), revokedReason: 'logout' });
  }
  clearRefreshCookie(res, type);
}

/** Logout everywhere (or everywhere except the current device, e.g. after a password change). */
export async function revokeAllSessions(type, accountId, { exceptReq, reason = 'logout_all' } = {}) {
  let exceptFamily;
  if (exceptReq) {
    const raw = readRefreshToken(exceptReq, type);
    if (raw) exceptFamily = (await RefreshToken.findOne({ tokenHash: sha256(raw), accountType: type }).select('family').lean())?.family;
  }
  const filter = { accountType: type, account: accountId, revokedAt: null, ...(exceptFamily ? { family: { $ne: exceptFamily } } : {}) };
  const r = await RefreshToken.updateMany(filter, { revokedAt: new Date(), revokedReason: reason });
  return r.modifiedCount;
}

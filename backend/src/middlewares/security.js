import mongoose from 'mongoose';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { ApiError } from '../utils/ApiError.js';

import { env } from '../config/env.js';

const rl = env.rateLimit;
const json = (message) => ({ success: false, message });
const base = { standardHeaders: true, legacyHeaders: false, skip: () => !rl.enabled };
const win = rl.windowSec * 1000;
const make = (opts) => rateLimit({ ...base, ...opts });

/**
 * Rate limiters — all limits come from .env (RATE_LIMIT_*). The default store is per-process memory.
 * With several Node instances plug a shared store (Redis) so limits are global — see docs/SECURITY-AND-SCALING.md.
 */
export const globalLimiter = make({ windowMs: win, limit: rl.global, message: json('Too many requests. Please slow down.') });

/** Stricter cap for anything that changes data */
export const writeLimiter = make({
  windowMs: win, limit: rl.write, skip: (req) => !rl.enabled || ['GET', 'HEAD', 'OPTIONS'].includes(req.method),
  message: json('Too many changes in a short time. Please wait a moment.'),
});

/** Login brute-force protection: per IP + account identifier (email / phone); successful logins don't count */
export const loginLimiter = make({
  windowMs: rl.loginWindowMin * 60_000, limit: rl.loginMax, skipSuccessfulRequests: true,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip)}|${String(req.body?.email || req.body?.phone || '').toLowerCase()}`,
  message: json(`Too many failed attempts. Try again in ${rl.loginWindowMin} minutes.`),
});

/** OTP: limits SMS cost abuse — per phone and per IP */
export const otpLimiter = make({
  windowMs: rl.otpWindowMin * 60_000, limit: rl.otpMax,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip)}|${String(req.body?.phone || '')}`,
  message: json('Too many OTP requests. Try again later.'),
});
export const otpIpLimiter = make({ windowMs: 60 * 60_000, limit: rl.otpIpMax, message: json('Too many OTP requests from this network.') });

export const uploadLimiter = make({ windowMs: 10 * 60_000, limit: rl.uploadMax, message: json('Upload limit reached. Try again shortly.') });
export const aiLimiter = make({ windowMs: win, limit: rl.aiMax, message: json('Lexa AI is getting a lot of questions — please wait a moment.') });

const ID_PARAMS = ['id', 'roomId', 'ruleId', 'bookingId', 'propertyId', 'docId', 'cityId'];
/** Rejects malformed ObjectIds early (400) instead of a CastError deep in a query. */
export function validateObjectIdParams(router) {
  const check = (_req, _res, next, value, name) => {
    if (!mongoose.isValidObjectId(value) || String(value).length !== 24) return next(ApiError.badRequest(`Invalid ${name}`));
    return next();
  };
  for (const name of ID_PARAMS) router.param(name, check);
}

/** Keeps array/object query values from reaching handlers that expect strings (parameter pollution) */
export function flattenQuery(req, _res, next) {
  for (const [k, v] of Object.entries(req.query)) {
    if (Array.isArray(v)) req.query[k] = v[v.length - 1];
    else if (v && typeof v === 'object') delete req.query[k];
  }
  next();
}

/** API responses are never cached by browsers/CDNs (they contain private data) */
export const noStore = (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); };

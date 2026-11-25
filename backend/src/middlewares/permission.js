import { ApiError } from '../utils/ApiError.js';
import { REVENUE_FIELDS, REVENUE_PERMISSIONS } from '../constants/permissions.js';

/**
 * Permission guard for admin routes.
 * - master admin: always allowed
 * - sub-admin: allowed only if the permission was granted, and NEVER for revenue permissions
 */
export const can = (...perms) => (req, _res, next) => {
  const a = req.admin;
  if (!a) throw ApiError.unauthorized();
  if (a.role === 'master') return next();
  const blocked = perms.some((p) => REVENUE_PERMISSIONS.includes(p));
  if (blocked) throw ApiError.forbidden('Revenue data is restricted to the master admin');
  const allowed = perms.some((p) => a.permissions.includes(p));
  if (!allowed) throw ApiError.forbidden();
  next();
};

export const masterOnly = (req, _res, next) => {
  if (req.admin?.role !== 'master') throw ApiError.forbidden('Only the master admin can do this');
  next();
};

/**
 * Response filter: when the requester is a sub-admin, revenue fields are
 * stripped from every JSON payload (deeply). Defence-in-depth on top of `can()`.
 */
export const stripRevenueForSubadmin = (req, res, next) => {
  if (!req.admin || req.admin.role === 'master') return next();
  const json = res.json.bind(res);
  res.json = (body) => json(scrub(body));
  next();
};

function scrub(value) {
  if (Array.isArray(value)) return value.map(scrub);
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const src = typeof value.toJSON === 'function' ? value.toJSON() : value;
    if (src !== value) return scrub(src);
    const out = {};
    for (const [k, v] of Object.entries(src)) {
      if (REVENUE_FIELDS.includes(k)) continue;
      out[k] = scrub(v);
    }
    return out;
  }
  return value;
}

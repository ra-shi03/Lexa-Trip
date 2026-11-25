import { AuditLog } from '../models/Misc.js';

/** Fire-and-forget audit trail for admin / vendor actions. */
export function audit(req, action, entity, entityId, meta) {
  const actor = req.admin || req.vendor || req.user;
  const actorType = req.admin ? `admin:${req.admin.role}` : req.vendor ? 'vendor' : req.user ? 'user' : 'system';
  AuditLog.create({
    actorType,
    actor: actor?._id,
    actorName: actor?.name || actor?.email,
    action,
    entity,
    entityId,
    meta,
  }).catch((e) => console.error('[audit]', e.message));
}

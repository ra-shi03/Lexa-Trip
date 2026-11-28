import { firebaseConfigured, firebaseProjectId, firebaseAccessToken } from '../config/firebase.js';
import PushToken from '../models/PushToken.js';
import Admin from '../models/Admin.js';
import { ApiError } from '../utils/ApiError.js';

/** Push notifications through Firebase Cloud Messaging (HTTP v1). Connection setup: config/firebase.js */
const MAX_DEVICES = 10; // newest devices per account

export const pushConfigured = firebaseConfigured;

/** Returns 'sent', 'gone' (token no longer valid → delete it) or an error message */
export async function sendToToken(device, { title, body, link }) {
  const data = { title: String(title || ''), body: String(body || ''), link: link || '/' };
  // Web gets data only (our service worker draws it); native apps need a `notification` block
  const message = { token: device.token, data, ...(device.platform === 'web' ? { webpush: { headers: { Urgency: 'high', TTL: '86400' } } } : { notification: { title: data.title, body: data.body } }) };
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${firebaseProjectId()}/messages:send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await firebaseAccessToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
    signal: AbortSignal.timeout(10_000),
  });
  if (res.ok) return 'sent';
  const err = (await res.json().catch(() => ({}))).error || {};
  const code = err.details?.find((d) => d.errorCode)?.errorCode;
  if (code === 'UNREGISTERED' || code === 'SENDER_ID_MISMATCH' || (res.status === 400 && /registration token/i.test(err.message || ''))) return 'gone';
  return err.message || `FCM returned ${res.status}`;
}

async function deliver(devices, message) {
  const results = await Promise.all(devices.map((d) => sendToToken(d, message).catch((e) => e.message)));
  const gone = devices.filter((_, i) => results[i] === 'gone').map((d) => d._id);
  if (gone.length) await PushToken.deleteMany({ _id: { $in: gone } });
  const failed = results.find((r) => r !== 'sent' && r !== 'gone');
  if (failed) console.error('[push]', failed);
  return { sent: results.filter((r) => r === 'sent').length, failed };
}

/** Push to every device of one account; no `recipient` = all active admins (same audience as the in-app list). */
export async function sendPush({ recipientType, recipient, title, body, link }) {
  if (!pushConfigured()) return;
  const who = recipient ? { recipient } : recipientType === 'admin' ? { recipient: { $in: await Admin.find({ status: 'active' }).distinct('_id') } } : null;
  if (!who) return;
  const devices = await PushToken.find({ recipientType, ...who }).sort({ updatedAt: -1 }).limit(recipient ? MAX_DEVICES : 200).lean();
  if (devices.length) await deliver(devices, { title, body, link });
}

/** Express handlers for /push-token in the user, vendor and admin routers */
export function pushHandlers(recipientType, accountOf) {
  const read = (req) => {
    const token = String(req.body?.token || '');
    if (token.length < 20 || token.length > 4096) throw ApiError.badRequest('Invalid device token');
    return token;
  };
  return {
    async register(req, res) {
      const token = read(req);
      const platform = ['android', 'ios'].includes(req.body.platform) ? req.body.platform : 'web';
      const recipient = accountOf(req)._id;
      await PushToken.findOneAndUpdate({ token, recipientType }, { recipient, platform, updatedAt: new Date() }, { upsert: true });
      res.json({ success: true, data: null });
    },
    async remove(req, res) {
      await PushToken.deleteOne({ token: read(req), recipientType, recipient: accountOf(req)._id });
      res.json({ success: true, data: null });
    },
  };
}

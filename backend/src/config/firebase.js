import fs from 'node:fs';
import crypto from 'node:crypto';
import { env } from './env.js';

/**
 * Firebase connection for the server (used for Cloud Messaging), without the admin SDK.
 * FIREBASE_SERVICE_ACCOUNT = the service-account key as inline JSON, base64 JSON, or a path to the .json file.
 */
const SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
let key;
let access = null;

function loadKey() {
  if (key !== undefined) return key;
  const raw = env.firebase.serviceAccount?.trim();
  key = null;
  if (!raw) return key;
  try {
    const json = raw.startsWith('{') ? raw : fs.existsSync(raw) ? fs.readFileSync(raw, 'utf8') : Buffer.from(raw, 'base64').toString('utf8');
    const parsed = JSON.parse(json);
    if (parsed.project_id && parsed.client_email && parsed.private_key) key = parsed;
  } catch { console.warn('[firebase] FIREBASE_SERVICE_ACCOUNT could not be read'); }
  return key;
}

export const firebaseConfigured = () => Boolean(loadKey());
export const firebaseProjectId = () => loadKey()?.project_id;

/** Short-lived Google OAuth token for the service account (cached until a minute before expiry) */
export async function firebaseAccessToken() {
  if (access && access.exp > Date.now() + 60_000) return access.value;
  const k = loadKey();
  if (!k) throw new Error('Firebase is not configured (FIREBASE_SERVICE_ACCOUNT)');
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({ iss: k.client_email, scope: SCOPE, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })}`;
  const sig = crypto.createSign('RSA-SHA256').update(unsigned).sign(k.private_key, 'base64url');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${sig}` }),
    signal: AbortSignal.timeout(10_000),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || 'Google auth failed');
  access = { value: data.access_token, exp: Date.now() + data.expires_in * 1000 };
  return access.value;
}

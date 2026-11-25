import fs from 'node:fs';
import crypto from 'node:crypto';
import { env } from '../../config/env.js';
import { SitemapLog } from '../../models/seo/Revision.js';

/**
 * Google Search Console integration via a service account (no SDK).
 * Setup (one-time, by the client):
 *  1. Create a Google Cloud service account + JSON key, enable "Google Search Console API".
 *  2. In Search Console → Settings → Users and permissions, add the service-account email as Owner.
 *  3. Set GSC_SERVICE_ACCOUNT_FILE and GSC_SITE_URL in backend/.env.
 * Ownership verification itself is done with the meta tag configured in Admin → SEO → Settings.
 */
const SCOPE = 'https://www.googleapis.com/auth/webmasters';
let token = null;

function loadKey() {
  if (!env.gsc.serviceAccountFile || !env.gsc.siteUrl) return null;
  try {
    return JSON.parse(fs.readFileSync(env.gsc.serviceAccountFile, 'utf8'));
  } catch {
    return null;
  }
}

export const gscConfigured = () => Boolean(loadKey());

async function accessToken() {
  if (token && token.exp > Date.now() + 60_000) return token.value;
  const key = loadKey();
  if (!key) throw new Error('Search Console is not configured (GSC_SERVICE_ACCOUNT_FILE / GSC_SITE_URL)');
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({ iss: key.client_email, scope: SCOPE, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })}`;
  const sig = crypto.createSign('RSA-SHA256').update(unsigned).sign(key.private_key, 'base64url');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${sig}` }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || 'Google auth failed');
  token = { value: data.access_token, exp: Date.now() + data.expires_in * 1000 };
  return token.value;
}

const api = (path) => `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(env.gsc.siteUrl)}${path}`;

export async function submitSitemap(adminId) {
  const feed = `${env.siteUrl}/sitemap.xml`;
  try {
    const res = await fetch(api(`/sitemaps/${encodeURIComponent(feed)}`), { method: 'PUT', headers: { Authorization: `Bearer ${await accessToken()}` } });
    if (!res.ok) throw new Error(`Search Console returned ${res.status}`);
    await SitemapLog.create({ action: 'submitted', message: feed, by: adminId });
    return { ok: true, message: `Submitted ${feed} to Search Console` };
  } catch (e) {
    await SitemapLog.create({ action: 'error', message: e.message, by: adminId });
    return { ok: false, message: e.message };
  }
}

export async function listSitemaps() {
  const res = await fetch(api('/sitemaps'), { headers: { Authorization: `Bearer ${await accessToken()}` } });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || 'Search Console error');
  return data.sitemap || [];
}

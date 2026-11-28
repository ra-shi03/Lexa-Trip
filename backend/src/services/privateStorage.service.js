import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { storageStatus } from './storage.service.js';

/**
 * Private files (vendor KYC documents). Unlike services/storage.service.js there is NO public URL: a file is only
 * readable through an authenticated endpoint that calls `readPrivateFile`. Follows the same Image setting:
 *  - local:      a folder that is never served — `backend/private-uploads`, `/var/www/private-uploads` in production
 *  - cloudinary: `authenticated` delivery type, which can't be fetched without a signature made with the API secret
 * The stored key remembers where the file went: `local:<name>` or `cloudinary:<resourceType>:<format>:<publicId>`.
 */
export const PRIVATE_DIR = env.isProd ? '/var/www/private-uploads' : path.resolve('private-uploads');

export const MIME_BY_EXT = { webp: 'image/webp', jpg: 'image/jpeg', png: 'image/png', pdf: 'application/pdf' };

const sign = (params) => crypto.createHash('sha1')
  .update(Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join('&') + env.cloudinary.apiSecret)
  .digest('hex');
const apiUrl = (resource, action) => `https://api.cloudinary.com/v1_1/${encodeURIComponent(env.cloudinary.cloudName)}/${resource}/${action}`;
const stamp = () => Math.floor(Date.now() / 1000);
const call = (url, init) => fetch(url, { signal: AbortSignal.timeout(60_000), ...init })
  .catch((e) => { throw new ApiError(502, `Could not reach Cloudinary: ${e.message}`); });

/** Stores a staged upload under a random name and returns its key. */
export async function storePrivate(file) {
  const ext = path.extname(file.filename).slice(1).toLowerCase().replace('jpeg', 'jpg');
  const name = crypto.randomBytes(24).toString('hex');
  const { active } = await storageStatus();
  if (active === 'cloudinary') {
    const params = { public_id: name, timestamp: stamp(), type: 'authenticated' };
    const body = new FormData();
    body.append('file', new Blob([await fs.promises.readFile(file.path)], { type: file.mimetype }), `${name}.${ext}`);
    for (const [k, v] of Object.entries(params)) body.append(k, String(v));
    body.append('api_key', env.cloudinary.apiKey);
    body.append('signature', sign(params));
    const res = await call(apiUrl('auto', 'upload'), { method: 'POST', body });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.public_id) throw new ApiError(502, `Cloudinary rejected the upload: ${data.error?.message || res.status}`);
    return `cloudinary:${data.resource_type}:${data.format || ext}:${data.public_id}`;
  }
  try {
    await fs.promises.mkdir(PRIVATE_DIR, { recursive: true, mode: 0o700 });
    const target = path.join(PRIVATE_DIR, `${name}.${ext}`);
    await fs.promises.copyFile(file.path, target);
    await fs.promises.chmod(target, 0o600);
  } catch (e) {
    throw new ApiError(500, `Could not save to ${PRIVATE_DIR}: ${e.message}`);
  }
  return `local:${name}.${ext}`;
}

export async function readPrivateFile(key = '') {
  const [provider, ...rest] = key.split(':');
  if (provider === 'local') {
    return fs.promises.readFile(path.join(PRIVATE_DIR, path.basename(rest[0]))).catch(() => { throw ApiError.notFound('File not found'); });
  }
  if (provider === 'cloudinary') {
    const [resource, format, publicId] = rest;
    const params = { format, public_id: publicId, timestamp: stamp(), type: 'authenticated' };
    const query = new URLSearchParams({ ...params, api_key: env.cloudinary.apiKey, signature: sign(params) });
    const res = await call(`${apiUrl(resource, 'download')}?${query}`);
    if (!res.ok) throw new ApiError(502, `Could not read the file from Cloudinary (${res.status})`);
    return Buffer.from(await res.arrayBuffer());
  }
  throw ApiError.notFound('File not found');
}

/** Best effort — a replaced document should not linger. */
export async function removePrivateFile(key = '') {
  const [provider, ...rest] = key.split(':');
  try {
    if (provider === 'local') await fs.promises.rm(path.join(PRIVATE_DIR, path.basename(rest[0])), { force: true });
    if (provider === 'cloudinary') {
      const [resource, , publicId] = rest;
      const params = { public_id: publicId, timestamp: stamp(), type: 'authenticated' };
      await call(apiUrl(resource, 'destroy'), { method: 'POST', body: new URLSearchParams({ ...params, api_key: env.cloudinary.apiKey, signature: sign(params) }) });
    }
  } catch (e) {
    console.warn(`[storage] could not remove a private file: ${e.message}`);
  }
}

/** Sends a private file to an already-authorised requester; never cached, never sniffed. */
export async function sendPrivateFile(res, doc) {
  if (!doc?.file) throw ApiError.notFound('File not found');
  const buffer = await readPrivateFile(doc.file);
  res.set({ 'Content-Type': doc.mime, 'Content-Disposition': 'inline', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
  res.send(buffer);
}

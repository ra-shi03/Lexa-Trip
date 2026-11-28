import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { getSettings } from './settings.service.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Where uploaded images and documents end up (Admin → Developer → Image setting):
 *  - local:      this server's disk — `backend/uploads` in development, `/var/www/uploads` in production
 *  - cloudinary: Cloudinary CDN (keys from .env)
 * The choice is stored per server mode, so a laptop and the live server can share one database
 * and still use different storage. Files are stored flat; switching only affects new uploads.
 */
export const SERVER_MODE = env.isProd ? 'production' : 'development';
export const STORAGE_PROVIDERS = ['local', 'cloudinary'];
export const UPLOAD_DIR = env.isProd ? '/var/www/uploads' : path.resolve('uploads');

// A missing or read-only folder must not stop the server booting (Cloudinary may be in use)
try { fs.mkdirSync(UPLOAD_DIR, { recursive: true }); } catch (e) { console.warn(`[storage] cannot create ${UPLOAD_DIR}: ${e.message}`); }

export const cloudinaryConfigured = () => Boolean(env.cloudinary.cloudName && env.cloudinary.apiKey && env.cloudinary.apiSecret);

function folderWritable() {
  try { fs.accessSync(UPLOAD_DIR, fs.constants.W_OK); return true; } catch { return false; }
}

/** `selected` is what the admin chose; `active` is what new uploads really use. */
export async function storageStatus() {
  const selected = (await getSettings()).storage?.[SERVER_MODE] || 'local';
  const cloudinaryReady = cloudinaryConfigured();
  return {
    mode: SERVER_MODE,
    selected,
    active: selected === 'cloudinary' && cloudinaryReady ? 'cloudinary' : 'local',
    cloudinaryReady,
    folder: env.isProd ? UPLOAD_DIR : 'backend/uploads',
    folderWritable: folderWritable(),
  };
}

async function toCloudinary(file) {
  const { cloudName, apiKey, apiSecret } = env.cloudinary;
  const params = { public_id: path.parse(file.filename).name, timestamp: Math.floor(Date.now() / 1000) };
  // Signed upload: sha1 of the alphabetically ordered params followed by the secret
  const toSign = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join('&');
  const body = new FormData();
  body.append('file', new Blob([await fs.promises.readFile(file.path)], { type: file.mimetype }), file.filename);
  for (const [k, v] of Object.entries(params)) body.append(k, String(v));
  body.append('api_key', apiKey);
  body.append('signature', crypto.createHash('sha1').update(toSign + apiSecret).digest('hex'));

  const res = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/auto/upload`, { method: 'POST', body, signal: AbortSignal.timeout(60_000) })
    .catch((e) => { throw new ApiError(502, `Could not reach Cloudinary: ${e.message}`); });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.secure_url) throw new ApiError(502, `Cloudinary rejected the upload: ${data.error?.message || res.status}`);
  return data.secure_url;
}

async function toDisk(file) {
  const target = path.join(UPLOAD_DIR, file.filename);
  try {
    await fs.promises.mkdir(UPLOAD_DIR, { recursive: true });
    await fs.promises.copyFile(file.path, target); // copy, not rename: the temp folder may be on another disk
  } catch (e) {
    throw new ApiError(500, `Could not save to ${UPLOAD_DIR}: ${e.message}`);
  }
  return `/uploads/${file.filename}`;
}

/** Moves a staged (already compressed) upload to the chosen storage and returns its public URL. */
export async function storeFile(file) {
  const { active } = await storageStatus();
  const url = active === 'cloudinary' ? await toCloudinary(file) : await toDisk(file);
  await fs.promises.rm(file.path, { force: true });
  return url;
}

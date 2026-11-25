import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { getSettings } from './settings.service.js';
import { UPLOAD_DIR } from '../middlewares/upload.js';

/**
 * Brand assets driven by Admin → Theme & branding:
 *  - PWA/app manifest (name, colours) and app icons (resized from the admin-uploaded logo mark)
 * Image source can be an /uploads path, an absolute URL, or a bundled default in backend/public/brand.
 */
const BRAND_DIR = path.resolve('public', 'brand');
const cache = new Map(); // key: `${url}|${size}` → Buffer

async function loadSource(url = '') {
  if (/^https?:\/\//i.test(url)) {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`Logo fetch failed (${res.status})`);
    return Buffer.from(await res.arrayBuffer());
  }
  const clean = path.normalize(decodeURIComponent(url.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  if (clean.startsWith(`${path.sep}uploads${path.sep}`) || clean.startsWith('uploads/')) {
    const file = path.join(UPLOAD_DIR, clean.replace(/^[/\\]?uploads[/\\]/, ''));
    if (file.startsWith(UPLOAD_DIR)) return fs.promises.readFile(file); // path-traversal guard
  }
  return fs.promises.readFile(path.join(BRAND_DIR, path.basename(clean)));
}

export async function brandIcon(size) {
  const s = await getSettings();
  const url = s.brand.markUrl || s.brand.faviconUrl || '/lexatrip-mark.jpg';
  const key = `${url}|${size}`;
  if (cache.has(key)) return cache.get(key);
  let src;
  try { src = await loadSource(url); } catch { src = await fs.promises.readFile(path.join(BRAND_DIR, 'lexatrip-mark.jpg')); }
  const buf = await sharp(src).resize(size, size, { fit: 'cover' }).png().toBuffer();
  if (cache.size > 40) cache.clear();
  cache.set(key, buf);
  return buf;
}

export async function webManifest() {
  const s = await getSettings();
  const v = Math.floor(new Date(s.updatedAt || 0).getTime() / 1000) || 1; // cache-bust icons when branding changes
  const icon = (size, purpose = 'any') => ({ src: `/api/v1/public/brand/icon/${size}.png?v=${v}`, sizes: `${size}x${size}`, type: 'image/png', purpose });
  return {
    name: `${s.brand.appName} — ${s.brand.tagline}`,
    short_name: s.brand.appName,
    description: s.seo?.defaultDescription,
    start_url: '/app', // installed app opens the customer-app experience
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: s.theme.background || '#ffffff',
    theme_color: s.theme.primary || '#F26B1D',
    icons: [icon(192), icon(512), icon(512, 'maskable')],
  };
}

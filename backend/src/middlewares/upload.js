import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { ApiError } from '../utils/ApiError.js';

export const UPLOAD_DIR = path.resolve('uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const sub = new Date().toISOString().slice(0, 7); // yyyy-mm
    const dir = path.join(UPLOAD_DIR, sub);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const base = path
      .basename(file.originalname, ext)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .slice(0, 60);
    cb(null, `${base}-${crypto.randomBytes(4).toString('hex')}${ext}`);
  },
});

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'image/avif'];
const DOC_TYPES = [...IMAGE_TYPES, 'application/pdf'];

const rawImageUpload = multer({
  storage,
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (_req, file, cb) =>
    IMAGE_TYPES.includes(file.mimetype) ? cb(null, true) : cb(ApiError.badRequest('Only image files are allowed')),
});

const rawDocumentUpload = multer({
  storage,
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (_req, file, cb) =>
    DOC_TYPES.includes(file.mimetype) ? cb(null, true) : cb(ApiError.badRequest('Only images or PDF are allowed')),
});

const MAX_DIMENSION = 2000; // px — plenty for hero images, keeps files small
const WEBP_QUALITY = 80;
const KEEP_AS_IS = new Set(['image/svg+xml', 'image/gif', 'application/pdf']); // vectors / animations / documents

/**
 * Compresses every uploaded raster image: auto-rotates (EXIF), strips metadata, resizes to ≤ 2000px
 * and converts to WebP. Originals are deleted; req.file(s) are updated to point at the new file.
 * If compression fails the original upload is kept (never blocks an upload).
 */
async function compressOne(file, { square } = {}) {
  if (KEEP_AS_IS.has(file.mimetype)) return;
  const out = file.path.replace(/\.[^.]+$/, '') + '.webp';
  try {
    await sharp(file.path, { failOn: 'none' }).rotate().resize(square ? { width: square, height: square, fit: 'cover', position: 'attention' } : { width: MAX_DIMENSION, height: MAX_DIMENSION, fit: 'inside', withoutEnlargement: true }).webp({ quality: WEBP_QUALITY, effort: 4 }).toFile(out + '.tmp');
    const { size } = fs.statSync(out + '.tmp');
    if (size >= file.size && file.mimetype === 'image/webp') { fs.unlinkSync(out + '.tmp'); return; } // already optimal
    fs.renameSync(out + '.tmp', out);
    if (out !== file.path) fs.unlinkSync(file.path);
    Object.assign(file, { path: out, filename: path.basename(out), mimetype: 'image/webp', originalSize: file.size, size });
  } catch (e) {
    console.warn('[upload] compression skipped:', e.message);
    fs.rmSync(out + '.tmp', { force: true });
  }
}

export async function compressUploads(req, _res, next) {
  try {
    const files = [...(req.file ? [req.file] : []), ...(Array.isArray(req.files) ? req.files : [])];
    await Promise.all(files.map(compressOne));
    next();
  } catch (e) { next(e); }
}

/** Same API as multer (`.single` / `.array`) but returns [multer, compress] — Express flattens middleware arrays. */
const withCompression = (m) => ({
  single: (name) => [m.single(name), compressUploads],
  array: (name, max) => [m.array(name, max), compressUploads],
});
export const imageUpload = withCompression(rawImageUpload);

/** Profile photos: images only, centre-cropped to a 512×512 WebP (smart crop on the subject) */
const rawAvatarUpload = multer({ storage, limits: { fileSize: 8 * 1024 * 1024 }, fileFilter: (_r, f, cb) => (['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(f.mimetype) ? cb(null, true) : cb(ApiError.badRequest('Upload a JPG, PNG or WebP photo'))) });
const compressAvatar = async (req, _res, next) => { try { if (req.file) await compressOne(req.file, { square: 512 }); next(); } catch (e) { next(e); } };
export const avatarUpload = { single: (name) => [rawAvatarUpload.single(name), compressAvatar] };
export const documentUpload = withCompression(rawDocumentUpload);

/** CSV / XLSX for bulk import — kept in memory, parsed then discarded */
export const sheetUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) =>
    /\.(csv|xlsx)$/i.test(file.originalname) ? cb(null, true) : cb(ApiError.badRequest('Upload a .csv or .xlsx file')),
});

export const publicUrlFor = (absPath) => `/uploads/${path.relative(UPLOAD_DIR, absPath).split(path.sep).join('/')}`;

import multer from 'multer';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { ApiError } from '../utils/ApiError.js';
import { storeFile } from '../services/storage.service.js';
import { storePrivate } from '../services/privateStorage.service.js';

/** Uploads are staged here, compressed, then handed to services/storage.service.js (disk or Cloudinary) */
const STAGING_DIR = path.join(os.tmpdir(), 'lexatrip-uploads');

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    fs.mkdirSync(STAGING_DIR, { recursive: true });
    cb(null, STAGING_DIR);
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
const DOC_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

const rawImageUpload = multer({
  storage,
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (_req, file, cb) =>
    IMAGE_TYPES.includes(file.mimetype) ? cb(null, true) : cb(ApiError.badRequest('Only image files are allowed')),
});

const rawDocumentUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) =>
    DOC_TYPES.includes(file.mimetype) ? cb(null, true) : cb(ApiError.badRequest('Upload a JPG, PNG, WebP or PDF file')),
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

/** Compress, then store: every uploaded file ends up with `file.url` */
async function finalise(req, next, options) {
  const files = [...(req.file ? [req.file] : []), ...(Array.isArray(req.files) ? req.files : [])];
  try {
    await Promise.all(files.map(async (file) => {
      await compressOne(file, options);
      file.url = await storeFile(file);
    }));
    next();
  } catch (e) {
    await Promise.all(files.map((f) => fs.promises.rm(f.path, { force: true })));
    next(e);
  }
}

export const compressUploads = (req, _res, next) => finalise(req, next);

/** Same API as multer (`.single` / `.array`) but returns [multer, compress] — Express flattens middleware arrays. */
const withCompression = (m) => ({
  single: (name) => [m.single(name), compressUploads],
  array: (name, max) => [m.array(name, max), compressUploads],
});
export const imageUpload = withCompression(rawImageUpload);

/** Profile photos: images only, centre-cropped to a 512×512 WebP (smart crop on the subject) */
const rawAvatarUpload = multer({ storage, limits: { fileSize: 8 * 1024 * 1024 }, fileFilter: (_r, f, cb) => (['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(f.mimetype) ? cb(null, true) : cb(ApiError.badRequest('Upload a JPG, PNG or WebP photo'))) });
const compressAvatar = (req, _res, next) => finalise(req, next, { square: 512 });
export const avatarUpload = { single: (name) => [rawAvatarUpload.single(name), compressAvatar] };

/**
 * KYC documents: JPG / PNG / WebP / PDF only, checked by content (not just the declared type). Photos are
 * re-encoded (drops GPS/EXIF data and anything hidden in the file) and stored privately: `file.key` + `file.mimetype`.
 */
async function finaliseDocument(req, _res, next) {
  const { file } = req;
  if (!file) return next();
  try {
    if (file.mimetype === 'application/pdf') {
      const head = (await fs.promises.readFile(file.path)).subarray(0, 5).toString();
      if (head !== '%PDF-') throw ApiError.badRequest('That file is not a valid PDF');
      if (!file.path.endsWith('.pdf')) { await fs.promises.rename(file.path, `${file.path}.pdf`); Object.assign(file, { path: `${file.path}.pdf`, filename: `${file.filename}.pdf` }); }
    } else {
      const out = `${file.path}.safe.webp`;
      await sharp(file.path).rotate().resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toFile(out)
        .catch(() => { throw ApiError.badRequest('That file is not a valid image'); });
      await fs.promises.rm(file.path, { force: true });
      Object.assign(file, { path: out, filename: path.basename(out), mimetype: 'image/webp' });
    }
    file.key = await storePrivate(file);
    return next();
  } catch (e) {
    return next(e);
  } finally {
    await fs.promises.rm(file.path, { force: true });
  }
}
export const documentUpload = { single: (name) => [rawDocumentUpload.single(name), finaliseDocument] };

/** CSV / XLSX for bulk import — kept in memory, parsed then discarded */
export const sheetUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) =>
    /\.(csv|xlsx)$/i.test(file.originalname) ? cb(null, true) : cb(ApiError.badRequest('Upload a .csv or .xlsx file')),
});

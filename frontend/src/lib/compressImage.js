import imageCompression from 'browser-image-compression';

/**
 * Shrinks photos in the browser BEFORE upload (faster on mobile data). The server then
 * converts to WebP again, so this step only needs to cut size. Non-raster files pass through.
 */
export async function compressForUpload(files) {
  return Promise.all([...files].map(async (f) => {
    if (!f.type.startsWith('image/') || /svg|gif/.test(f.type) || f.size < 300 * 1024) return f;
    try {
      const out = await imageCompression(f, { maxSizeMB: 1.5, maxWidthOrHeight: 2000, useWebWorker: true, initialQuality: 0.85 });
      return out.size < f.size ? new File([out], f.name, { type: out.type }) : f;
    } catch {
      return f; // never block an upload because compression failed
    }
  }));
}

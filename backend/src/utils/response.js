/**
 * Uniform response envelope — identical for web and the future Flutter app:
 *   { success: true, data, meta?, message? }
 *   { success: false, message, details? }
 */
export const ok = (res, data, meta, message) =>
  res.json({ success: true, data, ...(meta ? { meta } : {}), ...(message ? { message } : {}) });

export const created = (res, data, message = 'Created') =>
  res.status(201).json({ success: true, data, message });

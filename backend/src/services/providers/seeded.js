import crypto from 'node:crypto';

/** Deterministic pseudo-random generator so sandbox results are stable for the same search. */
export function seeded(seedStr) {
  let h = crypto.createHash('md5').update(seedStr).digest().readUInt32LE(0);
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const encodeId = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
export const decodeId = (id) => {
  try {
    return JSON.parse(Buffer.from(id, 'base64url').toString());
  } catch {
    return null;
  }
};

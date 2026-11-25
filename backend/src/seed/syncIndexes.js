/* Builds/updates indexes from the schemas (and drops indexes no longer declared).
 * Run after deploys:  npm run indexes   — safe to repeat. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import mongoose from 'mongoose';
import { env } from '../config/env.js';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'models');
const files = [...fs.readdirSync(dir), ...fs.readdirSync(path.join(dir, 'seo')).map((f) => `seo/${f}`)].filter((f) => f.endsWith('.js'));
for (const f of files) await import(pathToFileURL(path.join(dir, f)).href);

await mongoose.connect(env.mongoUri, { autoIndex: false });
let total = 0;
for (const name of mongoose.modelNames().sort()) {
  const m = mongoose.model(name);
  const dropped = await m.syncIndexes();
  const n = (await m.collection.indexes().catch(() => [])).length;
  total += n;
  console.log(`${name.padEnd(16)} ${String(n).padStart(2)} indexes${dropped.length ? `  (dropped: ${dropped.join(', ')})` : ''}`);
}
console.log(`\n✔ ${total} indexes across ${mongoose.modelNames().length} collections`);
await mongoose.disconnect();

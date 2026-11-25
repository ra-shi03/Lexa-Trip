import dns from 'node:dns';
import mongoose from 'mongoose';
import { env } from './env.js';

const OPTIONS = () => ({
  maxPoolSize: env.db.maxPoolSize, // concurrent connections per Node process
  minPoolSize: env.db.minPoolSize,
  serverSelectionTimeoutMS: 10_000, // fail fast when the cluster is unreachable
  socketTimeoutMS: 45_000,
  autoIndex: env.db.autoIndex, // off in production: build indexes with `npm run indexes`
  maxIdleTimeMS: 60_000,
});

/**
 * mongodb+srv:// needs a DNS SRV lookup. Some routers / ISPs / mobile hotspots refuse it
 * (querySrv EREFUSED / ECONNREFUSED / ETIMEOUT). On such an error we retry once through public DNS
 * (MONGO_DNS_SERVERS, default Google + Cloudflare). Alternative: use Atlas' non-SRV "standard" connection string.
 */
export async function connectDB() {
  mongoose.set('strictQuery', true);
  mongoose.connection.on('disconnected', () => console.warn('[db] disconnected'));
  mongoose.connection.on('reconnected', () => console.log('[db] reconnected'));
  try {
    await mongoose.connect(env.mongoUri, OPTIONS());
  } catch (e) {
    if (!/querySrv|ENOTFOUND|EREFUSED|ETIMEOUT/.test(`${e.code} ${e.syscall} ${e.message}`) || !env.mongoUri.startsWith('mongodb+srv://')) throw e;
    const servers = (process.env.MONGO_DNS_SERVERS || '8.8.8.8,1.1.1.1').split(',').map((x) => x.trim()).filter(Boolean);
    console.warn(`[db] DNS SRV lookup failed (${e.code}) — retrying via public DNS ${servers.join(', ')}`);
    dns.setServers(servers);
    await mongoose.disconnect().catch(() => {});
    await mongoose.connect(env.mongoUri, OPTIONS());
  }
  console.log(`[db] connected → ${mongoose.connection.host}/${mongoose.connection.name} (pool ${env.db.minPoolSize}-${env.db.maxPoolSize}, autoIndex ${env.db.autoIndex})`);
}

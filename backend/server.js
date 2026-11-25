import cluster from 'node:cluster';
import os from 'node:os';
import mongoose from 'mongoose';
import { env } from './src/config/env.js';
import { connectDB } from './src/config/db.js';
import { createApp } from './src/app.js';
import { startScheduler } from './src/jobs/scheduler.js';

/**
 * Process model
 *  CLUSTER_WORKERS=0  (default) → single process (dev)
 *  CLUSTER_WORKERS=N | -1(=CPU count) → N stateless workers sharing the port; the OS balances connections.
 *  Background jobs run on exactly ONE process (worker #1, or the only process) so they never double-fire.
 *  For multiple servers behind Nginx/ALB see docs/SECURITY-AND-SCALING.md.
 */
async function startWorker(runJobs) {
  await connectDB();
  const app = createApp();
  const server = app.listen(env.port, () => {
    console.log(`[api] pid ${process.pid} → http://localhost:${env.port} (${env.nodeEnv})${runJobs ? ' · jobs on' : ''}`);
  });
  server.keepAliveTimeout = 65_000; // > typical LB idle timeout (60s) to avoid 502s
  server.headersTimeout = 66_000;
  if (runJobs) startScheduler();

  let closing = false;
  const shutdown = async (sig) => {
    if (closing) return;
    closing = true;
    console.log(`[api] ${sig} received — draining connections`);
    server.close(async () => { await mongoose.disconnect().catch(() => {}); process.exit(0); });
    setTimeout(() => process.exit(1), 15_000).unref(); // force-exit if connections hang
  };
  ['SIGTERM', 'SIGINT'].forEach((s) => process.on(s, () => shutdown(s)));
}

const n = env.clusterWorkers === -1 ? os.availableParallelism() : env.clusterWorkers;
if (n > 1 && cluster.isPrimary) {
  console.log(`[cluster] primary ${process.pid} starting ${n} workers`);
  for (let i = 1; i <= n; i++) cluster.fork({ WORKER_NO: String(i) });
  cluster.on('exit', (w, code) => {
    console.error(`[cluster] worker ${w.process.pid} exited (${code}) — restarting`);
    cluster.fork({ WORKER_NO: String(Math.floor(Math.random() * 1000) + 100) }); // replacement does not run jobs
  });
  ['SIGTERM', 'SIGINT'].forEach((s) => process.on(s, () => { for (const w of Object.values(cluster.workers)) w.process.kill('SIGTERM'); setTimeout(() => process.exit(0), 16_000).unref(); }));
} else {
  startWorker(n <= 1 || process.env.WORKER_NO === '1').catch((e) => { console.error('[fatal]', e); process.exit(1); });
}

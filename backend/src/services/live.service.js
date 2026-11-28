import { EventEmitter } from 'node:events';
import cluster from 'node:cluster';

/**
 * Live updates for the website + guest app (Server-Sent Events, GET /api/v1/public/live).
 * When the master admin saves something guests can see, clients get a tiny "change" event and re-fetch —
 * no page refresh. Events carry no data beyond the topic, so the stream is safe to expose publicly.
 *
 * Topics:  settings → theme, branding, features, home layout, app (quick services, splash, onboarding)…
 *          content  → banners, categories, destinations, coupons, properties, reviews, pages…
 *
 * Fan-out: single process → in-memory; CLUSTER_WORKERS>1 → workers relay through the primary (server.js).
 * Several servers → replace `publish` with Redis pub/sub (docs/SECURITY-AND-SCALING.md).
 */
const bus = new EventEmitter();
bus.setMaxListeners(0);
const MAX_CLIENTS = 5000; // per process
const HEARTBEAT_MS = 25_000; // keeps proxies / load balancers from closing idle streams
let clients = 0;

const deliver = (evt) => bus.emit('change', evt);
if (cluster.isWorker) process.on('message', (m) => { if (m?.__ltLive) deliver(m.__ltLive); });

export function publish(topic, extra = {}) {
  const evt = { topic, ...extra, at: Date.now() };
  if (cluster.isWorker && process.send) process.send({ __ltLive: evt }); // primary relays to every worker, including this one
  else deliver(evt);
}

/** Server-side subscribers (e.g. per-process caches that must be dropped). Returns an unsubscribe fn. */
export function onLive(fn) {
  bus.on('change', fn);
  return () => bus.off('change', fn);
}

/** GET /public/live — the SSE stream */
export function liveStream(req, res) {
  if (clients >= MAX_CLIENTS) { res.set('Retry-After', '30'); return res.status(503).json({ success: false, message: 'Live updates are busy, retrying shortly' }); }
  clients += 1;
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-store, no-transform', // no-transform → compression middleware leaves the stream alone
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // Nginx: don't buffer
  });
  res.write(`retry: 5000\nevent: hello\ndata: ${JSON.stringify({ at: Date.now() })}\n\n`);
  const off = onLive((evt) => res.write(`event: change\ndata: ${JSON.stringify(evt)}\n\n`));
  const hb = setInterval(() => res.write(': ping\n\n'), HEARTBEAT_MS);
  req.on('close', () => { off(); clearInterval(hb); clients -= 1; });
}

/** Admin paths whose writes never change what guests see. Everything else publishes "content". */
const PRIVATE_SEGMENTS = new Set(['settings', 'finance', 'payouts', 'subadmins', 'support', 'users', 'notifications', 'bookings', 'commission-rules', 'uploads', 'dashboard', 'reports', 'audit', 'push-token']);

/** Admin router middleware: after a successful write, tell connected clients to re-fetch. */
export function publishAdminWrites(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const segment = req.path.split('/')[1] || ''; // read now: req.url is rewritten as the request leaves the router
  if (PRIVATE_SEGMENTS.has(segment)) return next();
  res.on('finish', () => {
    if (res.statusCode < 400) publish('content', { scope: segment });
  });
  return next();
}

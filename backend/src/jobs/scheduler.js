import { expireHolds } from '../services/booking.service.js';
import { publishScheduled } from '../services/seo/content.service.js';
import Booking from '../models/Booking.js';
import { toDay } from '../utils/helpers.js';

/**
 * Lightweight in-process scheduler (single instance).
 * For multi-instance deployments move these to a queue (BullMQ/Agenda) or a single cron worker.
 */
const jobs = [
  { name: 'expire-payment-holds', everyMs: 60_000, run: expireHolds },
  { name: 'publish-scheduled-seo', everyMs: 60_000, run: publishScheduled },
  {
    name: 'auto-complete-stays',
    everyMs: 60 * 60_000,
    run: async () => {
      // Stays whose checkout date has passed without a manual check-out are marked completed
      const r = await Booking.updateMany(
        { type: 'hotel', status: { $in: ['confirmed', 'checked_in'] }, checkOut: { $lt: toDay(new Date()) } },
        { $set: { status: 'completed' }, $push: { statusHistory: { status: 'completed', by: 'system', note: 'Auto-completed after checkout date', at: new Date() } } },
      );
      return r.modifiedCount;
    },
  },
];

export function startScheduler() {
  for (const job of jobs) {
    const tick = async () => {
      try {
        const n = await job.run();
        if (n) console.log(`[job:${job.name}] processed ${n}`);
      } catch (e) {
        console.error(`[job:${job.name}]`, e.message);
      }
    };
    setTimeout(tick, 5_000);
    setInterval(tick, job.everyMs).unref();
  }
}

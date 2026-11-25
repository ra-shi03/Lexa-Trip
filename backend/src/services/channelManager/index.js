import Property from '../../models/Property.js';
import RoomType from '../../models/RoomType.js';
import { Inventory } from '../../models/Inventory.js';
import { SyncLog } from '../../models/Misc.js';
import { toDay, isoDay } from '../../utils/helpers.js';

/**
 * Channel manager integration (STAAH / AxisRooms / …).
 *
 * Every provider adapter implements the same contract so the rest of the
 * platform never depends on a specific vendor:
 *   testConnection(property)                     → { ok, message }
 *   pushAvailability(property, payload)          → { ok, message }
 *   pushRates(property, payload)                 → { ok, message }
 *   parseWebhook(body, headers)                  → { kind: 'booking'|'modification'|'cancellation', hotelCode, booking }
 *
 * Real adapters are added once the client obtains API credentials + docs from the provider.
 */
const mockAdapter = {
  name: 'mock',
  async testConnection(p) {
    return { ok: Boolean(p.channelManager?.hotelCode), message: p.channelManager?.hotelCode ? 'Sandbox connection OK' : 'Hotel code missing' };
  },
  async pushAvailability(_p, payload) {
    return { ok: true, message: `Pushed ${payload.nights.length} night(s) availability (sandbox)` };
  },
  async pushRates(_p, payload) {
    return { ok: true, message: `Pushed ${payload.nights.length} night(s) rates (sandbox)` };
  },
  parseWebhook(body) {
    // Sandbox format: { kind, hotelCode, booking: { ref, roomCode, checkIn, checkOut, rooms, guest:{name,email,phone}, amount } }
    return body;
  },
};

const pending = (name) => ({
  name,
  async testConnection() { return { ok: false, message: `${name} adapter pending API credentials & documentation` }; },
  async pushAvailability() { return { ok: false, message: `${name} adapter not configured` }; },
  async pushRates() { return { ok: false, message: `${name} adapter not configured` }; },
  parseWebhook() { throw new Error(`${name} webhook parser not implemented`); },
});

const ADAPTERS = { mock: mockAdapter, staah: pending('STAAH'), axisrooms: pending('AxisRooms') };
const adapterFor = (p) => ADAPTERS[p?.channelManager?.provider] || mockAdapter;

async function log(property, provider, direction, kind, res, payload) {
  await SyncLog.create({ property, provider, direction, kind, status: res.ok ? 'success' : 'failed', message: res.message, payload });
  await Property.updateOne({ _id: property }, { 'channelManager.lastSyncAt': new Date(), 'channelManager.lastSyncStatus': res.ok ? 'ok' : res.message });
}

export const channelManager = {
  providers: Object.keys(ADAPTERS),

  async testConnection(propertyId) {
    const p = await Property.findById(propertyId).lean();
    const res = await adapterFor(p).testConnection(p);
    await log(propertyId, p.channelManager?.provider, 'push', 'mapping', res);
    return res;
  },

  /** Called after every inventory change (booking, cancellation, vendor edit). No-op if not connected. */
  async pushAvailability(propertyId, roomTypeId, from, to) {
    const p = await Property.findById(propertyId).lean();
    if (!p?.channelManager?.enabled) return;
    const rt = await RoomType.findById(roomTypeId).lean();
    const rows = await Inventory.find({ roomType: roomTypeId, date: { $gte: toDay(from), $lte: toDay(to) } }).lean();
    const payload = {
      hotelCode: p.channelManager.hotelCode,
      roomCode: rt?.channelRoomId || String(roomTypeId),
      nights: rows.map((r) => ({ date: isoDay(r.date), available: r.closed ? 0 : r.totalRooms - r.booked - r.blocked, price: r.price ?? rt.basePrice, closed: r.closed })),
    };
    const adapter = adapterFor(p);
    const res = await adapter.pushAvailability(p, payload);
    await log(propertyId, adapter.name, 'push', 'availability', res, { roomCode: payload.roomCode, nights: payload.nights.length });
  },

  /** Inbound reservation / modification / cancellation from an OTA via the channel manager. */
  async handleWebhook(provider, body, headers) {
    const adapter = ADAPTERS[provider];
    if (!adapter) throw new Error('Unknown channel manager provider');
    const evt = adapter.parseWebhook(body, headers);
    const property = await Property.findOne({ 'channelManager.hotelCode': evt.hotelCode, 'channelManager.enabled': true });
    if (!property) {
      await SyncLog.create({ provider, direction: 'webhook', kind: evt.kind, status: 'skipped', message: `No property mapped to hotel code ${evt.hotelCode}` });
      return { ok: false, message: 'Hotel not mapped' };
    }
    const { applyChannelEvent } = await import('../booking.service.js');
    const result = await applyChannelEvent(property, evt);
    await SyncLog.create({ property: property._id, provider, direction: 'webhook', kind: evt.kind, status: result.ok ? 'success' : 'failed', message: result.message, payload: evt });
    return result;
  },
};

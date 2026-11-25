import { Inventory, InventoryLog } from '../models/Inventory.js';
import RoomType from '../models/RoomType.js';
import { ApiError } from '../utils/ApiError.js';
import { dayRange, toDay, isoDay } from '../utils/helpers.js';
import { channelManager } from './channelManager/index.js';

/** Lazily creates missing per-night inventory rows from the room type defaults. */
export async function ensureInventory(roomType, from, to) {
  const dates = dayRange(from, to);
  if (!dates.length) return;
  await Inventory.bulkWrite(
    dates.map((date) => ({
      updateOne: {
        filter: { roomType: roomType._id, date },
        update: { $setOnInsert: { property: roomType.property, roomType: roomType._id, date, totalRooms: roomType.totalRooms } },
        upsert: true,
      },
    })),
    { ordered: false },
  );
}

/** Availability for several room types over [from, to). */
export async function getAvailability(roomTypes, from, to) {
  for (const rt of roomTypes) await ensureInventory(rt, from, to);
  const rows = await Inventory.find({
    roomType: { $in: roomTypes.map((r) => r._id) },
    date: { $gte: toDay(from), $lt: toDay(to) },
  }).lean();

  const result = {};
  for (const rt of roomTypes) {
    const nights = rows
      .filter((r) => String(r.roomType) === String(rt._id))
      .sort((a, b) => a.date - b.date)
      .map((r) => ({
        date: r.date,
        available: r.closed ? 0 : Math.max(0, r.totalRooms - r.booked - r.blocked),
        price: r.price,
        closed: r.closed,
        minStay: r.minStay || 1,
      }));
    const minAvailable = nights.length ? Math.min(...nights.map((n) => n.available)) : 0;
    const minStay = nights.length ? Math.max(...nights.map((n) => n.minStay)) : 1;
    result[String(rt._id)] = { nights, minAvailable, minStay };
  }
  return result;
}

/**
 * Atomically reserves `qty` rooms for every night in [from, to).
 * Each night is decremented with a conditional update, so two concurrent
 * bookings can never oversell the last room. Partial reservations are rolled back.
 */
export async function reserve(roomTypeId, from, to, qty) {
  const rt = await RoomType.findById(roomTypeId);
  await ensureInventory(rt, from, to);
  const dates = dayRange(from, to);
  const done = [];
  for (const date of dates) {
    const updated = await Inventory.findOneAndUpdate(
      {
        roomType: roomTypeId,
        date,
        closed: false,
        $expr: { $lte: [{ $add: ['$booked', '$blocked', qty] }, '$totalRooms'] },
      },
      { $inc: { booked: qty } },
      { new: true },
    );
    if (!updated) {
      if (done.length) await Inventory.updateMany({ roomType: roomTypeId, date: { $in: done } }, { $inc: { booked: -qty } });
      throw ApiError.conflict(`Sorry, this room just sold out for ${isoDay(date)}. Please choose another room or date.`);
    }
    done.push(date);
  }
  await InventoryLog.create({ property: rt.property, roomType: roomTypeId, from, to, change: { booked: qty }, reason: 'booking' });
  channelManager.pushAvailability(rt.property, roomTypeId, from, to).catch(() => {});
}

export async function release(roomTypeId, from, to, qty, reason = 'cancellation') {
  const dates = dayRange(from, to);
  await Inventory.updateMany({ roomType: roomTypeId, date: { $in: dates }, booked: { $gte: qty } }, { $inc: { booked: -qty } });
  const rt = await RoomType.findById(roomTypeId).lean();
  await InventoryLog.create({ property: rt?.property, roomType: roomTypeId, from, to, change: { booked: -qty }, reason });
  if (rt) channelManager.pushAvailability(rt.property, roomTypeId, from, to).catch(() => {});
}

/**
 * Bulk calendar update used by the vendor & admin inventory pages.
 * `set` may contain: totalRooms, blocked, price (null clears override), closed, minStay
 */
export async function bulkUpdate({ propertyId, roomTypeIds, from, to, daysOfWeek, set, actorType, actor }) {
  const roomTypes = await RoomType.find({ _id: { $in: roomTypeIds }, property: propertyId });
  if (!roomTypes.length) throw ApiError.badRequest('Select at least one room type');
  const dates = dayRange(from, new Date(toDay(to).getTime() + 86400000)).filter(
    (d) => !daysOfWeek?.length || daysOfWeek.includes(d.getUTCDay()),
  );
  if (dates.length > 400) throw ApiError.badRequest('Please update at most 400 days at a time');

  const $set = { source: actorType === 'channel' ? 'channel' : actorType };
  for (const k of ['totalRooms', 'blocked', 'price', 'closed', 'minStay']) if (set[k] !== undefined) $set[k] = set[k];

  for (const rt of roomTypes) {
    await ensureInventory(rt, dates[0], new Date(dates[dates.length - 1].getTime() + 86400000));
    await Inventory.updateMany({ roomType: rt._id, date: { $in: dates } }, { $set });
    await InventoryLog.create({ property: propertyId, roomType: rt._id, from, to, change: set, reason: `${actorType}_update`, actorType, actor });
    channelManager.pushAvailability(propertyId, rt._id, from, to).catch(() => {});
  }
  return { updatedNights: dates.length * roomTypes.length };
}

/** Calendar grid for the inventory page: room types × dates */
export async function inventoryGrid(propertyId, from, to) {
  const roomTypes = await RoomType.find({ property: propertyId, isActive: true }).lean();
  const avail = await getAvailability(roomTypes, from, to);
  const rows = await Inventory.find({ property: propertyId, date: { $gte: toDay(from), $lt: toDay(to) } }).lean();
  return roomTypes.map((rt) => ({
    roomType: { _id: rt._id, name: rt.name, totalRooms: rt.totalRooms, basePrice: rt.basePrice, weekendPrice: rt.weekendPrice },
    cells: rows
      .filter((r) => String(r.roomType) === String(rt._id))
      .sort((a, b) => a.date - b.date)
      .map((r) => ({
        date: isoDay(r.date),
        total: r.totalRooms,
        booked: r.booked,
        blocked: r.blocked,
        available: r.closed ? 0 : Math.max(0, r.totalRooms - r.booked - r.blocked),
        price: r.price,
        closed: r.closed,
        minStay: r.minStay,
      })),
    minAvailable: avail[String(rt._id)]?.minAvailable ?? 0,
  }));
}

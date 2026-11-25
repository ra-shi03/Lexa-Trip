import mongoose from 'mongoose';
import Property from '../../models/Property.js';
import RoomType from '../../models/RoomType.js';
import Booking from '../../models/Booking.js';
import { Inventory, PricingRule } from '../../models/Inventory.js';
import { SyncLog } from '../../models/Misc.js';
import { inventoryGrid, bulkUpdate } from '../../services/inventory.service.js';
import { channelManager } from '../../services/channelManager/index.js';
import { cancelBooking } from '../../services/booking.service.js';
import { notify } from '../../services/notification/notification.service.js';
import { audit } from '../../services/audit.service.js';
import { publicUrlFor } from '../../middlewares/upload.js';
import { ok, created } from '../../utils/response.js';
import { ApiError } from '../../utils/ApiError.js';
import { buildListQuery, pageMeta } from '../../utils/queryBuilder.js';
import { slugify, toDay, addDays, randomCode, toCsv } from '../../utils/helpers.js';

/**
 * Property / room / inventory / booking management shared by the Vendor panel
 * (scoped to the logged-in vendor) and the Admin panel (all vendors).
 */
export function propertyManager(mode) {
  const isVendor = mode === 'vendor';
  const scope = (req) => (isVendor ? { vendor: req.vendor._id } : {});
  const actor = (req) => (isVendor ? 'vendor' : 'admin');

  async function ownProperty(req, id = req.params.id) {
    const p = await Property.findOne({ _id: id, ...scope(req) });
    if (!p) throw ApiError.notFound('Property not found');
    return p;
  }

  async function refreshMinPrice(propertyId) {
    const r = await RoomType.find({ property: propertyId, isActive: true }).select('basePrice').lean();
    await Property.updateOne({ _id: propertyId }, { minPrice: r.length ? Math.min(...r.map((x) => x.basePrice)) : 0 });
  }

  return {
    // ─── Properties ───
    async list(req, res) {
      const { filter, skip, limit, page, sort } = buildListQuery(req.query, { searchFields: ['name', 'slug'], filterFields: ['status', 'category', 'vendor', 'isFeatured'], baseFilter: scope(req) });
      if (req.query.city) filter['address.city'] = req.query.city;
      const [items, total] = await Promise.all([
        Property.find(filter).sort(sort).skip(skip).limit(limit).populate('category', 'name').populate('address.city', 'name').populate('vendor', 'businessName email').lean(),
        Property.countDocuments(filter),
      ]);
      ok(res, items, pageMeta(total, page, limit));
    },
    async get(req, res) {
      const p = await Property.findOne({ _id: req.params.id, ...scope(req) }).populate('vendor', 'businessName email phone').lean();
      if (!p) throw ApiError.notFound();
      const rooms = await RoomType.find({ property: p._id }).lean();
      ok(res, { ...p, rooms });
    },
    async create(req, res) {
      if (isVendor) {
        const count = await Property.countDocuments({ vendor: req.vendor._id });
        if (count >= (req.vendor.permissions?.maxProperties ?? 10)) throw ApiError.forbidden('Property limit reached — contact admin to increase it');
      }
      const body = { ...req.body };
      body.vendor = isVendor ? req.vendor._id : body.vendor;
      if (!body.vendor) throw ApiError.badRequest('Vendor is required');
      body.slug = slugify(body.slug || `${body.name}-${randomCode('', 4).toLowerCase()}`);
      body.status = isVendor ? 'draft' : body.status || 'approved';
      delete body.isFeatured;
      const p = await Property.create(body);
      audit(req, 'property.create', 'Property', p._id);
      created(res, p);
    },
    async update(req, res) {
      const p = await ownProperty(req);
      const body = { ...req.body };
      delete body.vendor;
      delete body.rating;
      delete body.minPrice;
      if (isVendor) {
        delete body.status;
        delete body.isFeatured;
        delete body.statusNote;
      }
      if (body.slug) body.slug = slugify(body.slug);
      p.set(body);
      await p.save();
      audit(req, 'property.update', 'Property', p._id);
      ok(res, p, undefined, 'Property saved');
    },
    async remove(req, res) {
      const p = await ownProperty(req);
      const active = await Booking.exists({ property: p._id, status: { $in: ['confirmed', 'pending_approval', 'checked_in'] } });
      if (active) throw ApiError.conflict('This property has active bookings. Hide it instead of deleting.');
      await Promise.all([RoomType.deleteMany({ property: p._id }), Inventory.deleteMany({ property: p._id }), PricingRule.deleteMany({ property: p._id }), p.deleteOne()]);
      audit(req, 'property.delete', 'Property', p._id);
      ok(res, { id: p._id }, undefined, 'Property deleted');
    },
    /** Vendor → admin approval queue */
    async submit(req, res) {
      const p = await ownProperty(req);
      const rooms = await RoomType.countDocuments({ property: p._id, isActive: true });
      if (!rooms) throw ApiError.badRequest('Add at least one room type before submitting');
      if (!p.images?.length) throw ApiError.badRequest('Add at least one photo before submitting');
      p.status = 'pending';
      await p.save();
      await notify({ recipientType: 'admin', title: 'Property awaiting approval', body: p.name, type: 'property_pending', data: { propertyId: p._id } });
      ok(res, p, undefined, 'Submitted for approval');
    },
    async uploadImages(req, res) {
      const files = req.files || [];
      ok(res, files.map((f) => ({ url: publicUrlFor(f.path), alt: '' })));
    },

    // ─── Room types ───
    async rooms(req, res) {
      await ownProperty(req);
      ok(res, await RoomType.find({ property: req.params.id }).populate('amenities', 'name').lean());
    },
    async createRoom(req, res) {
      await ownProperty(req);
      const rt = await RoomType.create({ ...req.body, property: req.params.id });
      await refreshMinPrice(req.params.id);
      created(res, rt);
    },
    async updateRoom(req, res) {
      await ownProperty(req);
      const rt = await RoomType.findOne({ _id: req.params.roomId, property: req.params.id });
      if (!rt) throw ApiError.notFound();
      const totalChanged = req.body.totalRooms !== undefined && Number(req.body.totalRooms) !== rt.totalRooms;
      rt.set(req.body);
      await rt.save();
      if (totalChanged) {
        await Inventory.updateMany({ roomType: rt._id, date: { $gte: toDay(new Date()) }, source: { $ne: 'channel' } }, { totalRooms: rt.totalRooms });
      }
      await refreshMinPrice(req.params.id);
      ok(res, rt, undefined, 'Room saved');
    },
    async removeRoom(req, res) {
      await ownProperty(req);
      const active = await Booking.exists({ roomType: req.params.roomId, status: { $in: ['confirmed', 'pending_approval', 'checked_in'] }, checkOut: { $gte: new Date() } });
      if (active) throw ApiError.conflict('This room has upcoming bookings. Deactivate it instead.');
      await RoomType.deleteOne({ _id: req.params.roomId, property: req.params.id });
      await Inventory.deleteMany({ roomType: req.params.roomId });
      await refreshMinPrice(req.params.id);
      ok(res, null, undefined, 'Room deleted');
    },

    // ─── Pricing rules (weekday / weekend / seasonal / special dates) ───
    async pricingRules(req, res) {
      await ownProperty(req);
      ok(res, await PricingRule.find({ property: req.params.id }).populate('roomType', 'name').sort({ priority: -1 }).lean());
    },
    async createPricingRule(req, res) {
      await ownProperty(req);
      if (isVendor && req.vendor.permissions?.canEditPricing === false) throw ApiError.forbidden('Pricing edits are disabled for your account');
      created(res, await PricingRule.create({ ...req.body, property: req.params.id, roomType: req.body.roomType || undefined }));
    },
    async updatePricingRule(req, res) {
      await ownProperty(req);
      const r = await PricingRule.findOneAndUpdate({ _id: req.params.ruleId, property: req.params.id }, { ...req.body, roomType: req.body.roomType || null }, { new: true });
      ok(res, r);
    },
    async removePricingRule(req, res) {
      await ownProperty(req);
      await PricingRule.deleteOne({ _id: req.params.ruleId, property: req.params.id });
      ok(res, null);
    },

    // ─── Inventory calendar ───
    async inventory(req, res) {
      await ownProperty(req);
      const from = req.query.from ? toDay(req.query.from) : toDay(new Date());
      const days = Math.min(62, Number(req.query.days) || 14);
      ok(res, await inventoryGrid(req.params.id, from, addDays(from, days)), { from, days });
    },
    async updateInventory(req, res) {
      await ownProperty(req);
      if (isVendor && req.vendor.permissions?.canManageInventory === false) throw ApiError.forbidden('Inventory edits are disabled for your account');
      const { roomTypeIds, from, to, daysOfWeek, set } = req.body;
      const out = await bulkUpdate({ propertyId: req.params.id, roomTypeIds, from, to, daysOfWeek, set: set || {}, actorType: actor(req), actor: (req.vendor || req.admin)._id });
      ok(res, out, undefined, 'Inventory updated');
    },

    // ─── Channel manager ───
    async channel(req, res) {
      const p = await ownProperty(req);
      const [logs, rooms] = await Promise.all([
        SyncLog.find({ property: p._id }).sort({ createdAt: -1 }).limit(50).lean(),
        RoomType.find({ property: p._id }).select('name channelRoomId ratePlans').lean(),
      ]);
      ok(res, { config: p.channelManager, providers: channelManager.providers, rooms, logs });
    },
    async updateChannel(req, res) {
      const p = await ownProperty(req);
      const { enabled, provider, hotelCode, roomMappings = [] } = req.body;
      p.channelManager = { ...(p.channelManager?.toObject?.() || {}), enabled: Boolean(enabled), provider, hotelCode };
      await p.save();
      for (const m of roomMappings) {
        await RoomType.updateOne({ _id: m.roomTypeId, property: p._id }, { channelRoomId: m.channelRoomId });
      }
      ok(res, p.channelManager, undefined, 'Channel manager settings saved');
    },
    async testChannel(req, res) {
      const p = await ownProperty(req);
      ok(res, await channelManager.testConnection(p._id));
    },
    async syncChannel(req, res) {
      const p = await ownProperty(req);
      const rooms = await RoomType.find({ property: p._id, isActive: true }).select('_id').lean();
      for (const r of rooms) await channelManager.pushAvailability(p._id, r._id, new Date(), addDays(new Date(), 90));
      ok(res, null, undefined, `Full sync queued for ${rooms.length} room type(s)`);
    },

    // ─── Bookings ───
    async bookings(req, res) {
      const { filter, skip, limit, page, sort } = buildListQuery(req.query, { searchFields: ['bookingCode', 'primaryGuest.name', 'primaryGuest.phone', 'pnr'], filterFields: ['status', 'type', 'property', 'paymentStatus', 'source'], baseFilter: isVendor ? { vendor: req.vendor._id, type: 'hotel' } : {} });
      if (isVendor) filter.status = filter.status || { $ne: 'pending_payment' };
      const now = toDay(new Date());
      if (req.query.tab === 'upcoming') Object.assign(filter, { checkIn: { $gte: now }, status: { $in: ['confirmed', 'pending_approval'] } });
      if (req.query.tab === 'active') Object.assign(filter, { status: 'checked_in' });
      if (req.query.tab === 'completed') Object.assign(filter, { status: { $in: ['checked_out', 'completed'] } });
      if (req.query.tab === 'cancelled') Object.assign(filter, { status: 'cancelled' });
      if (req.query.from || req.query.to) {
        filter.createdAt = {};
        if (req.query.from) filter.createdAt.$gte = toDay(req.query.from);
        if (req.query.to) filter.createdAt.$lt = addDays(req.query.to, 1);
      }
      const [items, total] = await Promise.all([
        Booking.find(filter).sort(sort).skip(skip).limit(limit).populate('user', 'name phone email').populate('property', 'name').lean(),
        Booking.countDocuments(filter),
      ]);
      ok(res, items, pageMeta(total, page, limit));
    },
    async booking(req, res) {
      const b = await Booking.findOne({ _id: req.params.bookingId, ...scope(req) }).populate('user', 'name phone email').populate('property', 'name address contact').populate('roomType', 'name').lean();
      if (!b) throw ApiError.notFound();
      ok(res, b);
    },
    /** action: approve | reject | check_in | check_out | no_show | cancel */
    async bookingAction(req, res) {
      const b = await Booking.findOne({ _id: req.params.bookingId, ...scope(req) });
      if (!b) throw ApiError.notFound();
      const { action, note } = req.body;
      const by = actor(req);
      const need = (states) => {
        if (!states.includes(b.status)) throw ApiError.conflict(`Cannot ${action.replace('_', ' ')} a booking that is ${b.status.replace('_', ' ')}`);
      };
      switch (action) {
        case 'approve': need(['pending_approval']); b.pushStatus('confirmed', by, note); break;
        case 'reject': need(['pending_approval']); await cancelBooking(b, { by, reason: note || 'Declined by property', forceFullRefund: true }); return ok(res, b, undefined, 'Booking declined & refunded');
        case 'check_in': need(['confirmed']); b.pushStatus('checked_in', by, note); break;
        case 'check_out': need(['checked_in']); b.pushStatus('checked_out', by, note); break;
        case 'no_show': need(['confirmed']); b.pushStatus('completed', by, note || 'No-show'); break;
        case 'cancel': await cancelBooking(b, { by, reason: note || `Cancelled by ${by}`, forceFullRefund: by === 'vendor' }); return ok(res, b, undefined, 'Booking cancelled');
        default: throw ApiError.badRequest('Unknown action');
      }
      await b.save();
      if (['approve', 'check_in', 'check_out'].includes(action)) {
        await notify({ recipientType: 'user', recipient: b.user, title: `Booking ${b.status.replace('_', ' ')} · ${b.bookingCode}`, body: b.snapshot?.propertyName, type: `booking_${b.status}`, data: { bookingId: b._id } });
      }
      ok(res, b, undefined, 'Booking updated');
    },

    // ─── Reports ───
    async reports(req, res) {
      const from = req.query.from ? toDay(req.query.from) : addDays(new Date(), -30);
      const to = req.query.to ? addDays(req.query.to, 1) : addDays(new Date(), 1);
      const match = { ...scope(req), type: 'hotel', createdAt: { $gte: from, $lt: to }, status: { $nin: ['pending_payment', 'failed', 'expired'] } };
      if (req.query.property) match.property = new mongoose.Types.ObjectId(String(req.query.property));
      const [byProperty, byRoom, byStatus, daily] = await Promise.all([
        Booking.aggregate([{ $match: match }, { $group: { _id: '$property', name: { $first: '$snapshot.propertyName' }, bookings: { $sum: 1 }, roomNights: { $sum: { $multiply: ['$nights', '$rooms'] } }, revenue: { $sum: '$pricing.totalAmount' }, commission: { $sum: '$commission.amount' }, payout: { $sum: '$vendorPayoutAmount' }, cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } } } }, { $sort: { revenue: -1 } }]),
        Booking.aggregate([{ $match: match }, { $group: { _id: '$roomType', property: { $first: '$snapshot.propertyName' }, name: { $first: '$snapshot.roomName' }, bookings: { $sum: 1 }, roomNights: { $sum: { $multiply: ['$nights', '$rooms'] } }, revenue: { $sum: '$pricing.totalAmount' } } }, { $sort: { revenue: -1 } }]),
        Booking.aggregate([{ $match: match }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
        Booking.aggregate([{ $match: match }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, bookings: { $sum: 1 }, revenue: { $sum: '$pricing.totalAmount' } } }, { $sort: { _id: 1 } }]),
      ]);
      // Occupancy = booked room-nights / available room-nights for the period
      const props = await Property.find(scope(req)).select('_id').lean();
      const inv = await Inventory.aggregate([{ $match: { property: { $in: props.map((p) => p._id) }, date: { $gte: from, $lt: to } } }, { $group: { _id: null, total: { $sum: '$totalRooms' }, booked: { $sum: '$booked' } } }]);
      const occupancy = inv[0]?.total ? Math.round((inv[0].booked / inv[0].total) * 1000) / 10 : 0;

      if (req.query.format === 'csv') {
        const csv = toCsv(byProperty, [
          { label: 'Property', value: 'name' }, { label: 'Bookings', value: 'bookings' }, { label: 'Room nights', value: 'roomNights' },
          { label: 'Gross revenue', value: 'revenue' }, { label: 'Commission', value: 'commission' }, { label: 'Net payout', value: 'payout' }, { label: 'Cancelled', value: 'cancelled' },
        ]);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="lexatrip-report-${from.toISOString().slice(0, 10)}.csv"`);
        return res.send(csv);
      }
      ok(res, { from, to, byProperty, byRoom, byStatus, daily, occupancy });
    },
  };
}

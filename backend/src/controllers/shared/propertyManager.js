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
import { ok, created } from '../../utils/response.js';
import { ApiError } from '../../utils/ApiError.js';
import { buildListQuery, pageMeta } from '../../utils/queryBuilder.js';
import { slugify, toDay, addDays, randomCode, toCsv } from '../../utils/helpers.js';
import Deal from '../../models/Deal.js';
import { Category } from '../../models/Catalog.js';
import { prepareDeal, dealRows, dealStatus, DEAL_LIMITS } from '../../services/deal.service.js';
import { publish } from '../../services/live.service.js';
import { bookingFilters, propertyFilters, propertyFilterOptions } from '../../services/listFilters.service.js';
import { editorOptions, keepApproved, createRequest, vendorRequests, adminRequests, decideRequest } from '../../services/catalogRequest.service.js';

import { today, daysFromToday, dayStart, platformTimezone } from '../../utils/clock.js';
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

  /** Collections like "Deals of the day" are filled automatically — they can't be a property's type. */
  async function assertPropertyType(categoryId) {
    if (!categoryId) return;
    const c = await Category.findById(categoryId).select('kind name').lean();
    if (!c) throw ApiError.badRequest('Unknown property type');
    if (c.kind === 'deals') throw ApiError.badRequest(`“${c.name}” is filled automatically from live deals — choose a property type like Hotel or Villa`);
  }

  async function refreshMinPrice(propertyId) {
    const r = await RoomType.find({ property: propertyId, isActive: true }).select('basePrice').lean();
    await Property.updateOne({ _id: propertyId }, { minPrice: r.length ? Math.min(...r.map((x) => x.basePrice)) : 0 });
  }

  return {
    // ─── Properties ───
    async list(req, res) {
      const { skip, limit, page, sort } = buildListQuery(req.query);
      const { filter, counts } = await propertyFilters(req.query, isVendor ? req.vendor._id : null);
      const [items, total] = await Promise.all([
        Property.find(filter).sort(sort).skip(skip).limit(limit).populate('category', 'name').populate('address.city', 'name').populate('vendor', 'businessName email').lean(),
        Property.countDocuments(filter),
      ]);
      ok(res, items, { ...pageMeta(total, page, limit), counts });
    },
    async filterOptions(_req, res) {
      ok(res, await propertyFilterOptions());
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
      await assertPropertyType(body.category);
      if (isVendor) await keepApproved(body);
      delete body.starRating; // ratings come only from guest reviews
      delete body.rating;
      body.vendor = isVendor ? req.vendor._id : body.vendor;
      if (!body.vendor) throw ApiError.badRequest('Vendor is required');
      body.slug = slugify(body.slug || `${body.name}-${randomCode('', 4).toLowerCase()}`);
      body.status = isVendor ? 'draft' : body.status || 'approved';
      delete body.isFeatured;
      if (isVendor) { delete body.isVisible; delete body.statusNote; }
      const p = await Property.create(body);
      audit(req, 'property.create', 'Property', p._id);
      created(res, p);
    },
    async update(req, res) {
      const p = await ownProperty(req);
      const body = { ...req.body };
      if (body.category) await assertPropertyType(body.category?._id || body.category);
      delete body.vendor;
      delete body.rating;
      delete body.starRating; // ratings come only from guest reviews
      delete body.minPrice;
      if (isVendor) await keepApproved(body, p);
      if (isVendor) {
        delete body.status;
        delete body.isFeatured;
        delete body.statusNote;
        delete body.isVisible;
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
      if (p.status === 'pending') throw ApiError.conflict('Already waiting for approval');
      if (!['draft', 'rejected'].includes(p.status)) throw ApiError.conflict(`This property is ${p.status}, so it can’t be submitted`);
      const rooms = await RoomType.countDocuments({ property: p._id, isActive: true });
      if (!rooms) throw ApiError.badRequest('Add at least one room type before submitting');
      if (!p.images?.length) throw ApiError.badRequest('Add at least one photo before submitting');
      p.status = 'pending';
      p.statusNote = undefined;
      await p.save();
      await notify({ recipientType: 'admin', title: 'Property awaiting approval', body: p.name, type: 'property_pending', data: { propertyId: p._id } });
      ok(res, p, undefined, 'Submitted for approval');
    },
    async uploadImages(req, res) {
      const files = req.files || [];
      ok(res, files.map((f) => ({ url: f.url, alt: '' })));
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
        await Inventory.updateMany({ roomType: rt._id, date: { $gte: today() }, source: { $ne: 'channel' } }, { totalRooms: rt.totalRooms });
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
    // ─── Deals ("Deals of the day") ───
    async deals(req, res) {
      const filter = { ...scope(req) };
      if (req.query.property) filter.property = String(req.query.property);
      const rows = await dealRows(filter);
      const counts = rows.reduce((m, d) => ({ ...m, [d.status]: (m[d.status] || 0) + 1 }), {});
      const status = String(req.query.status || '');
      ok(res, status ? rows.filter((d) => (status === 'upcoming' ? ['scheduled', 'paused'].includes(d.status) && d.endDate >= today() : d.status === status)) : rows, { counts, limits: DEAL_LIMITS });
    },
    async createDeal(req, res) {
      if (isVendor && req.vendor.permissions?.canEditPricing === false) throw ApiError.forbidden('Pricing edits are disabled for your account');
      const p = await ownProperty(req, req.body.property);
      const deal = await Deal.create({ ...(await prepareDeal(req.body, p)), createdByType: actor(req), createdBy: (req.vendor || req.admin)._id });
      audit(req, 'deal.create', 'Deal', deal._id, { property: p._id, value: deal.value, discountType: deal.discountType });
      publish('content', { scope: 'deals' });
      created(res, { ...deal.toObject(), status: dealStatus(deal) }, dealStatus(deal) === 'live' ? 'Deal is live — guests see it now' : 'Deal scheduled');
    },
    async updateDeal(req, res) {
      if (isVendor && req.vendor.permissions?.canEditPricing === false) throw ApiError.forbidden('Pricing edits are disabled for your account');
      const deal = await Deal.findOne({ _id: req.params.dealId, ...scope(req) });
      if (!deal) throw ApiError.notFound('Deal not found');
      if (dealStatus(deal) === 'ended') throw ApiError.badRequest('This deal has ended — create a new one instead');
      const p = await ownProperty(req, deal.property);
      const merged = { ...deal.toObject(), ...req.body, property: deal.property };
      Object.assign(deal, await prepareDeal(merged, p, { existingId: deal._id }));
      await deal.save();
      audit(req, 'deal.update', 'Deal', deal._id, { isActive: deal.isActive, value: deal.value });
      publish('content', { scope: 'deals' });
      ok(res, { ...deal.toObject(), status: dealStatus(deal) }, deal.isActive ? 'Deal updated' : 'Deal paused');
    },
    /** Ends a running deal today (keeps history); deletes one that never ran. */
    async removeDeal(req, res) {
      const deal = await Deal.findOne({ _id: req.params.dealId, ...scope(req) });
      if (!deal) throw ApiError.notFound('Deal not found');
      const s = dealStatus(deal);
      if (s === 'scheduled' || (s === 'paused' && toDay(deal.startDate) > today())) {
        await deal.deleteOne();
        audit(req, 'deal.delete', 'Deal', deal._id);
      } else if (s !== 'ended') {
        // stop it right now: yesterday as end date → not live any more, history stays for reports
        deal.endDate = daysFromToday(-1);
        if (deal.endDate < toDay(deal.startDate)) deal.startDate = deal.endDate;
        deal.isActive = false;
        await deal.save();
        audit(req, 'deal.end', 'Deal', deal._id);
      }
      publish('content', { scope: 'deals' });
      ok(res, null, undefined, s === 'scheduled' ? 'Deal deleted' : 'Deal ended');
    },

    // ─── Vendor requests (new tags, house rules, amenities, room features) ───
    async options(_req, res) { ok(res, await editorOptions()); },
    async requests(req, res) {
      if (isVendor) return ok(res, await vendorRequests(req.vendor._id));
      const { items, meta } = await adminRequests(req.query);
      return ok(res, items, meta);
    },
    async createRequest(req, res) { created(res, await createRequest(req.vendor, req.body), 'Sent for approval'); },
    async decideRequest(req, res) {
      const doc = await decideRequest(req.params.id, req.body, req.admin._id);
      audit(req, `catalogRequest.${doc.status}`, 'CatalogRequest', doc._id, { name: doc.name, kind: doc.kind });
      ok(res, doc, undefined, `Request ${doc.status}`);
    },

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
      const from = req.query.from ? toDay(req.query.from) : today();
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
      const { skip, limit, page, sort } = buildListQuery(req.query);
      const { filter, counts } = await bookingFilters(req.query, isVendor ? req.vendor._id : null);
      const [items, total] = await Promise.all([
        Booking.find(filter).sort(sort).skip(skip).limit(limit).populate('user', 'name phone email').populate('property', 'name').lean(),
        Booking.countDocuments(filter),
      ]);
      ok(res, items, { ...pageMeta(total, page, limit), counts });
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
      const from = dayStart(req.query.from ? toDay(req.query.from) : daysFromToday(-30)); // createdAt is a timestamp
      const to = dayStart(req.query.to ? addDays(req.query.to, 1) : daysFromToday(1));
      const match = { ...scope(req), type: 'hotel', createdAt: { $gte: from, $lt: to }, status: { $nin: ['pending_payment', 'failed', 'expired'] } };
      if (req.query.property) match.property = new mongoose.Types.ObjectId(String(req.query.property));
      const [byProperty, byRoom, byStatus, daily] = await Promise.all([
        Booking.aggregate([{ $match: match }, { $group: { _id: '$property', name: { $first: '$snapshot.propertyName' }, bookings: { $sum: 1 }, roomNights: { $sum: { $multiply: ['$nights', '$rooms'] } }, revenue: { $sum: '$pricing.totalAmount' }, commission: { $sum: '$commission.amount' }, payout: { $sum: '$vendorPayoutAmount' }, cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } } } }, { $sort: { revenue: -1 } }]),
        Booking.aggregate([{ $match: match }, { $group: { _id: '$roomType', property: { $first: '$snapshot.propertyName' }, name: { $first: '$snapshot.roomName' }, bookings: { $sum: 1 }, roomNights: { $sum: { $multiply: ['$nights', '$rooms'] } }, revenue: { $sum: '$pricing.totalAmount' } } }, { $sort: { revenue: -1 } }]),
        Booking.aggregate([{ $match: match }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
        Booking.aggregate([{ $match: match }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: platformTimezone() } }, bookings: { $sum: 1 }, revenue: { $sum: '$pricing.totalAmount' } } }, { $sort: { _id: 1 } }]),
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

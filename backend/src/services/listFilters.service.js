import mongoose from 'mongoose';
import Booking from '../models/Booking.js';
import Property from '../models/Property.js';
import Vendor from '../models/Vendor.js';
import { City } from '../models/Location.js';
import { Category } from '../models/Catalog.js';
import { BOOKING_STATUS, PAYMENT_STATUS, PROPERTY_STATUS } from '../constants/enums.js';
import { toDay, addDays, escapeRegex } from '../utils/helpers.js';
import { today, dayStart } from '../utils/clock.js';

/** Filters + tab counts for the bookings and properties lists (vendor and admin panels). */

const DAY_RX = /^\d{4}-\d{2}-\d{2}$/;
const day = (v) => (DAY_RX.test(String(v || '')) && !Number.isNaN(Date.parse(v)) ? String(v) : null);
const oneOf = (v, list) => (list.includes(v) ? v : null);
const id = (v) => (mongoose.isValidObjectId(v) ? new mongoose.Types.ObjectId(String(v)) : null);

/** { $gte, $lt } for an inclusive from–to pair; `at` turns a calendar day into the stored value */
function range(query, at) {
  const from = day(query.from);
  const to = day(query.to);
  if (!from && !to) return null;
  return { ...(from && { $gte: at(from) }), ...(to && { $lt: at(addDays(to, 1).toISOString().slice(0, 10)) }) };
}

const BOOKING_TABS = () => {
  const now = today();
  return {
    approval: { status: 'pending_approval' },
    upcoming: {
      status: { $in: ['confirmed', 'pending_approval'] },
      // hotels have a check-in day; bus / flight trips keep their departure as an ISO string
      $or: [{ checkIn: { $gte: now } }, { 'trip.departure': { $gte: new Date().toISOString() } }],
    },
    active: { status: 'checked_in' },
    completed: { status: { $in: ['checked_out', 'completed'] } },
    cancelled: { status: 'cancelled' },
    failed: { status: { $in: ['failed', 'expired'] } },
  };
};

/**
 * ?q &tab &type &status &paymentStatus &property &source &dateField=booked|checkin|checkout &from &to
 * Returns the list filter and the number of bookings behind every tab (with the other filters applied).
 */
export async function bookingFilters(query, vendorId) {
  const and = [];
  if (vendorId) and.push({ vendor: vendorId, type: 'hotel', status: { $ne: 'pending_payment' } });
  else if (oneOf(query.type, ['hotel', 'bus', 'flight'])) and.push({ type: query.type });
  if (oneOf(query.status, BOOKING_STATUS)) and.push({ status: query.status });
  if (oneOf(query.paymentStatus, PAYMENT_STATUS)) and.push({ paymentStatus: query.paymentStatus });
  if (id(query.property)) and.push({ property: id(query.property) });
  if (query.source) and.push({ source: String(query.source) });

  const q = String(query.q || '').trim().slice(0, 80);
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    and.push({ $or: ['bookingCode', 'primaryGuest.name', 'primaryGuest.phone', 'primaryGuest.email', 'pnr', 'snapshot.propertyName'].map((f) => ({ [f]: rx })) });
  }

  if (query.dateField === 'checkin') {
    const stay = range(query, toDay); // calendar day (hotels)
    const trip = range(query, (d) => dayStart(d).toISOString()); // departure timestamp (bus / flight)
    if (stay) and.push({ $or: [{ checkIn: stay }, { 'trip.departure': trip }] });
  } else if (query.dateField === 'checkout') {
    const r = range(query, toDay);
    if (r) and.push({ checkOut: r });
  } else {
    const r = range(query, dayStart); // booked on: platform-timezone days
    if (r) and.push({ createdAt: r });
  }

  const base = and.length ? { $and: and } : {};
  const tabs = BOOKING_TABS();
  const filter = tabs[query.tab] ? { $and: [...and, tabs[query.tab]] } : base;

  const facets = Object.fromEntries([['all', []], ...Object.entries(tabs).map(([k, f]) => [k, [{ $match: f }]])].map(([k, stages]) => [k, [...stages, { $count: 'n' }]]));
  const [res] = await Booking.aggregate([{ $match: base }, { $facet: facets }]);
  const counts = Object.fromEntries(Object.entries(res).map(([k, v]) => [k, v[0]?.n || 0]));
  return { filter, counts };
}

/** ?q &status &city &category &vendor &flag=featured|hidden &from &to (date added) */
export async function propertyFilters(query, vendorId) {
  const filter = vendorId ? { vendor: vendorId } : {};
  if (!vendorId && id(query.vendor)) filter.vendor = id(query.vendor);
  if (id(query.city)) filter['address.city'] = id(query.city);
  if (id(query.category)) filter.category = id(query.category);
  if (query.flag === 'featured' || query.isFeatured === 'true') filter.isFeatured = true;
  if (query.flag === 'hidden') filter.isVisible = false;
  const added = range(query, dayStart);
  if (added) filter.createdAt = added;

  const q = String(query.q || '').trim().slice(0, 80);
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    const [cities, vendors] = await Promise.all([
      City.find({ name: rx }).distinct('_id'),
      vendorId ? [] : Vendor.find({ $or: [{ businessName: rx }, { email: rx }] }).distinct('_id'),
    ]);
    filter.$or = [{ name: rx }, { slug: rx }, { 'address.area': rx }, { 'address.city': { $in: cities } }, ...(vendors.length ? [{ vendor: { $in: vendors } }] : [])];
  }

  const grouped = await Property.aggregate([{ $match: filter }, { $group: { _id: '$status', n: { $sum: 1 } } }]);
  const counts = Object.fromEntries(PROPERTY_STATUS.map((s) => [s, grouped.find((g) => g._id === s)?.n || 0]));
  counts.all = grouped.reduce((sum, g) => sum + g.n, 0);
  return { filter: oneOf(query.status, PROPERTY_STATUS) ? { ...filter, status: query.status } : filter, counts };
}

/** Dropdown choices: only cities / types / vendors that actually have listings */
export async function propertyFilterOptions() {
  const [cityIds, categoryIds, vendorIds] = await Promise.all([Property.distinct('address.city'), Property.distinct('category'), Property.distinct('vendor')]);
  const [cities, categories, vendors] = await Promise.all([
    City.find({ _id: { $in: cityIds } }).sort({ name: 1 }).select('name').lean(),
    Category.find({ _id: { $in: categoryIds } }).sort({ sortOrder: 1 }).select('name').lean(),
    Vendor.find({ _id: { $in: vendorIds } }).sort({ businessName: 1 }).select('businessName').lean(),
  ]);
  return { cities, categories, vendors };
}

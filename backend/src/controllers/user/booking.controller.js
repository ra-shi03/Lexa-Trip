import { z } from 'zod';
import Booking from '../../models/Booking.js';
import { createHotelBooking, createBusBooking, createFlightBooking, cancelBooking, computeHotelRefund } from '../../services/booking.service.js';
import { ok, created } from '../../utils/response.js';
import { ApiError } from '../../utils/ApiError.js';
import { pageMeta } from '../../utils/queryBuilder.js';
import { withReviewState } from '../../services/review.service.js';

const guest = z.object({
  name: z.string().trim().min(2, 'Guest name is required'),
  email: z.string().trim().email('Valid email is required'),
  phone: z.string().trim().regex(/^[6-9]\d{9}$/, 'Valid mobile number is required'),
});

export const schemas = {
  hotel: z.object({
    propertyId: z.string(),
    roomTypeId: z.string(),
    ratePlanCode: z.string().optional(),
    checkIn: z.string(),
    checkOut: z.string(),
    rooms: z.coerce.number().int().min(1),
    adults: z.coerce.number().int().min(1),
    children: z.coerce.number().int().min(0).default(0),
    couponCode: z.string().trim().optional(),
    primaryGuest: guest,
    specialRequests: z.string().max(500).optional(),
    idempotencyKey: z.string().max(64).optional(),
  }),
  bus: z.object({
    tripId: z.string(),
    seats: z.array(z.string()).min(1).max(6),
    boardingPoint: z.string().optional(),
    droppingPoint: z.string().optional(),
    passengers: z.array(z.object({ fullName: z.string().min(2), age: z.coerce.number().int().min(1).max(120), gender: z.string() })).min(1),
    primaryGuest: guest,
    couponCode: z.string().optional(),
  }).refine((d) => d.passengers.length === d.seats.length, { message: 'One passenger per seat is required', path: ['passengers'] }),
  flight: z.object({
    flightId: z.string(),
    fareCode: z.string(),
    passengers: z.array(z.object({
      fullName: z.string().min(2),
      gender: z.string(),
      age: z.coerce.number().int().min(0).max(120).optional(),
      type: z.enum(['adult', 'child', 'infant']).default('adult'),
      idType: z.string().optional(),
      idNumber: z.string().optional(),
    })).min(1).max(9),
    primaryGuest: guest,
    couponCode: z.string().optional(),
  }),
  cancel: z.object({ reason: z.string().trim().min(3).max(300) }),
};

const sourceOf = (req) => (req.get('x-client') === 'app' ? 'app' : 'web');

export async function createHotel(req, res) {
  created(res, await createHotelBooking({ user: req.user, input: req.body, source: sourceOf(req) }), 'Rooms held — complete payment to confirm');
}
export async function createBus(req, res) {
  created(res, await createBusBooking({ user: req.user, input: req.body, source: sourceOf(req) }), 'Seats held — complete payment to confirm');
}
export async function createFlight(req, res) {
  created(res, await createFlightBooking({ user: req.user, input: req.body, source: sourceOf(req) }), 'Fare held — complete payment to confirm');
}

/** ?tab=upcoming|completed|cancelled &type=hotel|bus|flight */
export async function myBookings(req, res) {
  const { tab = 'upcoming', type, page = 1, limit = 20 } = req.query;
  const now = new Date();
  const filter = { user: req.user._id, status: { $nin: ['pending_payment', 'failed', 'expired'] } };
  if (type) filter.type = type;
  if (tab === 'cancelled') filter.status = 'cancelled';
  else if (tab === 'completed') {
    filter.status = { $in: ['confirmed', 'checked_out', 'completed'] };
    filter.$or = [{ checkOut: { $lt: now } }, { 'trip.departure': { $lt: now.toISOString() } }];
  } else {
    filter.status = { $in: ['confirmed', 'pending_approval', 'checked_in'] };
    filter.$or = [{ checkOut: { $gte: now } }, { 'trip.departure': { $gte: now.toISOString() } }];
  }
  const [items, total] = await Promise.all([
    Booking.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(+limit).select('-commission -vendorPayoutAmount -payout').lean(),
    Booking.countDocuments(filter),
  ]);
  ok(res, await withReviewState(items, req.user._id), pageMeta(total, +page, +limit));
}

export async function bookingDetail(req, res) {
  const b = await Booking.findOne({ _id: req.params.id, user: req.user._id })
    .select('-commission -vendorPayoutAmount -payout')
    .populate('property', 'name slug address contact checkInTime checkOutTime images cancellationPolicy geo')
    .lean();
  if (!b) throw ApiError.notFound('Booking not found');
  ok(res, (await withReviewState([b], req.user._id))[0]);
}

/** Shows the refund the guest would get before they confirm cancellation */
export async function cancellationPreview(req, res) {
  const b = await Booking.findOne({ _id: req.params.id, user: req.user._id });
  if (!b) throw ApiError.notFound();
  if (b.type !== 'hotel') return ok(res, { note: 'Refund is calculated by the operator/airline at cancellation time as per fare rules.' });
  ok(res, await computeHotelRefund(b));
}

export async function cancel(req, res) {
  const b = await Booking.findOne({ _id: req.params.id, user: req.user._id });
  if (!b) throw ApiError.notFound();
  const out = await cancelBooking(b, { by: 'user', reason: req.body.reason });
  ok(res, out, undefined, 'Booking cancelled');
}

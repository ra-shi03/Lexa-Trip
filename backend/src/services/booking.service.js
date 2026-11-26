import Booking from '../models/Booking.js';
import Property from '../models/Property.js';
import RoomType from '../models/RoomType.js';
import Vendor from '../models/Vendor.js';
import { Coupon } from '../models/Catalog.js';
import { Payment } from '../models/Finance.js';
import { quoteHotel, resolveCommission, commissionAmount, validateCoupon } from './pricing.service.js';
import { reserve, release } from './inventory.service.js';
import { getSettings } from './settings.service.js';
import { gatewayByName } from './payment/gateway.js';
import { busProvider } from './providers/bus/index.js';
import { flightProvider } from './providers/flight/index.js';
import { notify, sendEmail, bookingEmailHtml } from './notification/notification.service.js';
import { ApiError } from '../utils/ApiError.js';
import { randomCode, round2, toDay } from '../utils/helpers.js';

const CODE_PREFIX = { hotel: 'LTH', bus: 'LTB', flight: 'LTF' };
const holdUntil = async () => new Date(Date.now() + (await getSettings()).booking.holdMinutes * 60000);

// ─────────────────────────────── HOTEL ───────────────────────────────
export async function createHotelBooking({ user, input, source = 'web' }) {
  if (input.idempotencyKey) {
    const existing = await Booking.findOne({ idempotencyKey: input.idempotencyKey, user: user._id });
    if (existing) return existing;
  }
  const quote = await quoteHotel({ ...input, userId: user._id });
  if (!quote.available) throw ApiError.conflict(quote.reason || 'Not available for the selected dates');
  if (input.couponCode && quote.pricing.couponError) throw ApiError.badRequest(quote.pricing.couponError);

  await reserve(quote.roomType._id, quote.checkIn, quote.checkOut, quote.rooms);

  const commission = await resolveCommission({ service: 'hotel', vendorId: quote.property.vendor, categoryId: quote.property.category });
  const commissionBase = round2(quote.pricing.totalAmount - quote.pricing.taxes - quote.pricing.fees);
  const commAmt = commissionAmount(commission, commissionBase);

  try {
    return await Booking.create({
      bookingCode: randomCode(`${CODE_PREFIX.hotel}-`),
      type: 'hotel',
      user: user._id,
      source,
      idempotencyKey: input.idempotencyKey,
      vendor: quote.property.vendor,
      property: quote.property._id,
      roomType: quote.roomType._id,
      ratePlan: quote.ratePlan,
      checkIn: quote.checkIn,
      checkOut: quote.checkOut,
      nights: quote.nights,
      rooms: quote.rooms,
      guests: quote.guests,
      snapshot: { propertyName: quote.property.name, roomName: quote.roomType.name, city: quote.property.city, image: quote.property.image },
      primaryGuest: input.primaryGuest,
      specialRequests: input.specialRequests,
      pricing: { ...quote.pricing, dealTitle: quote.pricing.deal?.title }, // deal savings are recorded on the booking
      commission: { ...commission, amount: commAmt },
      vendorPayoutAmount: round2(commissionBase - commAmt),
      status: 'pending_payment',
      holdExpiresAt: await holdUntil(),
      inventoryReserved: true,
      statusHistory: [{ status: 'pending_payment', by: 'user' }],
    });
  } catch (e) {
    await release(quote.roomType._id, quote.checkIn, quote.checkOut, quote.rooms, 'booking_failed');
    throw e;
  }
}

// ─────────────────────────────── BUS ───────────────────────────────
export async function createBusBooking({ user, input, source = 'web' }) {
  const provider = busProvider();
  const block = await provider.block({ tripId: input.tripId, seats: input.seats, passengers: input.passengers });
  const settings = await getSettings();
  let discount = 0;
  if (input.couponCode) discount = (await validateCoupon(input.couponCode, { service: 'bus', amount: block.fare, userId: user._id })).discount;
  const taxable = round2(block.fare - discount);
  const taxes = round2((taxable * (settings.tax.busRate || 0)) / 100);
  const fees = round2(settings.booking.convenienceFee || 0);
  const commission = await resolveCommission({ service: 'bus' });
  return Booking.create({
    bookingCode: randomCode(`${CODE_PREFIX.bus}-`),
    type: 'bus',
    user: user._id,
    source,
    provider: provider.name,
    providerRef: block.blockKey,
    trip: { ...block.trip, boardingPoint: input.boardingPoint, droppingPoint: input.droppingPoint, seats: input.seats },
    passengers: input.passengers.map((p, i) => ({ ...p, seatNo: input.seats[i] })),
    primaryGuest: input.primaryGuest,
    pricing: { currency: 'INR', baseAmount: block.fare, discount, couponCode: discount ? input.couponCode.toUpperCase() : undefined, taxes, fees, totalAmount: round2(taxable + taxes + fees) },
    commission: { ...commission, amount: commissionAmount(commission, taxable) },
    status: 'pending_payment',
    holdExpiresAt: await holdUntil(),
    statusHistory: [{ status: 'pending_payment', by: 'user' }],
  });
}

// ─────────────────────────────── FLIGHT ───────────────────────────────
export async function createFlightBooking({ user, input, source = 'web' }) {
  const provider = flightProvider();
  const pax = {
    adults: input.passengers.filter((p) => p.type === 'adult').length,
    children: input.passengers.filter((p) => p.type === 'child').length,
    infants: input.passengers.filter((p) => p.type === 'infant').length,
  };
  if (!pax.adults) throw ApiError.badRequest('At least one adult passenger is required');
  const { flight, fare } = await provider.fareQuote(input.flightId, input.fareCode, pax);
  const settings = await getSettings();
  let discount = 0;
  if (input.couponCode) discount = (await validateCoupon(input.couponCode, { service: 'flight', amount: fare.total, userId: user._id })).discount;
  const taxable = round2(fare.total - discount);
  const taxes = round2((taxable * (settings.tax.flightRate || 0)) / 100);
  const fees = round2(settings.booking.convenienceFee || 0);
  const commission = await resolveCommission({ service: 'flight' });
  return Booking.create({
    bookingCode: randomCode(`${CODE_PREFIX.flight}-`),
    type: 'flight',
    user: user._id,
    source,
    provider: provider.name,
    trip: { ...flight, fares: undefined, fare },
    passengers: input.passengers,
    primaryGuest: input.primaryGuest,
    pricing: { currency: 'INR', baseAmount: fare.total, discount, couponCode: discount ? input.couponCode.toUpperCase() : undefined, taxes, fees, totalAmount: round2(taxable + taxes + fees) },
    commission: { ...commission, amount: commissionAmount(commission, taxable) },
    status: 'pending_payment',
    holdExpiresAt: await holdUntil(),
    statusHistory: [{ status: 'pending_payment', by: 'user' }],
  });
}

// ─────────────────────────────── LIFECYCLE ───────────────────────────────
/** Called once the gateway confirms payment. Idempotent. */
export async function confirmBooking(booking) {
  if (['confirmed', 'pending_approval', 'checked_in', 'completed'].includes(booking.status)) return booking;
  if (booking.status !== 'pending_payment') throw ApiError.conflict(`Booking is ${booking.status}`);

  booking.paymentStatus = 'paid';
  booking.holdExpiresAt = undefined;

  if (booking.type === 'hotel') {
    const settings = await getSettings();
    const vendor = await Vendor.findById(booking.vendor).lean();
    const needsApproval = settings.features.requestToBook || vendor?.permissions?.instantBooking === false;
    booking.pushStatus(needsApproval ? 'pending_approval' : 'confirmed', 'system', 'Payment received');
  } else {
    // Provider ticketing happens after payment capture
    const provider = booking.type === 'bus' ? busProvider() : flightProvider();
    const ticket = booking.type === 'bus' ? await provider.confirm(booking.providerRef) : await provider.book({ flightId: booking.trip.id, passengers: booking.passengers });
    booking.pnr = ticket.pnr;
    booking.ticketNo = ticket.ticketNo;
    booking.providerRef = ticket.providerRef;
    booking.pushStatus('confirmed', 'system', 'Ticket issued');
  }
  await booking.save();

  if (booking.pricing.couponCode) await Coupon.updateOne({ code: booking.pricing.couponCode }, { $inc: { usedCount: 1 } });

  const email = booking.primaryGuest?.email;
  await notify({ recipientType: 'user', recipient: booking.user, title: `Booking ${booking.status === 'confirmed' ? 'confirmed' : 'received'} · ${booking.bookingCode}`, body: booking.type === 'hotel' ? `${booking.snapshot.propertyName}, ${booking.snapshot.city}` : `${booking.trip.from} → ${booking.trip.to}`, type: 'booking_confirmed', data: { bookingId: booking._id } });
  if (email) await sendEmail({ to: email, subject: `Your LexaTrip booking ${booking.bookingCode}`, html: bookingEmailHtml(booking) });
  if (booking.vendor) await notify({ recipientType: 'vendor', recipient: booking.vendor, title: `New booking ${booking.bookingCode}`, body: `${booking.snapshot.roomName} · ${booking.nights} night(s)`, type: 'new_booking', data: { bookingId: booking._id } });
  return booking;
}

export async function failBooking(booking, reason = 'Payment failed') {
  if (booking.status !== 'pending_payment') return booking;
  if (booking.type === 'hotel' && booking.inventoryReserved) {
    await release(booking.roomType, booking.checkIn, booking.checkOut, booking.rooms, 'payment_failed');
    booking.inventoryReserved = false;
  }
  booking.paymentStatus = 'failed';
  booking.pushStatus('failed', 'system', reason);
  return booking.save();
}

/** Scheduler: release inventory held by unpaid bookings. */
export async function expireHolds() {
  const stale = await Booking.find({ status: 'pending_payment', holdExpiresAt: { $lt: new Date() } }).limit(200);
  for (const b of stale) {
    if (b.type === 'hotel' && b.inventoryReserved) {
      await release(b.roomType, b.checkIn, b.checkOut, b.rooms, 'hold_expired');
      b.inventoryReserved = false;
    }
    b.pushStatus('expired', 'system', 'Payment window elapsed');
    await b.save();
  }
  return stale.length;
}

/** Refund calculation per property cancellation policy + rate plan */
export async function computeHotelRefund(booking) {
  const paid = booking.pricing.totalAmount;
  if (booking.paymentStatus !== 'paid') return { refundAmount: 0, penaltyAmount: 0 };
  if (booking.ratePlan?.refundable === false) return { refundAmount: round2(booking.pricing.taxes), penaltyAmount: round2(paid - booking.pricing.taxes) };
  const property = await Property.findById(booking.property).lean();
  const policy = property?.cancellationPolicy || { type: 'free', freeCancellationHours: 24, penaltyPercent: 0 };
  const checkInAt = new Date(toDay(booking.checkIn).getTime() + 14 * 3600000); // ≈ 14:00 check-in
  const hoursLeft = (checkInAt - Date.now()) / 3600000;
  if (policy.type === 'non_refundable') return { refundAmount: 0, penaltyAmount: paid };
  if (hoursLeft >= (policy.freeCancellationHours ?? 24)) return { refundAmount: paid, penaltyAmount: 0 };
  const firstNight = booking.pricing.nightly?.[0]?.amount * booking.rooms || 0;
  const penalty = policy.type === 'partial' ? round2((paid * (policy.penaltyPercent || 0)) / 100) : round2(Math.min(paid, firstNight));
  return { refundAmount: round2(paid - penalty), penaltyAmount: penalty };
}

/**
 * Cancels a booking (user / vendor / admin / channel), releases inventory
 * and triggers the gateway refund.
 */
export async function cancelBooking(booking, { by, reason, forceFullRefund = false }) {
  if (['cancelled', 'failed', 'expired', 'checked_out', 'completed'].includes(booking.status)) {
    throw ApiError.conflict(`Booking is already ${booking.status}`);
  }
  if (booking.status === 'checked_in') throw ApiError.conflict('Guest has already checked in');

  let refund = { refundAmount: 0, penaltyAmount: 0 };
  if (booking.type === 'hotel') {
    refund = forceFullRefund ? { refundAmount: booking.pricing.totalAmount, penaltyAmount: 0 } : await computeHotelRefund(booking);
    if (booking.inventoryReserved) {
      await release(booking.roomType, booking.checkIn, booking.checkOut, booking.rooms, 'cancellation');
      booking.inventoryReserved = false;
    }
  } else if (booking.paymentStatus === 'paid') {
    const provider = booking.type === 'bus' ? busProvider() : flightProvider();
    const r = await provider.cancel({ pnr: booking.pnr, ticketNo: booking.ticketNo, fare: booking.pricing.baseAmount, total: booking.pricing.baseAmount, refundable: booking.trip?.fare?.refundable, departure: booking.trip?.departure });
    refund = { refundAmount: forceFullRefund ? booking.pricing.totalAmount : r.refundAmount, penaltyAmount: r.cancellationCharge };
  }

  booking.cancellation = {
    requestedAt: new Date(),
    requestedBy: by,
    reason,
    refundAmount: refund.refundAmount,
    penaltyAmount: refund.penaltyAmount,
    refundStatus: refund.refundAmount > 0 ? 'approved' : 'none',
  };
  booking.pushStatus('cancelled', by, reason);

  if (refund.refundAmount > 0) {
    const payment = await Payment.findOne({ booking: booking._id, status: 'success' });
    if (payment) {
      try {
        const r = await gatewayByName(payment.gateway).refund({ paymentId: payment.gatewayPaymentId, amount: refund.refundAmount });
        payment.refunds.push({ amount: refund.refundAmount, gatewayRefundId: r.refundId, status: r.status, at: new Date() });
        payment.status = refund.refundAmount >= payment.amount ? 'refunded' : 'partially_refunded';
        await payment.save();
        booking.cancellation.refundStatus = 'processed';
        booking.cancellation.processedAt = new Date();
        booking.paymentStatus = payment.status;
      } catch (e) {
        booking.cancellation.note = `Refund pending: ${e.message}`; // admin can retry from Refunds page
      }
    }
  }
  // Commission is not earned on refunded amounts
  if (booking.commission) booking.commission.amount = round2(((booking.commission.amount || 0) * (refund.penaltyAmount || 0)) / (booking.pricing.totalAmount || 1));
  booking.vendorPayoutAmount = booking.type === 'hotel' ? round2((refund.penaltyAmount || 0) - (booking.commission?.amount || 0)) : undefined;
  await booking.save();

  await notify({ recipientType: 'user', recipient: booking.user, title: `Booking cancelled · ${booking.bookingCode}`, body: refund.refundAmount ? `Refund of ₹${refund.refundAmount} initiated` : 'No refund applicable as per policy', type: 'booking_cancelled', data: { bookingId: booking._id } });
  if (booking.vendor) await notify({ recipientType: 'vendor', recipient: booking.vendor, title: `Booking cancelled · ${booking.bookingCode}`, body: reason || '', type: 'booking_cancelled', data: { bookingId: booking._id } });
  return booking;
}

/** Channel manager inbound reservations (OTA bookings) → our inventory stays in sync. */
export async function applyChannelEvent(property, evt) {
  const b = evt.booking || {};
  if (evt.kind === 'cancellation') {
    const existing = await Booking.findOne({ channelBookingRef: b.ref, property: property._id });
    if (!existing) return { ok: false, message: 'Booking not found' };
    await cancelBooking(existing, { by: 'channel', reason: 'Cancelled on OTA' });
    return { ok: true, message: `Cancelled ${existing.bookingCode}` };
  }
  const rt = await RoomType.findOne({ property: property._id, $or: [{ channelRoomId: b.roomCode }, { _id: b.roomCode?.match(/^[a-f0-9]{24}$/) ? b.roomCode : undefined }] });
  if (!rt) return { ok: false, message: `Room code ${b.roomCode} is not mapped` };
  const rooms = b.rooms || 1;
  if (evt.kind === 'modification') {
    const existing = await Booking.findOne({ channelBookingRef: b.ref, property: property._id });
    if (existing) await cancelBooking(existing, { by: 'channel', reason: 'Modified on OTA' });
  }
  await reserve(rt._id, b.checkIn, b.checkOut, rooms);
  const booking = await Booking.create({
    bookingCode: randomCode('LTC-'),
    type: 'hotel',
    source: 'channel',
    channelBookingRef: b.ref,
    vendor: property.vendor,
    property: property._id,
    roomType: rt._id,
    checkIn: toDay(b.checkIn),
    checkOut: toDay(b.checkOut),
    nights: Math.round((toDay(b.checkOut) - toDay(b.checkIn)) / 86400000),
    rooms,
    guests: { adults: b.adults || 2, children: b.children || 0 },
    snapshot: { propertyName: property.name, roomName: rt.name },
    primaryGuest: b.guest,
    pricing: { totalAmount: b.amount || 0, currency: 'INR' },
    status: 'confirmed',
    paymentStatus: 'paid',
    inventoryReserved: true,
    statusHistory: [{ status: 'confirmed', by: 'channel', note: `OTA ref ${b.ref}` }],
  });
  return { ok: true, message: `Created ${booking.bookingCode}` };
}

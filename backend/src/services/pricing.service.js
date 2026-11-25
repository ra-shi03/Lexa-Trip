import Property from '../models/Property.js';
import RoomType from '../models/RoomType.js';
import Booking from '../models/Booking.js';
import { PricingRule } from '../models/Inventory.js';
import { Coupon, CommissionRule } from '../models/Catalog.js';
import Vendor from '../models/Vendor.js';
import { getSettings } from './settings.service.js';
import { getAvailability } from './inventory.service.js';
import { ApiError } from '../utils/ApiError.js';
import { dayRange, nightsBetween, round2, toDay } from '../utils/helpers.js';

const WEEKEND = [5, 6]; // Friday & Saturday nights

function ruleMatches(rule, date) {
  if (rule.startDate && date < toDay(rule.startDate)) return false;
  if (rule.endDate && date > toDay(rule.endDate)) return false;
  if (rule.daysOfWeek?.length && !rule.daysOfWeek.includes(date.getUTCDay())) return false;
  return true;
}

function applyRule(price, rule) {
  if (rule.adjustmentType === 'fixed_price') return rule.value;
  if (rule.adjustmentType === 'amount') return price + rule.value;
  return price * (1 + rule.value / 100);
}

/** Price per room for each night. Precedence: per-date override → pricing rule → weekend → base. */
export async function nightlyRates(roomType, from, to, availabilityNights) {
  const dates = dayRange(from, to);
  const rules = await PricingRule.find({
    property: roomType.property,
    isActive: true,
    $or: [{ roomType: roomType._id }, { roomType: null }, { roomType: { $exists: false } }],
  })
    .sort({ priority: -1 })
    .lean();

  return dates.map((date) => {
    const override = availabilityNights?.find((n) => +toDay(n.date) === +date)?.price;
    if (override !== null && override !== undefined) return { date, amount: round2(override) };
    let price = WEEKEND.includes(date.getUTCDay()) && roomType.weekendPrice ? roomType.weekendPrice : roomType.basePrice;
    const rule = rules.find((r) => ruleMatches(r, date));
    if (rule) price = applyRule(price, rule);
    return { date, amount: round2(Math.max(0, price)) };
  });
}

export function gstRateFor(perRoomNightTariff, taxSettings) {
  const slab = (taxSettings.hotelSlabs || []).find((s) => s.upTo === null || perRoomNightTariff <= s.upTo);
  return slab ? slab.rate : 0;
}

export async function validateCoupon(code, { service, amount, userId }) {
  if (!code) return { discount: 0 };
  const now = new Date();
  const coupon = await Coupon.findOne({ code: String(code).toUpperCase(), isActive: true }).lean();
  if (!coupon) throw ApiError.badRequest('Invalid coupon code');
  if (coupon.validFrom && coupon.validFrom > now) throw ApiError.badRequest('This coupon is not active yet');
  if (coupon.validTo && coupon.validTo < now) throw ApiError.badRequest('This coupon has expired');
  if (!coupon.services.includes(service)) throw ApiError.badRequest(`This coupon is not valid for ${service} bookings`);
  if (amount < (coupon.minAmount || 0)) throw ApiError.badRequest(`Minimum booking amount for this coupon is ₹${coupon.minAmount}`);
  if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) throw ApiError.badRequest('This coupon has been fully redeemed');
  if (userId && coupon.perUserLimit) {
    const used = await Booking.countDocuments({
      user: userId,
      'pricing.couponCode': coupon.code,
      status: { $in: ['confirmed', 'checked_in', 'checked_out', 'completed'] },
    });
    if (used >= coupon.perUserLimit) throw ApiError.badRequest('You have already used this coupon');
  }
  let discount = coupon.discountType === 'percent' ? (amount * coupon.value) / 100 : coupon.value;
  if (coupon.maxDiscount) discount = Math.min(discount, coupon.maxDiscount);
  return { discount: round2(Math.min(discount, amount)), coupon };
}

/** Commission precedence: vendor override → vendor rule → category rule → service rule → global rule → settings default */
export async function resolveCommission({ service, vendorId, categoryId }) {
  const settings = await getSettings();
  if (vendorId) {
    const v = await Vendor.findById(vendorId).select('commissionRate').lean();
    if (v?.commissionRate !== undefined && v?.commissionRate !== null) return { type: 'percent', rate: v.commissionRate };
  }
  const rules = await CommissionRule.find({ isActive: true }).lean();
  const pickRule =
    rules.find((r) => r.scope === 'vendor' && String(r.vendor) === String(vendorId)) ||
    rules.find((r) => r.scope === 'category' && String(r.category) === String(categoryId)) ||
    rules.find((r) => r.scope === 'service' && r.service === service) ||
    rules.find((r) => r.scope === 'global');
  if (pickRule) return { type: pickRule.type, rate: pickRule.value };
  return { type: 'percent', rate: settings.commission.defaultRate ?? 15 };
}

export const commissionAmount = (c, base) => round2(c.type === 'flat' ? c.rate : (base * c.rate) / 100);

/**
 * Full hotel quote — used by the property page, checkout and booking creation.
 * Never trusts client prices: everything is recomputed server-side.
 */
export async function quoteHotel({ propertyId, roomTypeId, ratePlanCode, checkIn, checkOut, rooms = 1, adults = 2, children = 0, couponCode, userId }) {
  const settings = await getSettings();
  const nights = nightsBetween(checkIn, checkOut);
  if (!(nights >= 1)) throw ApiError.badRequest('Check-out must be after check-in');
  if (toDay(checkIn) < toDay(new Date())) throw ApiError.badRequest('Check-in date cannot be in the past');
  if (nights > settings.booking.maxNights) throw ApiError.badRequest(`Maximum stay is ${settings.booking.maxNights} nights`);
  if (rooms < 1 || rooms > settings.booking.maxRoomsPerBooking) throw ApiError.badRequest(`You can book 1–${settings.booking.maxRoomsPerBooking} rooms`);

  const property = await Property.findById(propertyId).populate('address.city', 'name').lean();
  if (!property || property.status !== 'approved' || !property.isVisible) throw ApiError.notFound('Property not available');
  const roomType = await RoomType.findOne({ _id: roomTypeId, property: propertyId, isActive: true }).lean();
  if (!roomType) throw ApiError.notFound('Room type not found');
  const ratePlan = roomType.ratePlans?.find((r) => r.code === ratePlanCode && r.isActive) ||
    roomType.ratePlans?.find((r) => r.isActive) || { code: 'EP', name: 'Room only', mealPlan: 'EP', refundable: true, priceAdjustment: 0 };

  if (adults > rooms * roomType.maxAdults) throw ApiError.badRequest(`Max ${roomType.maxAdults} adults per room — add more rooms`);
  if (children > rooms * roomType.maxChildren) throw ApiError.badRequest(`Max ${roomType.maxChildren} children per room — add more rooms`);
  if (adults + children > rooms * roomType.maxOccupancy) throw ApiError.badRequest(`Max ${roomType.maxOccupancy} guests per room`);

  const avail = (await getAvailability([roomType], checkIn, checkOut))[String(roomType._id)];
  const nightly = await nightlyRates(roomType, checkIn, checkOut, avail.nights);

  const baseAmount = round2(nightly.reduce((s, n) => s + n.amount, 0) * rooms);
  const extraAdults = Math.max(0, adults - rooms * roomType.baseOccupancy);
  const extraGuestAmount = round2((extraAdults * roomType.extraAdultCharge + children * roomType.extraChildCharge) * nights);
  const mealPlanAmount = round2((ratePlan.priceAdjustment || 0) * rooms * nights);
  const subTotal = round2(baseAmount + extraGuestAmount + mealPlanAmount);

  let discount = 0;
  let couponError;
  if (couponCode) {
    try {
      discount = (await validateCoupon(couponCode, { service: 'hotel', amount: subTotal, userId })).discount;
    } catch (e) {
      couponError = e.message;
    }
  }
  const taxable = round2(subTotal - discount);
  const perRoomNight = taxable / (rooms * nights);
  const taxRate = gstRateFor(perRoomNight, settings.tax);
  const taxes = settings.tax.pricesIncludeTax ? 0 : round2((taxable * taxRate) / 100);
  const fees = round2(settings.booking.convenienceFee || 0);
  const totalAmount = round2(taxable + taxes + fees);

  let available = avail.minAvailable >= rooms;
  let reason = available ? undefined : avail.minAvailable === 0 ? 'Sold out for the selected dates' : `Only ${avail.minAvailable} room(s) left`;
  if (available && nights < avail.minStay) {
    available = false;
    reason = `Minimum stay is ${avail.minStay} nights for these dates`;
  }

  return {
    property: { _id: property._id, name: property.name, slug: property.slug, city: property.address?.city?.name, image: property.images?.[0]?.url, vendor: property.vendor, category: property.category, cancellationPolicy: property.cancellationPolicy, checkInTime: property.checkInTime, checkOutTime: property.checkOutTime },
    roomType: { _id: roomType._id, name: roomType.name },
    ratePlan: { code: ratePlan.code, name: ratePlan.name, mealPlan: ratePlan.mealPlan, refundable: ratePlan.refundable },
    checkIn: toDay(checkIn),
    checkOut: toDay(checkOut),
    nights,
    rooms,
    guests: { adults, children },
    available,
    reason,
    roomsLeft: avail.minAvailable,
    pricing: {
      currency: settings.booking.currency,
      nightly,
      baseAmount,
      extraGuestAmount,
      mealPlanAmount,
      discount,
      couponCode: discount ? String(couponCode).toUpperCase() : undefined,
      couponError,
      taxRate,
      taxes,
      fees,
      totalAmount,
    },
  };
}

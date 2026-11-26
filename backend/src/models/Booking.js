import mongoose from 'mongoose';
import { BOOKING_STATUS, BOOKING_TYPES, PAYMENT_STATUS } from '../constants/enums.js';

const passengerSchema = new mongoose.Schema(
  {
    fullName: String,
    age: Number,
    gender: String,
    seatNo: String,
    idType: String,
    idNumber: String,
    type: { type: String, enum: ['adult', 'child', 'infant'], default: 'adult' },
  },
  { _id: false },
);

const bookingSchema = new mongoose.Schema(
  {
    bookingCode: { type: String, required: true, unique: true }, // LT-H-XXXXXXXX
    type: { type: String, enum: BOOKING_TYPES, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    source: { type: String, enum: ['web', 'app', 'channel', 'admin'], default: 'web' },
    idempotencyKey: { type: String, unique: true, sparse: true },

    // ── Hotel ──
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
    property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property' },
    roomType: { type: mongoose.Schema.Types.ObjectId, ref: 'RoomType' },
    ratePlan: { code: String, name: String, mealPlan: String, refundable: Boolean },
    checkIn: Date,
    checkOut: Date,
    nights: Number,
    rooms: Number,
    guests: { adults: Number, children: Number },
    snapshot: { propertyName: String, roomName: String, city: String, address: String, image: String },

    // ── Bus / Flight (provider-backed) ──
    provider: String,
    providerRef: String, // provider booking id
    pnr: String,
    ticketNo: String,
    trip: Object, // normalised bus/flight itinerary returned by the provider
    passengers: [passengerSchema],

    primaryGuest: { name: String, email: String, phone: String },
    specialRequests: String,

    pricing: {
      currency: { type: String, default: 'INR' },
      nightly: [{ date: Date, amount: Number, original: Number }],
      baseAmount: Number,
      dealSavings: Number, // vendor deal discount already inside baseAmount
      dealTitle: String,
      extraGuestAmount: Number,
      mealPlanAmount: Number,
      discount: Number,
      couponCode: String,
      taxes: Number,
      fees: Number,
      totalAmount: { type: Number, required: true },
    },
    commission: { rate: Number, type: { type: String }, amount: Number }, // revenue field
    vendorPayoutAmount: Number, // revenue field
    payout: { type: mongoose.Schema.Types.ObjectId, ref: 'Payout' }, // revenue field

    status: { type: String, enum: BOOKING_STATUS, default: 'pending_payment' },
    paymentStatus: { type: String, enum: PAYMENT_STATUS, default: 'pending' },
    holdExpiresAt: Date,
    inventoryReserved: { type: Boolean, default: false },

    cancellation: {
      requestedAt: Date,
      requestedBy: String, // user | vendor | admin | channel
      reason: String,
      refundAmount: Number,
      penaltyAmount: Number,
      refundStatus: { type: String, enum: ['none', 'requested', 'approved', 'processed', 'rejected'], default: 'none' },
      processedAt: Date,
      note: String,
    },
    channelBookingRef: String,
    statusHistory: [{ status: String, at: { type: Date, default: Date.now }, by: String, note: String }],
  },
  { timestamps: true },
);

// Query-driven indexes (ESR: equality → sort → range)
bookingSchema.index({ user: 1, createdAt: -1 }); // guest "my trips"
bookingSchema.index({ vendor: 1, status: 1, checkIn: 1 }); // vendor lists / arrivals / departures
bookingSchema.index({ vendor: 1, createdAt: -1 }); // vendor dashboard & reports
bookingSchema.index({ property: 1, checkIn: 1 }); // property calendar, delete-guard checks
bookingSchema.index({ roomType: 1, status: 1, checkOut: 1 }); // room delete-guard
bookingSchema.index({ type: 1, status: 1, createdAt: -1 }); // admin list filters
bookingSchema.index({ createdAt: -1 }); // default admin sort / date ranges
bookingSchema.index({ status: 1, holdExpiresAt: 1 }); // scheduler: expire unpaid holds (also covers status filter)
bookingSchema.index({ status: 1, checkOut: 1 }); // scheduler: auto-complete stays
bookingSchema.index({ paymentStatus: 1, createdAt: -1 }); // finance reports
bookingSchema.index({ channelBookingRef: 1 }, { sparse: true }); // OTA reservation lookup
bookingSchema.index({ payout: 1 }, { sparse: true });

bookingSchema.methods.pushStatus = function pushStatus(status, by = 'system', note = '') {
  this.status = status;
  this.statusHistory.push({ status, by, note });
};

export default mongoose.model('Booking', bookingSchema);

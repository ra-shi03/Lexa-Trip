import mongoose from 'mongoose';
import { MEAL_PLANS } from '../constants/enums.js';

const ratePlanSchema = new mongoose.Schema(
  {
    name: { type: String, required: true }, // "Room only – Free cancellation"
    code: { type: String, required: true }, // EP-FLEX, CP-NR …
    mealPlan: { type: String, enum: Object.keys(MEAL_PLANS), default: 'EP' },
    refundable: { type: Boolean, default: true },
    priceAdjustment: { type: Number, default: 0 }, // per room-night, added to base nightly rate (can be negative)
    isActive: { type: Boolean, default: true },
    channelRatePlanId: String,
  },
  { _id: true },
);

const roomTypeSchema = new mongoose.Schema(
  {
    property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: String,
    images: [{ url: String, alt: String }],
    amenities: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Amenity' }],
    bedType: String,
    sizeSqft: Number,
    view: String,
    baseOccupancy: { type: Number, default: 2 }, // adults included in price
    maxAdults: { type: Number, default: 2 },
    maxChildren: { type: Number, default: 1 },
    maxOccupancy: { type: Number, default: 3 },
    totalRooms: { type: Number, required: true, min: 0 },
    basePrice: { type: Number, required: true, min: 0 }, // weekday price per night
    weekendPrice: Number, // Fri/Sat nights; falls back to basePrice
    extraAdultCharge: { type: Number, default: 0 },
    extraChildCharge: { type: Number, default: 0 },
    ratePlans: [ratePlanSchema],
    isActive: { type: Boolean, default: true },
    channelRoomId: String,
  },
  { timestamps: true },
);

roomTypeSchema.index({ property: 1, isActive: 1 });

export default mongoose.model('RoomType', roomTypeSchema);

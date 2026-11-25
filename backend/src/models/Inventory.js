import mongoose from 'mongoose';

/**
 * One document per room type per night (UTC midnight).
 * Availability = totalRooms − booked − blocked (and not `closed`).
 * Reservations use atomic conditional $inc to prevent double booking.
 */
const inventorySchema = new mongoose.Schema(
  {
    property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
    roomType: { type: mongoose.Schema.Types.ObjectId, ref: 'RoomType', required: true },
    date: { type: Date, required: true },
    totalRooms: { type: Number, required: true, min: 0 },
    booked: { type: Number, default: 0, min: 0 },
    blocked: { type: Number, default: 0, min: 0 },
    price: { type: Number, default: null }, // date-specific override (special-date pricing / channel manager)
    closed: { type: Boolean, default: false }, // stop-sell
    minStay: { type: Number, default: 1 },
    source: { type: String, enum: ['system', 'vendor', 'admin', 'channel'], default: 'system' },
  },
  { timestamps: true },
);

inventorySchema.index({ roomType: 1, date: 1 }, { unique: true });
inventorySchema.index({ property: 1, date: 1 });

/** Audit trail of every inventory change (vendor/admin/channel/booking) */
const inventoryLogSchema = new mongoose.Schema(
  {
    property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', index: true },
    roomType: { type: mongoose.Schema.Types.ObjectId, ref: 'RoomType' },
    from: Date,
    to: Date,
    change: Object, // { totalRooms?, blocked?, price?, closed?, booked± }
    reason: String, // vendor_update, admin_update, booking, cancellation, channel_sync
    actorType: String,
    actor: mongoose.Schema.Types.ObjectId,
  },
  { timestamps: true },
);

/** Seasonal / weekday / special-date price rules (applied when no per-date override) */
const pricingRuleSchema = new mongoose.Schema(
  {
    property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true, index: true },
    roomType: { type: mongoose.Schema.Types.ObjectId, ref: 'RoomType' }, // empty = all room types
    name: { type: String, required: true },
    type: { type: String, enum: ['seasonal', 'special_date', 'day_of_week'], default: 'seasonal' },
    startDate: Date,
    endDate: Date,
    daysOfWeek: [{ type: Number, min: 0, max: 6 }], // 0 = Sunday
    adjustmentType: { type: String, enum: ['fixed_price', 'percent', 'amount'], default: 'percent' },
    value: { type: Number, required: true },
    priority: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

inventoryLogSchema.index({ property: 1, createdAt: -1 });
pricingRuleSchema.index({ property: 1, isActive: 1, priority: -1 });

export const Inventory = mongoose.model('Inventory', inventorySchema);
export const InventoryLog = mongoose.model('InventoryLog', inventoryLogSchema);
export const PricingRule = mongoose.model('PricingRule', pricingRuleSchema);

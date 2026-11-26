import mongoose from 'mongoose';

/**
 * Vendor-run limited-time discount on a property ("Deals of the day").
 * Applies to stay NIGHTS from startDate to endDate (both inclusive, UTC midnight like Inventory dates),
 * on top of the normal nightly price (base / weekend / pricing rule / date override).
 * A deal is "live today" when isActive and startDate ≤ today ≤ endDate — that is what the
 * "Deals of the day" collection lists. Status is derived, never stored, so nothing needs a cron.
 */
const dealSchema = new mongoose.Schema(
  {
    property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true }, // denormalised for vendor scoping
    roomTypes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'RoomType' }], // empty = every room type
    title: { type: String, trim: true, maxlength: 60 },
    discountType: { type: String, enum: ['percent', 'amount'], default: 'percent' },
    value: { type: Number, required: true, min: 1 },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    isActive: { type: Boolean, default: true }, // vendor can pause without deleting
    createdByType: { type: String, enum: ['vendor', 'admin'], default: 'vendor' },
    createdBy: mongoose.Schema.Types.ObjectId,
  },
  { timestamps: true },
);

// "Deals of the day" + pricing lookups: equality isActive, then the date range (ESR)
dealSchema.index({ isActive: 1, endDate: 1, startDate: 1 });
// Pricing for one property over a stay range
dealSchema.index({ property: 1, isActive: 1, endDate: 1 });
// Vendor / admin deals page (newest first, per vendor)
dealSchema.index({ vendor: 1, endDate: -1 });

export default mongoose.model('Deal', dealSchema);

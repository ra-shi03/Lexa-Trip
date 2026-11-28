import mongoose from 'mongoose';

/** A vendor's request for a new catalogue option. Nothing is usable until an admin / sub-admin approves it. */
export const REQUEST_KINDS = ['tag', 'house_rule', 'amenity', 'room_feature'];

const schema = new mongoose.Schema(
  {
    kind: { type: String, enum: REQUEST_KINDS, required: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
    property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property' },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    note: { type: String, trim: true, maxlength: 500 },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    reviewedAt: Date,
  },
  { timestamps: true },
);

schema.index({ status: 1, createdAt: -1 }); // review queue
schema.index({ vendor: 1, createdAt: -1 }); // vendor's own list
schema.index({ status: 1, kind: 1, name: 1 }); // approved options

export default mongoose.model('CatalogRequest', schema);

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { VENDOR_STATUS } from '../constants/enums.js';

const docSchema = new mongoose.Schema(
  {
    type: { type: String, required: true }, // gst_certificate, pan, trade_licence, property_proof, id_proof …
    url: { type: String, required: true },
    status: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending' },
    note: String,
  },
  { timestamps: true },
);

/** Hotel owner / property manager (vendor panel) */
const vendorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    password: { type: String, required: true, select: false, minlength: 6 },
    businessName: { type: String, trim: true },
    businessType: { type: String, enum: ['individual', 'proprietorship', 'partnership', 'company', ''], default: '' },
    gstin: String,
    pan: String,
    address: { line1: String, city: String, state: String, pincode: String },
    documents: [docSchema],
    bank: {
      accountHolder: String,
      accountNumber: String,
      ifsc: String,
      bankName: String,
      upiId: String,
    },
    status: { type: String, enum: VENDOR_STATUS, default: 'pending', index: true },
    statusNote: String,
    /** Admin-managed permissions for this vendor */
    permissions: {
      maxProperties: { type: Number, default: 10 },
      canManageInventory: { type: Boolean, default: true },
      canEditPricing: { type: Boolean, default: true },
      instantBooking: { type: Boolean, default: true }, // false → request-to-book (vendor approval)
    },
    commissionRate: { type: Number, min: 0, max: 100 }, // vendor-specific override, % of booking base
    lastLoginAt: Date,
  },
  { timestamps: true },
);

vendorSchema.pre('save', async function hashPassword() {
  if (this.isModified('password')) this.password = await bcrypt.hash(this.password, 10);
});
vendorSchema.methods.checkPassword = function checkPassword(pw) {
  return bcrypt.compare(pw, this.password);
};

vendorSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model('Vendor', vendorSchema);

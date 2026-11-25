import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
  {
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    gateway: { type: String, required: true }, // mock | razorpay
    gatewayOrderId: { type: String, index: true },
    gatewayPaymentId: String,
    amount: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    method: String, // card | upi | netbanking | wallet
    status: { type: String, enum: ['created', 'success', 'failed', 'pending', 'refunded', 'partially_refunded'], default: 'created' },
    failureReason: String,
    refunds: [{ amount: Number, gatewayRefundId: String, status: String, at: Date }],
    raw: Object,
  },
  { timestamps: true },
);

const payoutSchema = new mongoose.Schema(
  {
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true, index: true },
    periodStart: Date,
    periodEnd: Date,
    bookings: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Booking' }],
    grossAmount: Number,
    commissionAmount: Number,
    netAmount: Number,
    status: { type: String, enum: ['pending', 'processing', 'paid', 'on_hold'], default: 'pending' },
    reference: String, // UTR / bank ref
    paidAt: Date,
    note: String,
  },
  { timestamps: true },
);

paymentSchema.index({ booking: 1, status: 1 });
paymentSchema.index({ user: 1, createdAt: -1 });
paymentSchema.index({ status: 1, createdAt: -1 });
payoutSchema.index({ vendor: 1, status: 1, createdAt: -1 });
payoutSchema.index({ status: 1, createdAt: -1 });

export const Payment = mongoose.model('Payment', paymentSchema);
export const Payout = mongoose.model('Payout', payoutSchema);

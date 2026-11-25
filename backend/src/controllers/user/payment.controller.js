import crypto from 'node:crypto';
import Booking from '../../models/Booking.js';
import { Payment } from '../../models/Finance.js';
import { gateway, gatewayByName } from '../../services/payment/gateway.js';
import { confirmBooking, failBooking } from '../../services/booking.service.js';
import { ok } from '../../utils/response.js';
import { ApiError } from '../../utils/ApiError.js';
import { env } from '../../config/env.js';

/** Step 1 — create a gateway order for a held booking */
export async function createOrder(req, res) {
  const booking = await Booking.findOne({ _id: req.body.bookingId, user: req.user._id });
  if (!booking) throw ApiError.notFound('Booking not found');
  if (booking.status !== 'pending_payment') throw ApiError.conflict(`This booking is ${booking.status.replace('_', ' ')}`);
  if (booking.holdExpiresAt && booking.holdExpiresAt < new Date()) throw ApiError.conflict('Payment window expired — please book again');

  // Re-use an open order (prevents duplicate charges on retries / double taps)
  let payment = await Payment.findOne({ booking: booking._id, status: 'created' });
  if (!payment) {
    const gw = gateway();
    const order = await gw.createOrder({ amount: booking.pricing.totalAmount, currency: booking.pricing.currency, receipt: booking.bookingCode, notes: { bookingId: String(booking._id) } });
    payment = await Payment.create({ booking: booking._id, user: req.user._id, gateway: gw.name, gatewayOrderId: order.orderId, amount: booking.pricing.totalAmount, currency: booking.pricing.currency });
  }
  ok(res, {
    gateway: payment.gateway,
    orderId: payment.gatewayOrderId,
    amount: payment.amount,
    currency: payment.currency,
    keyId: payment.gateway === 'razorpay' ? env.payment.razorpayKeyId : 'mock',
    bookingCode: booking.bookingCode,
    holdExpiresAt: booking.holdExpiresAt,
    prefill: booking.primaryGuest,
  });
}

/** Step 2 — verify the signature returned by the checkout and confirm the booking */
export async function verify(req, res) {
  const { orderId, paymentId, signature, method } = req.body;
  const payment = await Payment.findOne({ gatewayOrderId: orderId, user: req.user._id });
  if (!payment) throw ApiError.notFound('Payment not found');
  const booking = await Booking.findById(payment.booking);

  if (payment.status === 'success') return ok(res, booking, undefined, 'Already confirmed');

  const valid = await gatewayByName(payment.gateway).verifyPayment({ orderId, paymentId, signature });
  if (!valid) {
    payment.status = 'failed';
    payment.failureReason = 'Signature mismatch';
    await payment.save();
    throw ApiError.badRequest('Payment verification failed');
  }
  payment.status = 'success';
  payment.gatewayPaymentId = paymentId;
  payment.method = method;
  await payment.save();
  ok(res, await confirmBooking(booking), undefined, 'Payment successful');
}

/** Sandbox checkout (PAYMENT_PROVIDER=mock): simulates success / failure / pending */
export async function mockPay(req, res) {
  if (env.payment.provider !== 'mock') throw ApiError.forbidden('Sandbox payments are disabled');
  const { orderId, outcome = 'success', method = 'upi' } = req.body;
  const payment = await Payment.findOne({ gatewayOrderId: orderId, user: req.user._id });
  if (!payment) throw ApiError.notFound('Payment not found');
  const booking = await Booking.findById(payment.booking);

  if (outcome === 'failure') {
    payment.status = 'failed';
    payment.failureReason = 'Declined by bank (sandbox)';
    await payment.save();
    await failBooking(booking, 'Payment declined');
    throw ApiError.badRequest('Payment failed — no money was deducted. Please try again.');
  }
  if (outcome === 'pending') {
    payment.status = 'pending';
    await payment.save();
    return ok(res, { status: 'pending', booking }, undefined, 'Payment pending confirmation from bank');
  }
  const paymentId = `mock_pay_${crypto.randomBytes(6).toString('hex')}`;
  const gw = gatewayByName('mock');
  req.body = { orderId, paymentId, signature: gw.sign(orderId, paymentId), method };
  return verify(req, res);
}

/** Gateway → server webhook (handles payments completed after the browser closed) */
export async function webhook(req, res) {
  const signature = req.get('x-razorpay-signature');
  const raw = req.rawBody || JSON.stringify(req.body);
  if (!gatewayByName('razorpay').verifyWebhook(raw, signature)) return res.status(400).json({ success: false });
  const evt = req.body;
  const entity = evt?.payload?.payment?.entity;
  if (entity?.order_id) {
    const payment = await Payment.findOne({ gatewayOrderId: entity.order_id });
    if (payment && payment.status !== 'success') {
      const booking = await Booking.findById(payment.booking);
      if (evt.event === 'payment.captured') {
        payment.status = 'success';
        payment.gatewayPaymentId = entity.id;
        payment.method = entity.method;
        await payment.save();
        await confirmBooking(booking);
      } else if (evt.event === 'payment.failed') {
        payment.status = 'failed';
        payment.failureReason = entity.error_description;
        await payment.save();
        await failBooking(booking, entity.error_description);
      }
    }
  }
  res.json({ success: true });
}

export async function status(req, res) {
  const booking = await Booking.findOne({ _id: req.params.bookingId, user: req.user._id }).select('status paymentStatus bookingCode holdExpiresAt').lean();
  if (!booking) throw ApiError.notFound();
  ok(res, booking);
}

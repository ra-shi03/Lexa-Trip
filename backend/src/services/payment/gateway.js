import crypto from 'node:crypto';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/ApiError.js';

/**
 * Payment gateway adapters. Contract:
 *   createOrder({ amount, currency, receipt, notes }) → { orderId, amount, currency, keyId }
 *   verifyPayment({ orderId, paymentId, signature }) → boolean
 *   refund({ paymentId, amount })                    → { refundId, status }
 *   verifyWebhook(rawBody, signature)                → boolean
 */

/** Sandbox gateway: lets the full booking flow be tested without real money. */
const mock = {
  name: 'mock',
  async createOrder({ amount, currency = 'INR' }) {
    return { orderId: `mock_order_${crypto.randomBytes(6).toString('hex')}`, amount, currency, keyId: 'mock' };
  },
  sign(orderId, paymentId) {
    return crypto.createHmac('sha256', env.jwtSecret).update(`${orderId}|${paymentId}`).digest('hex');
  },
  async verifyPayment({ orderId, paymentId, signature }) {
    return signature === this.sign(orderId, paymentId);
  },
  async refund({ amount }) {
    return { refundId: `mock_rfnd_${crypto.randomBytes(5).toString('hex')}`, status: 'processed', amount };
  },
  verifyWebhook() { return true; },
};

/** Razorpay via REST (no SDK dependency). Amounts are converted to paise. */
const razorpay = {
  name: 'razorpay',
  auth() {
    if (!env.payment.razorpayKeyId || !env.payment.razorpayKeySecret) throw ApiError.badRequest('Razorpay keys are not configured');
    return `Basic ${Buffer.from(`${env.payment.razorpayKeyId}:${env.payment.razorpayKeySecret}`).toString('base64')}`;
  },
  async call(path, body) {
    const res = await fetch(`https://api.razorpay.com/v1${path}`, {
      method: 'POST',
      headers: { Authorization: this.auth(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) throw new ApiError(502, json?.error?.description || 'Payment gateway error');
    return json;
  },
  async createOrder({ amount, currency = 'INR', receipt, notes }) {
    const o = await this.call('/orders', { amount: Math.round(amount * 100), currency, receipt, notes });
    return { orderId: o.id, amount, currency, keyId: env.payment.razorpayKeyId };
  },
  async verifyPayment({ orderId, paymentId, signature }) {
    const expected = crypto.createHmac('sha256', env.payment.razorpayKeySecret).update(`${orderId}|${paymentId}`).digest('hex');
    return expected.length === String(signature).length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(String(signature)));
  },
  async refund({ paymentId, amount }) {
    const r = await this.call(`/payments/${paymentId}/refund`, { amount: Math.round(amount * 100) });
    return { refundId: r.id, status: r.status, amount };
  },
  verifyWebhook(rawBody, signature) {
    if (!env.payment.razorpayWebhookSecret) return false;
    const expected = crypto.createHmac('sha256', env.payment.razorpayWebhookSecret).update(rawBody).digest('hex');
    return expected === signature;
  },
};

const GATEWAYS = { mock, razorpay };
export const gateway = () => GATEWAYS[env.payment.provider] || mock;
export const gatewayByName = (n) => GATEWAYS[n] || mock;

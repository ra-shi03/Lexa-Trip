import Booking from '../../models/Booking.js';
import Vendor from '../../models/Vendor.js';
import { Payment, Payout } from '../../models/Finance.js';
import { gatewayByName } from '../../services/payment/gateway.js';
import { notify } from '../../services/notification/notification.service.js';
import { audit } from '../../services/audit.service.js';
import { ok, created } from '../../utils/response.js';
import { ApiError } from '../../utils/ApiError.js';
import { buildListQuery, pageMeta } from '../../utils/queryBuilder.js';
import { toDay, addDays, toCsv } from '../../utils/helpers.js';

/** All handlers here are guarded by revenue permissions → master admin only. */

export async function transactions(req, res) {
  const { filter, skip, limit, page, sort } = buildListQuery(req.query, { searchFields: ['gatewayOrderId', 'gatewayPaymentId'], filterFields: ['status', 'gateway'] });
  const [items, total] = await Promise.all([
    Payment.find(filter).sort(sort).skip(skip).limit(limit).populate('booking', 'bookingCode type').populate('user', 'name phone').lean(),
    Payment.countDocuments(filter),
  ]);
  ok(res, items, pageMeta(total, page, limit));
}

export async function refunds(req, res) {
  const filter = { 'cancellation.refundStatus': req.query.status || { $in: ['requested', 'approved', 'processed', 'rejected'] } };
  ok(res, await Booking.find(filter).sort({ 'cancellation.requestedAt': -1 }).limit(200).select('bookingCode type user pricing.totalAmount cancellation paymentStatus snapshot').populate('user', 'name phone').lean());
}

/** Retry / manually process a refund that failed at the gateway */
export async function processRefund(req, res) {
  const b = await Booking.findById(req.params.bookingId);
  if (!b?.cancellation?.refundAmount) throw ApiError.badRequest('No refund due on this booking');
  if (b.cancellation.refundStatus === 'processed') throw ApiError.conflict('Refund already processed');
  if (req.body.action === 'reject') {
    b.cancellation.refundStatus = 'rejected';
    b.cancellation.note = req.body.note;
    await b.save();
    return ok(res, b, undefined, 'Refund rejected');
  }
  const payment = await Payment.findOne({ booking: b._id, status: { $in: ['success', 'partially_refunded'] } });
  if (!payment) throw ApiError.badRequest('No successful payment found for this booking');
  const r = await gatewayByName(payment.gateway).refund({ paymentId: payment.gatewayPaymentId, amount: b.cancellation.refundAmount });
  payment.refunds.push({ amount: b.cancellation.refundAmount, gatewayRefundId: r.refundId, status: r.status, at: new Date() });
  payment.status = b.cancellation.refundAmount >= payment.amount ? 'refunded' : 'partially_refunded';
  await payment.save();
  b.cancellation.refundStatus = 'processed';
  b.cancellation.processedAt = new Date();
  b.paymentStatus = payment.status;
  await b.save();
  audit(req, 'refund.process', 'Booking', b._id, { amount: b.cancellation.refundAmount });
  ok(res, b, undefined, 'Refund processed');
}

export async function payouts(req, res) {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.vendor) filter.vendor = req.query.vendor;
  ok(res, await Payout.find(filter).sort({ createdAt: -1 }).limit(200).populate('vendor', 'businessName email bank').lean());
}

/** Groups completed, unpaid bookings per vendor into payout records for a period */
export async function generatePayouts(req, res) {
  const to = req.body.to ? addDays(req.body.to, 1) : toDay(new Date());
  const from = req.body.from ? toDay(req.body.from) : addDays(to, -30);
  const due = await Booking.aggregate([
    { $match: { type: 'hotel', payout: null, status: { $in: ['checked_out', 'completed', 'cancelled'] }, vendorPayoutAmount: { $gt: 0 }, checkOut: { $gte: from, $lt: to } } },
    { $group: { _id: '$vendor', bookings: { $push: '$_id' }, gross: { $sum: '$pricing.totalAmount' }, commission: { $sum: '$commission.amount' }, net: { $sum: '$vendorPayoutAmount' } } },
  ]);
  const createdList = [];
  for (const d of due) {
    const p = await Payout.create({ vendor: d._id, periodStart: from, periodEnd: addDays(to, -1), bookings: d.bookings, grossAmount: d.gross, commissionAmount: d.commission, netAmount: d.net });
    await Booking.updateMany({ _id: { $in: d.bookings } }, { payout: p._id });
    createdList.push(p);
  }
  audit(req, 'payout.generate', 'Payout', null, { count: createdList.length, from, to });
  created(res, createdList, `${createdList.length} payout(s) generated`);
}

export async function updatePayout(req, res) {
  const p = await Payout.findById(req.params.id);
  if (!p) throw ApiError.notFound();
  const { status, reference, note } = req.body;
  p.set({ status, reference, note });
  if (status === 'paid') p.paidAt = new Date();
  await p.save();
  if (status === 'paid') await notify({ recipientType: 'vendor', recipient: p.vendor, title: 'Payout sent', body: `₹${p.netAmount} · Ref ${reference || '-'}`, type: 'payout_paid' });
  audit(req, `payout.${status}`, 'Payout', p._id, { reference });
  ok(res, p, undefined, 'Payout updated');
}

export async function revenueReport(req, res) {
  const from = req.query.from ? toDay(req.query.from) : addDays(new Date(), -30);
  const to = req.query.to ? addDays(req.query.to, 1) : addDays(new Date(), 1);
  const match = { createdAt: { $gte: from, $lt: to }, paymentStatus: { $in: ['paid', 'partially_refunded', 'refunded'] } };
  const [byService, byVendor, daily] = await Promise.all([
    Booking.aggregate([{ $match: match }, { $group: { _id: '$type', bookings: { $sum: 1 }, gross: { $sum: '$pricing.totalAmount' }, taxes: { $sum: '$pricing.taxes' }, discount: { $sum: '$pricing.discount' }, commission: { $sum: '$commission.amount' }, refunds: { $sum: { $ifNull: ['$cancellation.refundAmount', 0] } } } }]),
    Booking.aggregate([{ $match: { ...match, type: 'hotel' } }, { $group: { _id: '$vendor', bookings: { $sum: 1 }, gross: { $sum: '$pricing.totalAmount' }, commission: { $sum: '$commission.amount' }, payout: { $sum: '$vendorPayoutAmount' } } }, { $sort: { gross: -1 } }, { $limit: 50 }]),
    Booking.aggregate([{ $match: match }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, gross: { $sum: '$pricing.totalAmount' }, commission: { $sum: '$commission.amount' } } }, { $sort: { _id: 1 } }]),
  ]);
  const vendors = await Vendor.find({ _id: { $in: byVendor.map((v) => v._id) } }).select('businessName').lean();
  const vmap = Object.fromEntries(vendors.map((v) => [String(v._id), v.businessName]));
  const vendorRows = byVendor.map((v) => ({ ...v, vendorName: vmap[String(v._id)] }));

  if (req.query.format === 'csv') {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="lexatrip-revenue.csv"');
    return res.send(toCsv(byService, [
      { label: 'Service', value: '_id' }, { label: 'Bookings', value: 'bookings' }, { label: 'Gross', value: 'gross' }, { label: 'Taxes', value: 'taxes' },
      { label: 'Discounts', value: 'discount' }, { label: 'Commission', value: 'commission' }, { label: 'Refunds', value: 'refunds' },
    ]));
  }
  ok(res, { from, to, byService, byVendor: vendorRows, daily });
}

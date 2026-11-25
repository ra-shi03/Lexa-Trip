import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { CreditCard, Smartphone, Landmark, Wallet, Lock, Clock, ShieldCheck } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import { useSettings } from '../../context/SettingsContext';
import { Button, Alert } from '../ui';
import { money, cx } from '../../lib/format';

const METHODS = { upi: ['UPI', Smartphone, 'GPay, PhonePe, Paytm & more'], card: ['Credit / Debit card', CreditCard, 'Visa, Mastercard, RuPay'], netbanking: ['Net banking', Landmark, 'All major banks'], wallet: ['Wallets', Wallet, 'Paytm, Amazon Pay'] };

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Could not load payment gateway'));
    document.body.appendChild(s);
  });
}

/**
 * Generic payment step for hotel / bus / flight bookings.
 * - mock gateway: sandbox buttons (success / failure / pending) for end-to-end testing
 * - razorpay: opens Razorpay Checkout, then verifies the signature server-side
 */
export function PaymentStep({ booking, onPaid }) {
  const { payment } = useSettings();
  const methods = (payment?.methods || Object.keys(METHODS)).filter((m) => METHODS[m]);
  const [method, setMethod] = useState(methods[0] || 'upi');
  const [order, setOrder] = useState(null);
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState(null);
  const toast = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    api.post('/me/payments/order', { bookingId: booking._id }).then(({ data }) => setOrder(data)).catch((e) => toast.error(e));
  }, [booking._id, toast]);

  useEffect(() => {
    if (!order?.holdExpiresAt) return undefined;
    const tick = () => setLeft(Math.max(0, Math.floor((new Date(order.holdExpiresAt) - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [order]);

  const done = (b) => { onPaid?.(b); navigate(`/booking/${booking._id}?new=1`, { replace: true }); };

  const pay = async (outcome = 'success') => {
    setBusy(true);
    try {
      if (order.gateway === 'mock') {
        const { data, message } = await api.post('/me/payments/mock', { orderId: order.orderId, outcome, method });
        if (data?.status === 'pending') toast.info(message);
        else done(data);
      } else {
        await loadScript('https://checkout.razorpay.com/v1/checkout.js');
        const rzp = new window.Razorpay({
          key: order.keyId,
          order_id: order.orderId,
          amount: Math.round(order.amount * 100),
          currency: order.currency,
          name: 'LexaTrip',
          description: `Booking ${order.bookingCode}`,
          prefill: { name: order.prefill?.name, email: order.prefill?.email, contact: order.prefill?.phone },
          method: { [method]: true },
          theme: { color: getComputedStyle(document.documentElement).getPropertyValue('--lt-primary').trim() || '#F26B1D' },
          handler: async (resp) => {
            try {
              const { data } = await api.post('/me/payments/verify', { orderId: resp.razorpay_order_id, paymentId: resp.razorpay_payment_id, signature: resp.razorpay_signature, method });
              done(data);
            } catch (e) { toast.error(e); }
          },
          modal: { ondismiss: () => setBusy(false) },
        });
        rzp.open();
        return;
      }
    } catch (e) {
      toast.error(e);
    }
    setBusy(false);
  };

  const expired = left === 0;
  return (
    <div className="space-y-5">
      {left !== null && (
        <div className={cx('flex items-center gap-2 rounded-brand px-4 py-3 text-sm font-semibold', expired ? 'bg-danger/10 text-danger' : 'bg-warning/10 text-warning')}>
          <Clock size={17} />
          {expired ? 'Your hold has expired — please start a new booking.' : `We’re holding this for you · ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')} left`}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {methods.map((m) => {
          const [label, Icon, sub] = METHODS[m];
          return (
            <button key={m} type="button" onClick={() => setMethod(m)} className={cx('flex items-center gap-3 rounded-brand border-2 p-4 text-left transition', method === m ? 'border-primary bg-primary-soft/40' : 'border-line hover:border-ink/30')}>
              <span className={cx('grid h-10 w-10 place-items-center rounded-full', method === m ? 'bg-primary text-white' : 'bg-surface text-ink')}><Icon size={19} /></span>
              <span><span className="block text-sm font-bold">{label}</span><span className="block text-xs text-muted">{sub}</span></span>
            </button>
          );
        })}
      </div>
      {order?.gateway === 'mock' && (
        <Alert tone="info" title="Sandbox payments">No real money is charged. Use the buttons below to simulate gateway outcomes. Switch PAYMENT_PROVIDER=razorpay in the backend to go live.</Alert>
      )}
      <Button size="lg" block icon={Lock} loading={busy || !order} disabled={expired} onClick={() => pay('success')}>Pay {money(booking.pricing.totalAmount, true)}</Button>
      {order?.gateway === 'mock' && (
        <div className="flex flex-wrap justify-center gap-2">
          <Button size="xs" variant="ghost" disabled={busy || expired} onClick={() => pay('failure')}>Simulate failure</Button>
          <Button size="xs" variant="ghost" disabled={busy || expired} onClick={() => pay('pending')}>Simulate pending</Button>
        </div>
      )}
      <p className="flex items-center justify-center gap-1.5 text-xs text-muted"><ShieldCheck size={14} />Payments are encrypted and processed by a PCI-DSS compliant gateway</p>
    </div>
  );
}

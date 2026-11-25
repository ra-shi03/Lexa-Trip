import nodemailer from 'nodemailer';
import { env } from '../../config/env.js';
import { Notification } from '../../models/Misc.js';

let transporter = null;
function mailer() {
  if (!env.smtp.host) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.port === 465,
      auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
    });
  }
  return transporter;
}

export async function sendEmail({ to, subject, html }) {
  if (!to) return;
  const t = mailer();
  if (!t) {
    console.log(`[email:console] → ${to} | ${subject}`);
    return;
  }
  try {
    await t.sendMail({ from: env.smtp.from, to, subject, html });
  } catch (e) {
    console.error('[email] failed', e.message);
  }
}

/** In-app notification (+ optional email). Push (FCM) plugs in here later for the Flutter app. */
export async function notify({ recipientType, recipient, title, body, type, data, email }) {
  await Notification.create({ recipientType, recipient, title, body, type, data }).catch(() => {});
  if (email) await sendEmail({ to: email, subject: title, html: `<p>${body}</p>` });
}

export function bookingEmailHtml(b) {
  const amount = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(b.pricing.totalAmount);
  const lines =
    b.type === 'hotel'
      ? `<p><b>${b.snapshot?.propertyName}</b> — ${b.snapshot?.roomName}<br/>Check-in ${new Date(b.checkIn).toDateString()} · Check-out ${new Date(b.checkOut).toDateString()}<br/>${b.rooms} room(s), ${b.guests?.adults} adult(s)</p>`
      : `<p>${b.trip?.from} → ${b.trip?.to}<br/>${b.trip?.operator || b.trip?.airline || ''} · ${new Date(b.trip?.departure).toLocaleString('en-IN')}<br/>PNR: ${b.pnr || '-'}</p>`;
  return `<div style="font-family:Arial,sans-serif;color:#14213D">
    <h2 style="color:#F26B1D">Booking confirmed</h2>
    <p>Booking ID: <b>${b.bookingCode}</b></p>${lines}<p>Total paid: <b>${amount}</b></p>
    <p>Thank you for choosing LexaTrip — Book. Explore. Repeat.</p></div>`;
}

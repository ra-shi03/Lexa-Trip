import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import Otp from '../models/Otp.js';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

const OTP_TTL_MIN = 5;
const MAX_ATTEMPTS = 5;

/** SMS provider adapter — MSG91 / Twilio plug in here once credentials are provided. */
async function deliver(phone, code) {
  switch (env.otpProvider) {
    case 'msg91':
    case 'twilio':
      // TODO(integration): call the provider's API with env credentials.
      console.log(`[otp:${env.otpProvider}] provider not wired yet — ${phone}: ${code}`);
      break;
    default:
      console.log(`[otp:console] ${phone} → ${code}`);
  }
}

export async function sendOtp(phone) {
  const recent = await Otp.findOne({ phone, createdAt: { $gt: new Date(Date.now() - 30_000) } });
  if (recent) throw new ApiError(429, 'Please wait 30 seconds before requesting another OTP');

  const useDev = env.otpProvider === 'console';
  const code = useDev ? env.devOtp : String(crypto.randomInt(100000, 999999));
  await Otp.deleteMany({ phone });
  await Otp.create({ phone, codeHash: await bcrypt.hash(code, 8), expiresAt: new Date(Date.now() + OTP_TTL_MIN * 60_000) });
  await deliver(phone, code);
  return { expiresInSec: OTP_TTL_MIN * 60, devOtp: useDev && !env.isProd ? code : undefined };
}

export async function verifyOtp(phone, code) {
  const otp = await Otp.findOne({ phone }).sort({ createdAt: -1 });
  if (!otp || otp.expiresAt < new Date()) throw ApiError.badRequest('OTP expired. Please request a new one.');
  if (otp.attempts >= MAX_ATTEMPTS) throw new ApiError(429, 'Too many attempts. Please request a new OTP.');
  const okCode = await bcrypt.compare(String(code), otp.codeHash);
  if (!okCode) {
    otp.attempts += 1;
    await otp.save();
    throw ApiError.badRequest('Incorrect OTP');
  }
  await Otp.deleteMany({ phone });
  return true;
}

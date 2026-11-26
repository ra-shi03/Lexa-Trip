import mongoose from 'mongoose';

/**
 * One row per issued refresh token. Only the SHA-256 hash is stored, never the token itself.
 * Tokens are single-use: refreshing revokes the old row (replacedBy → new hash) and inserts a new one in the
 * same `family` (one family = one sign-in on one device). Presenting an already-rotated token again outside the
 * short race window means it was stolen → the whole family is revoked.
 */
const refreshTokenSchema = new mongoose.Schema(
  {
    tokenHash: { type: String, required: true, unique: true },
    accountType: { type: String, enum: ['user', 'vendor', 'admin'], required: true },
    account: { type: mongoose.Schema.Types.ObjectId, required: true },
    family: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    revokedReason: { type: String, enum: ['rotated', 'logout', 'logout_all', 'reuse', 'password_change', null], default: null },
    replacedBy: { type: String, default: null },
    client: { type: String, enum: ['web', 'app'], default: 'web' },
    userAgent: { type: String, maxlength: 300 },
    ip: String,
  },
  { timestamps: true },
);

refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // Mongo deletes expired rows
refreshTokenSchema.index({ accountType: 1, account: 1, revokedAt: 1 }); // revoke all sessions of an account
refreshTokenSchema.index({ family: 1, revokedAt: 1 }); // revoke one device's chain

export default mongoose.model('RefreshToken', refreshTokenSchema);

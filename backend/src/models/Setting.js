import mongoose from 'mongoose';

/**
 * Single-document platform configuration (key = "global").
 * Stored as flexible sub-objects so new theme tokens / feature flags can be
 * added without migrations. Defaults live in constants/defaultSettings.js and
 * are deep-merged at read time (services/settings.service.js).
 *
 * Secrets (API keys) are NOT stored here — they stay in environment variables.
 */
const settingSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'global', unique: true },
    brand: { type: Object, default: {} },
    theme: { type: Object, default: {} },
    features: { type: Object, default: {} },
    homeSections: { type: Array, default: undefined },
    home: { type: Object, default: {} },
    app: { type: Object, default: {} },
    auth: { type: Object, default: {} },
    booking: { type: Object, default: {} },
    tax: { type: Object, default: {} },
    commission: { type: Object, default: {} },
    social: { type: Object, default: {} },
    seo: { type: Object, default: {} },
    integrations: { type: Object, default: {} },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  },
  { timestamps: true, minimize: false },
);

export default mongoose.model('Setting', settingSchema);

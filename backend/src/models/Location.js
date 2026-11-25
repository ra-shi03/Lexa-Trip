import mongoose from 'mongoose';
import { seoMetaSchema, contentSchema, workflowFields } from './SeoMeta.js';

/**
 * Destination hierarchy shared by bookable properties AND the SEO CMS:
 *   India → State → City
 * (Country is implicit "India" for now; `country` kept for future expansion.)
 */
const stateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    code: { type: String, uppercase: true, trim: true }, // RJ, GA …
    country: { type: String, default: 'India' },
    image: String,
    description: String,
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    // SEO landing at /blog/<state>/
    content: contentSchema,
    seo: { type: seoMetaSchema, default: () => ({}) },
    ...workflowFields,
  },
  { timestamps: true },
);

const citySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, lowercase: true },
    state: { type: mongoose.Schema.Types.ObjectId, ref: 'State', required: true },
    image: String,
    description: String,
    geo: { lat: Number, lng: Number },
    isPopular: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    aliases: [String], // e.g. "Lake City" → Udaipur (used by search + AI parser)
    // SEO landing at /hotels/<state>/<city>/ and /blog/<state>/<city>/
    content: contentSchema,
    seo: { type: seoMetaSchema, default: () => ({}) },
    ...workflowFields,
  },
  { timestamps: true },
);
citySchema.index({ state: 1, slug: 1 }, { unique: true });
citySchema.index({ name: 'text', aliases: 'text' });

stateSchema.index({ isActive: 1, sortOrder: 1, name: 1 });
citySchema.index({ isActive: 1, isPopular: 1, sortOrder: 1 });
citySchema.index({ aliases: 1 });

export const State = mongoose.model('State', stateSchema);
export const City = mongoose.model('City', citySchema);

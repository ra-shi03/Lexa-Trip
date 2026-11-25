import mongoose from 'mongoose';

/**
 * Re-usable SEO sub-document embedded in every public SEO entity
 * (State, City, HotelCategory, SeoHotel, Itinerary, SeoArticle, Page).
 */
export const seoMetaSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true, maxlength: 120 },
    metaDescription: { type: String, trim: true, maxlength: 320 },
    primaryKeyword: { type: String, trim: true },
    secondaryKeywords: [{ type: String, trim: true }],
    longTailKeywords: [{ type: String, trim: true }],
    canonicalUrl: { type: String, trim: true }, // empty → self-canonical
    robots: {
      index: { type: Boolean, default: true },
      follow: { type: Boolean, default: true },
    },
    ogTitle: String,
    ogDescription: String,
    ogImage: String,
    /** auto = generate JSON-LD from content; custom JSON (string) is appended/overrides */
    autoSchema: { type: Boolean, default: true },
    customSchema: { type: String, default: '' },
    sitemap: {
      include: { type: Boolean, default: true },
      priority: { type: Number, min: 0, max: 1, default: 0.7 },
      changefreq: {
        type: String,
        enum: ['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never'],
        default: 'weekly',
      },
    },
  },
  { _id: false },
);

/** Structured content with explicit heading hierarchy (H1 + H2/H3 sections) */
export const contentSchema = new mongoose.Schema(
  {
    h1: { type: String, trim: true },
    intro: { type: String, default: '' }, // sanitised HTML
    sections: [
      {
        heading: { type: String, trim: true },
        level: { type: String, enum: ['h2', 'h3'], default: 'h2' },
        body: { type: String, default: '' }, // sanitised HTML
      },
    ],
  },
  { _id: false },
);

export const faqSchema = new mongoose.Schema({ question: String, answer: String }, { _id: true });

export const imageSchema = new mongoose.Schema(
  { url: { type: String, required: true }, alt: { type: String, default: '' }, caption: String },
  { _id: true },
);

export const internalLinkSchema = new mongoose.Schema({ label: String, url: String }, { _id: false });

/** Shared editorial workflow fields */
export const workflowFields = {
  status: { type: String, enum: ['draft', 'review', 'published', 'archived'], default: 'draft', index: true },
  publishedAt: Date,
  scheduledAt: Date, // auto-publish time (picked up by the scheduler)
  reviewNotes: String,
  version: { type: Number, default: 1 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
};

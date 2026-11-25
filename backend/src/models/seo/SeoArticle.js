import mongoose from 'mongoose';
import { seoMetaSchema, contentSchema, faqSchema, imageSchema, internalLinkSchema, workflowFields } from '../SeoMeta.js';

/**
 * SEO article / guide attached to a State or City (and optionally a hotel).
 *   /blog/<state>/<slug>/            (state-level)
 *   /blog/<state>/<city>/<slug>/     (city-level)
 */
const seoArticleSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, lowercase: true },
    state: { type: mongoose.Schema.Types.ObjectId, ref: 'State', required: true },
    city: { type: mongoose.Schema.Types.ObjectId, ref: 'City' },
    hotels: [{ type: mongoose.Schema.Types.ObjectId, ref: 'SeoHotel' }],
    excerpt: String,
    coverImage: imageSchema,
    authorName: { type: String, default: 'LexaTrip Editorial' },
    tags: [String],
    readingMinutes: Number,
    content: { type: contentSchema, default: () => ({}) },
    faqs: [faqSchema],
    seo: { type: seoMetaSchema, default: () => ({}) },
    internalLinks: [internalLinkSchema],
    ...workflowFields,
  },
  { timestamps: true },
);

seoArticleSchema.index({ state: 1, city: 1, slug: 1 }, { unique: true });

seoArticleSchema.index({ city: 1, status: 1, publishedAt: -1 });
seoArticleSchema.index({ state: 1, status: 1, publishedAt: -1 });
seoArticleSchema.index({ hotels: 1, status: 1 });
seoArticleSchema.index({ scheduledAt: 1 }, { partialFilterExpression: { scheduledAt: { $type: 'date' } } });

export default mongoose.model('SeoArticle', seoArticleSchema);

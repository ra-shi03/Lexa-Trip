import mongoose from 'mongoose';
import { seoMetaSchema, contentSchema, faqSchema, workflowFields } from '../SeoMeta.js';

/**
 * City-level hotel listing category for the SEO CMS
 *   e.g. Rajasthan → Udaipur → "5-Star Hotels"  →  /hotels/rajasthan/udaipur/5-star-hotels/
 * Created per city (from the templates in settings.seo.hotelCategoryTemplates or custom).
 */
const hotelCategorySchema = new mongoose.Schema(
  {
    city: { type: mongoose.Schema.Types.ObjectId, ref: 'City', required: true },
    state: { type: mongoose.Schema.Types.ObjectId, ref: 'State', required: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, lowercase: true },
    starRating: Number, // optional matching rule
    image: String,
    sortOrder: { type: Number, default: 0 },
    content: { type: contentSchema, default: () => ({}) },
    faqs: [faqSchema],
    seo: { type: seoMetaSchema, default: () => ({}) },
    ...workflowFields,
  },
  { timestamps: true },
);

hotelCategorySchema.index({ city: 1, slug: 1 }, { unique: true });

hotelCategorySchema.index({ city: 1, status: 1, sortOrder: 1 });
hotelCategorySchema.index({ scheduledAt: 1 }, { partialFilterExpression: { scheduledAt: { $type: 'date' } } });

export default mongoose.model('HotelCategory', hotelCategorySchema);

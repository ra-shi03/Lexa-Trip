import mongoose from 'mongoose';
import { seoMetaSchema, contentSchema, faqSchema, imageSchema, internalLinkSchema, workflowFields } from '../SeoMeta.js';

const roomSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: String,
    sizeSqft: Number,
    bedType: String,
    occupancy: String, // "2 adults + 1 child"
    view: String,
    priceFrom: Number,
    amenities: [String],
    images: [imageSchema],
  },
  { _id: true },
);

/**
 * Individual hotel profile in the SEO CMS — its own database record and public page:
 *   /hotels/<state>/<city>/<hotel-slug>/
 * Optionally linked to a bookable `Property` so the page can show live prices + "Book now".
 */
const seoHotelSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, lowercase: true },
    state: { type: mongoose.Schema.Types.ObjectId, ref: 'State', required: true },
    city: { type: mongoose.Schema.Types.ObjectId, ref: 'City', required: true },
    categories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'HotelCategory' }],
    property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property' }, // link to bookable listing
    propertyType: { type: String, default: 'Hotel' }, // Hotel | Resort | Villa … (schema.org @type hint)
    starRating: { type: Number, min: 0, max: 5 },

    // Details
    shortDescription: { type: String, maxlength: 400 },
    description: { type: String, default: '' }, // sanitised HTML
    address: {
      line1: String,
      area: String,
      landmark: String,
      pincode: String,
      full: String,
    },
    geo: { lat: Number, lng: Number },
    contact: { phone: String, email: String, website: String },
    checkInTime: String,
    checkOutTime: String,
    priceFrom: Number,
    priceRange: String, // "₹₹₹" for schema.org
    rooms: [roomSchema],
    facilities: [String],
    amenities: [String],
    policies: [{ title: String, text: String }],
    heroImage: imageSchema,
    gallery: [imageSchema],

    // Content + SEO
    content: { type: contentSchema, default: () => ({}) },
    faqs: [faqSchema],
    seo: { type: seoMetaSchema, default: () => ({}) },
    internalLinks: [internalLinkSchema],
    relatedHotels: [{ type: mongoose.Schema.Types.ObjectId, ref: 'SeoHotel' }],

    ...workflowFields,
  },
  { timestamps: true },
);

seoHotelSchema.index({ city: 1, slug: 1 }, { unique: true });
seoHotelSchema.index({ name: 'text', 'seo.primaryKeyword': 'text' });

seoHotelSchema.index({ state: 1, status: 1 });
seoHotelSchema.index({ city: 1, status: 1, starRating: -1, name: 1 }); // public city hub listing
seoHotelSchema.index({ categories: 1, status: 1 }); // category pages
seoHotelSchema.index({ status: 1, updatedAt: -1 }); // admin lists / sitemap
seoHotelSchema.index({ scheduledAt: 1 }, { partialFilterExpression: { scheduledAt: { $type: 'date' } } }); // scheduler
seoHotelSchema.index({ property: 1 }, { sparse: true });

export default mongoose.model('SeoHotel', seoHotelSchema);

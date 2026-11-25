import mongoose from 'mongoose';
import { seoMetaSchema, contentSchema, faqSchema, imageSchema, internalLinkSchema, workflowFields } from '../SeoMeta.js';

const daySchema = new mongoose.Schema(
  {
    day: { type: Number, required: true },
    title: String,
    description: String, // sanitised HTML
    activities: [{ time: String, title: String, description: String }],
    meals: [String], // Breakfast, Lunch, Dinner
    overnight: String,
    image: imageSchema,
  },
  { _id: true },
);

/**
 * Hotel itinerary — each SeoHotel can have many.
 *   /hotels/<state>/<city>/<hotel-slug>/itinerary/<itinerary-slug>/
 */
const itinerarySchema = new mongoose.Schema(
  {
    hotel: { type: mongoose.Schema.Types.ObjectId, ref: 'SeoHotel', required: true, index: true },
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, lowercase: true },
    durationDays: { type: Number, default: 1 },
    durationNights: { type: Number, default: 0 },
    travellerType: { type: String, default: '' }, // couples, family, friends, business, solo
    summary: String,
    heroImage: imageSchema,
    priceFrom: Number,

    days: [daySchema],
    experiences: [{ title: String, description: String, image: imageSchema }],
    dining: [{ name: String, cuisine: String, timings: String, description: String }],
    facilities: [String],
    nearbyAttractions: [{ name: String, distanceKm: Number, travelTime: String, description: String, image: imageSchema }],
    guestInfo: {
      bestTimeToVisit: String,
      howToReach: String,
      checkInOut: String,
      whatToPack: String,
      tips: [String],
      importantNotes: String,
    },

    content: { type: contentSchema, default: () => ({}) },
    faqs: [faqSchema],
    seo: { type: seoMetaSchema, default: () => ({}) },
    internalLinks: [internalLinkSchema],
    ...workflowFields,
  },
  { timestamps: true },
);

itinerarySchema.index({ hotel: 1, slug: 1 }, { unique: true });

itinerarySchema.index({ hotel: 1, status: 1 });
itinerarySchema.index({ status: 1, updatedAt: -1 });
itinerarySchema.index({ scheduledAt: 1 }, { partialFilterExpression: { scheduledAt: { $type: 'date' } } });

export default mongoose.model('Itinerary', itinerarySchema);

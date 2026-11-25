import mongoose from 'mongoose';

/** Full snapshot taken on every save of an SEO entity → history + one-click restore */
const revisionSchema = new mongoose.Schema(
  {
    entityType: { type: String, required: true, enum: ['SeoHotel', 'Itinerary', 'SeoArticle', 'HotelCategory', 'City', 'State'] },
    entityId: { type: mongoose.Schema.Types.ObjectId, required: true },
    version: Number,
    status: String,
    snapshot: { type: Object, required: true },
    note: String,
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    authorName: String,
  },
  { timestamps: true },
);
revisionSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });

/** 301 redirects — created automatically when a published URL changes (slug/city edits) */
const redirectSchema = new mongoose.Schema(
  {
    from: { type: String, required: true, unique: true },
    to: { type: String, required: true },
    code: { type: Number, enum: [301, 302], default: 301 },
    hits: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

/** Sitemap / Search Console submission log */
const sitemapLogSchema = new mongoose.Schema(
  {
    action: String, // generated | submitted | error
    urlCount: Number,
    message: String,
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  },
  { timestamps: true },
);

redirectSchema.index({ isActive: 1, from: 1 });
sitemapLogSchema.index({ createdAt: -1 });

export const Revision = mongoose.model('Revision', revisionSchema);
export const Redirect = mongoose.model('Redirect', redirectSchema);
export const SitemapLog = mongoose.model('SitemapLog', sitemapLogSchema);

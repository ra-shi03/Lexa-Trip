import mongoose from 'mongoose';

/** Accommodation categories — customisable by master admin (Hotels, Villas, Resorts, Hostels …) */
const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    icon: { type: String, default: 'building' }, // lucide icon name, rendered by the apps
    image: String,
    description: String,
    isActive: { type: Boolean, default: true },
    showOnHome: { type: Boolean, default: true },
    /** type  = a property type vendors pick (Hotel, Villa…)
     *  deals = a collection filled automatically with every stay running a vendor deal today ("Deals of the day") */
    kind: { type: String, enum: ['type', 'deals'], default: 'type' },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

const amenitySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    icon: { type: String, default: 'check' },
    group: { type: String, enum: ['general', 'room', 'food', 'wellness', 'business', 'family', 'accessibility', 'safety'], default: 'general' },
    isFilterable: { type: Boolean, default: true },
    scope: { type: String, enum: ['all', 'property', 'room'], default: 'all' }, // where the editor offers it
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const couponSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    title: String,
    description: String,
    discountType: { type: String, enum: ['percent', 'flat'], default: 'percent' },
    value: { type: Number, required: true, min: 0 },
    maxDiscount: Number,
    minAmount: { type: Number, default: 0 },
    services: { type: [String], enum: ['hotel', 'bus', 'flight'], default: ['hotel', 'bus', 'flight'] },
    validFrom: Date,
    validTo: Date,
    usageLimit: Number,
    perUserLimit: { type: Number, default: 1 },
    usedCount: { type: Number, default: 0 },
    isPublic: { type: Boolean, default: true }, // shown in offers list
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const bannerSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    subtitle: String,
    image: String,
    link: String,
    ctaLabel: String,
    placement: { type: String, enum: ['home_hero', 'home_offers', 'search_top', 'app_home'], default: 'home_offers' },
    sortOrder: { type: Number, default: 0 },
    validFrom: Date,
    validTo: Date,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const pageSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    content: { type: String, default: '' }, // sanitised HTML
    showInFooter: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
    metaTitle: String,
    metaDescription: String,
  },
  { timestamps: true },
);

const faqSchema = new mongoose.Schema(
  {
    question: { type: String, required: true },
    answer: { type: String, required: true },
    category: { type: String, default: 'general' }, // general, booking, payment, cancellation, bus, flight
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const commissionRuleSchema = new mongoose.Schema(
  {
    name: String,
    scope: { type: String, enum: ['global', 'category', 'vendor', 'service'], required: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
    service: { type: String, enum: ['hotel', 'bus', 'flight'] },
    type: { type: String, enum: ['percent', 'flat'], default: 'percent' },
    value: { type: Number, required: true, min: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

categorySchema.index({ isActive: 1, sortOrder: 1 });
amenitySchema.index({ isActive: 1, isFilterable: 1, name: 1 });
couponSchema.index({ isActive: 1, isPublic: 1, validTo: 1 });
bannerSchema.index({ placement: 1, isActive: 1, sortOrder: 1 });
pageSchema.index({ isActive: 1, showInFooter: 1 });
faqSchema.index({ isActive: 1, category: 1, sortOrder: 1 });
commissionRuleSchema.index({ isActive: 1, scope: 1 });

export const Category = mongoose.model('Category', categorySchema);
export const Amenity = mongoose.model('Amenity', amenitySchema);
export const Coupon = mongoose.model('Coupon', couponSchema);
export const Banner = mongoose.model('Banner', bannerSchema);
export const Page = mongoose.model('Page', pageSchema);
export const Faq = mongoose.model('Faq', faqSchema);
export const CommissionRule = mongoose.model('CommissionRule', commissionRuleSchema);

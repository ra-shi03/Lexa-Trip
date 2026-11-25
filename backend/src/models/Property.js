import mongoose from 'mongoose';
import { PROPERTY_STATUS } from '../constants/enums.js';

const imageSchema = new mongoose.Schema({ url: { type: String, required: true }, alt: String, caption: String }, { _id: true });

/** Bookable accommodation managed by a vendor (hotel, villa, resort, hostel …) */
const propertySchema = new mongoose.Schema(
  {
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
    starRating: { type: Number, min: 0, max: 5, default: 0 },
    shortDescription: { type: String, maxlength: 300 },
    description: String,
    address: {
      line1: String,
      area: String,
      landmark: String,
      pincode: String,
      city: { type: mongoose.Schema.Types.ObjectId, ref: 'City', required: true, index: true },
      state: { type: mongoose.Schema.Types.ObjectId, ref: 'State', required: true },
    },
    geo: { lat: Number, lng: Number },
    images: [imageSchema],
    amenities: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Amenity' }],
    checkInTime: { type: String, default: '14:00' },
    checkOutTime: { type: String, default: '11:00' },
    houseRules: [String],
    childPolicy: String,
    petPolicy: String,
    maxGuests: Number,
    cancellationPolicy: {
      type: { type: String, enum: ['free', 'partial', 'non_refundable'], default: 'free' },
      freeCancellationHours: { type: Number, default: 24 }, // before check-in
      penaltyPercent: { type: Number, default: 0 }, // after the free window
      text: String,
    },
    contact: { phone: String, email: String },
    status: { type: String, enum: PROPERTY_STATUS, default: 'pending' },
    statusNote: String,
    isVisible: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    rating: { avg: { type: Number, default: 0 }, count: { type: Number, default: 0 } },
    minPrice: { type: Number, default: 0 }, // denormalised cheapest base price (for search sort)
    tags: [String],
    channelManager: {
      enabled: { type: Boolean, default: false },
      provider: String, // staah | axisrooms | mock
      hotelCode: String,
      lastSyncAt: Date,
      lastSyncStatus: String,
    },
  },
  { timestamps: true },
);

propertySchema.index({ name: 'text', 'address.area': 'text', tags: 'text' });
propertySchema.virtual('isBookable').get(function isBookable() {
  return this.status === 'approved' && this.isVisible;
});

// Guest search: public filter (status+visible) → city → price/rating sort
propertySchema.index({ status: 1, isVisible: 1, 'address.city': 1, minPrice: 1 });
propertySchema.index({ status: 1, isVisible: 1, category: 1, 'rating.avg': -1 });
propertySchema.index({ status: 1, isVisible: 1, isFeatured: 1, 'rating.avg': -1 }); // home "featured"
propertySchema.index({ status: 1, isVisible: 1, starRating: 1 });
propertySchema.index({ vendor: 1, status: 1, createdAt: -1 }); // vendor list & admin approval queue
propertySchema.index({ 'channelManager.hotelCode': 1 }, { sparse: true }); // webhook mapping
propertySchema.index({ amenities: 1 });

export default mongoose.model('Property', propertySchema);

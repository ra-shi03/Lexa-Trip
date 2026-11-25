import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

const reviewSchema = new mongoose.Schema(
  {
    property: { type: ObjectId, ref: 'Property', required: true },
    user: { type: ObjectId, ref: 'User', required: true },
    booking: { type: ObjectId, ref: 'Booking' },
    rating: { type: Number, min: 1, max: 5, required: true },
    title: String,
    comment: String,
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  },
  { timestamps: true },
);
reviewSchema.index({ property: 1, user: 1, booking: 1 }, { unique: true });

const notificationSchema = new mongoose.Schema(
  {
    recipientType: { type: String, enum: ['user', 'vendor', 'admin'], required: true },
    recipient: { type: ObjectId }, // empty → broadcast to all admins
    title: String,
    body: String,
    type: String, // booking_confirmed, booking_cancelled, vendor_pending …
    data: Object,
    read: { type: Boolean, default: false },
  },
  { timestamps: true },
);

const ticketSchema = new mongoose.Schema(
  {
    user: { type: ObjectId, ref: 'User' },
    booking: { type: ObjectId, ref: 'Booking' },
    subject: { type: String, required: true },
    category: { type: String, default: 'booking' },
    status: { type: String, enum: ['open', 'in_progress', 'resolved', 'closed'], default: 'open' },
    messages: [{ from: { type: String, enum: ['user', 'admin'] }, text: String, at: { type: Date, default: Date.now } }],
  },
  { timestamps: true },
);

const auditLogSchema = new mongoose.Schema(
  {
    actorType: String,
    actor: ObjectId,
    actorName: String,
    action: String, // vendor.approve, property.reject, settings.update …
    entity: String,
    entityId: ObjectId,
    meta: Object,
  },
  { timestamps: true },
);
auditLogSchema.index({ createdAt: -1 });

const syncLogSchema = new mongoose.Schema(
  {
    property: { type: ObjectId, ref: 'Property', index: true },
    provider: String,
    direction: { type: String, enum: ['push', 'pull', 'webhook'] },
    kind: String, // availability | rates | booking | cancellation | mapping
    status: { type: String, enum: ['success', 'failed', 'skipped'] },
    message: String,
    payload: Object,
  },
  { timestamps: true },
);
syncLogSchema.index({ createdAt: -1 });

const mediaSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    filename: String,
    mimeType: String,
    size: Number,
    alt: { type: String, default: '' },
    title: String,
    folder: { type: String, default: 'general' }, // e.g. rajasthan/udaipur/bamboo-saa-resort-spa
    uploadedBy: { type: ObjectId, ref: 'Admin' },
  },
  { timestamps: true },
);
mediaSchema.index({ folder: 1, createdAt: -1 });

/** Chat transcripts for the AI assistant (for quality review & abuse prevention) */
const aiConversationSchema = new mongoose.Schema(
  {
    user: { type: ObjectId, ref: 'User' },
    sessionId: { type: String, index: true },
    messages: [{ role: String, content: String, at: { type: Date, default: Date.now } }],
  },
  { timestamps: true },
);

// reviewSchema's unique {property,user,booking} already covers `property` lookups
reviewSchema.index({ property: 1, status: 1, createdAt: -1 }); // property page reviews
reviewSchema.index({ status: 1, createdAt: -1 }); // moderation queue
notificationSchema.index({ recipientType: 1, recipient: 1, createdAt: -1 });
notificationSchema.index({ recipientType: 1, recipient: 1, read: 1 });
ticketSchema.index({ user: 1, updatedAt: -1 });
ticketSchema.index({ status: 1, updatedAt: -1 });
auditLogSchema.index({ entity: 1, createdAt: -1 });
auditLogSchema.index({ actor: 1, createdAt: -1 });
syncLogSchema.index({ property: 1, createdAt: -1 });
aiConversationSchema.index({ updatedAt: -1 });

export const Review = mongoose.model('Review', reviewSchema);
export const Notification = mongoose.model('Notification', notificationSchema);
export const SupportTicket = mongoose.model('SupportTicket', ticketSchema);
export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
export const SyncLog = mongoose.model('SyncLog', syncLogSchema);
export const Media = mongoose.model('Media', mediaSchema);
export const AiConversation = mongoose.model('AiConversation', aiConversationSchema);

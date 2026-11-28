import mongoose from 'mongoose';

/** One device (FCM registration token) signed in to one kind of account */
const pushTokenSchema = new mongoose.Schema(
  {
    token: { type: String, required: true },
    recipientType: { type: String, enum: ['user', 'vendor', 'admin'], required: true },
    recipient: { type: mongoose.Schema.Types.ObjectId, required: true },
    platform: { type: String, enum: ['web', 'android', 'ios'], default: 'web' },
  },
  { timestamps: true },
);
pushTokenSchema.index({ token: 1, recipientType: 1 }, { unique: true }); // a browser can be signed in as user + admin
pushTokenSchema.index({ recipientType: 1, recipient: 1, updatedAt: -1 });

export default mongoose.model('PushToken', pushTokenSchema);

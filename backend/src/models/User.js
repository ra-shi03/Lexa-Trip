import mongoose from 'mongoose';

const travellerSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    gender: { type: String, enum: ['male', 'female', 'other', ''], default: '' },
    dob: Date,
    phone: String,
    email: String,
    idType: { type: String, enum: ['aadhaar', 'passport', 'pan', 'driving_licence', 'voter_id', ''], default: '' },
    idNumber: String,
    nationality: { type: String, default: 'Indian' },
  },
  { _id: true },
);

/** Customer of the guest app / website. Auth = mobile + OTP. */
const userSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, required: true, unique: true, trim: true },
    avatar: String,
    dob: Date,
    gender: { type: String, enum: ['male', 'female', 'other', 'prefer_not', ''], default: '' },
    savedTravellers: [travellerSchema],
    wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Property' }],
    favouriteCities: [{ type: mongoose.Schema.Types.ObjectId, ref: 'City' }],
    status: { type: String, enum: ['active', 'blocked'], default: 'active' },
    lastLoginAt: Date,
  },
  { timestamps: true },
);

userSchema.index({ name: 'text', email: 'text', phone: 'text' });

userSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model('User', userSchema);

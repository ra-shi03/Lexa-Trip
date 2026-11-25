import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { PERMISSIONS, REVENUE_PERMISSIONS } from '../constants/permissions.js';

/**
 * Platform staff.
 *  role = master   → full control (platform owner)
 *  role = subadmin → created by master, limited to `permissions`; revenue permissions are never allowed.
 */
const adminSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: String,
    password: { type: String, required: true, select: false, minlength: 6 },
    role: { type: String, enum: ['master', 'subadmin'], default: 'subadmin' },
    permissions: {
      type: [{ type: String, enum: Object.keys(PERMISSIONS) }],
      default: [],
      validate: {
        validator(perms) {
          // `this` is the document on save; on findOneAndUpdate it is a Query.
          const role = this?.role ?? this?.getUpdate?.()?.role;
          return role === 'master' || !perms.some((p) => REVENUE_PERMISSIONS.includes(p));
        },
        message: 'Revenue permissions cannot be granted to a sub-admin',
      },
    },
    status: { type: String, enum: ['active', 'suspended'], default: 'active' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    lastLoginAt: Date,
  },
  { timestamps: true },
);

adminSchema.pre('save', async function hashPassword() {
  if (this.role === 'subadmin') {
    this.permissions = this.permissions.filter((p) => !REVENUE_PERMISSIONS.includes(p));
  }
  if (this.isModified('password')) this.password = await bcrypt.hash(this.password, 10);
});
adminSchema.methods.checkPassword = function checkPassword(pw) {
  return bcrypt.compare(pw, this.password);
};

adminSchema.index({ role: 1, status: 1 });

export default mongoose.model('Admin', adminSchema);

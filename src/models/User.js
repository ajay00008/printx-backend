import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    role: {
      type: String,
      enum: ['admin', 'user'],
      default: 'user',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    country: { type: String, trim: true, maxlength: 2 }, // ISO 3166-1 alpha-2 for compliance
    state: { type: String, trim: true },
    city: { type: String, trim: true },
    emailVerified: { type: Boolean, default: false },
    emailVerifiedAt: { type: Date },
    passwordResetToken: { type: String },
    passwordResetExpires: { type: Date },
    emailVerificationOtpHash: { type: String },
    emailVerificationOtpExpires: { type: Date },
  },
  { timestamps: true }
)

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next()
  this.password = await bcrypt.hash(this.password, 12)
  next()
})

// Compare plain password against stored hash
userSchema.methods.comparePassword = async function (plain) {
  return bcrypt.compare(plain, this.password)
}

// Strip password and sensitive fields from JSON output
userSchema.methods.toSafeObject = function () {
  const obj = this.toObject()
  delete obj.password
  delete obj.passwordResetToken
  delete obj.passwordResetExpires
  delete obj.emailVerificationOtpHash
  delete obj.emailVerificationOtpExpires
  return obj
}

export const User = mongoose.model('User', userSchema)

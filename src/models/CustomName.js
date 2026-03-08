import mongoose from 'mongoose'

const customNameSchema = new mongoose.Schema(
  {
    asr: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
    display: { type: String, required: true, trim: true },
  },
  { timestamps: true }
)

export const CustomName = mongoose.model('CustomName', customNameSchema)

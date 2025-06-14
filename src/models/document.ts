import mongoose from 'mongoose';
import type { Document as MongooseDocument } from 'mongoose';

const documentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  clerkId: { type: String, required: true },
  filename: { type: String, required: true },
  originalName: { type: String, required: true },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true },
  namespace: { type: String, required: true }, // e.g., 'clerk_user_id:document_id'
  path: { type: String, required: true },
  status: {
    type: String,
    enum: ['pending', 'processing', 'indexed', 'failed'],
    default: 'pending'
  },
  error: { type: String },
  pageCount: { type: Number },
  processedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update the updatedAt timestamp before saving
documentSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

const Document = mongoose.model('Document', documentSchema);

// Indexes
documentSchema.index({ userId: 1, clerkId: 1 });
documentSchema.index({ namespace: 1 }, { unique: true });
documentSchema.index({ status: 1 });
documentSchema.index({ createdAt: -1 });
documentSchema.index({ updatedAt: -1 });

export type DocumentType = mongoose.InferSchemaType<typeof documentSchema>; // Document type may not contain native methods like `save()`, `find()`, etc.
export type DocumentInstance = MongooseDocument & DocumentType;

export default Document;
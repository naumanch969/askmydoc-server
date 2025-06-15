import mongoose from 'mongoose';
import type { Document as MongooseDocument } from 'mongoose';
import { messageSchema } from './message.js';

const sessionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  clerkId: { type: String, required: true },
  document: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', required: true },
  title: { type: String },
  messages: [messageSchema],
  isPinned: { type: Boolean, default: false },
  status: { type: String, enum: ['active', 'archived'], default: 'active' },
  metadata: {
    totalTokens: { type: Number, default: 0 },
    lastActivity: { type: Date, default: Date.now }
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update the updatedAt timestamp before saving
sessionSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  this.metadata!.lastActivity = new Date();
  next();
});

const Session = mongoose.model('Session', sessionSchema);

// Indexes
sessionSchema.index({ user: 1, document: 1 });
sessionSchema.index({ clerkId: 1 });
sessionSchema.index({ status: 1 });
sessionSchema.index({ createdAt: -1 });
sessionSchema.index({ 'metadata.lastActivity': -1 });


export type SessionType = mongoose.InferSchemaType<typeof sessionSchema>;
export type SessionInstance = MongooseDocument & DocumentType;

export default Session;

import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['user', 'assistant'],
    required: true
  },
  content: { type: String, required: true },
  metadata: {
    tokens: { type: Number },
    processingTime: { type: Number },
    sources: [{
      page: { type: Number },
      content: { type: String }
    }]
  },
  createdAt: { type: Date, default: Date.now }
});

const chatSessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  clerkId: { type: String, required: true },
  documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', required: true },
  title: { type: String },
  messages: [messageSchema],
  status: { type: String, enum: ['active', 'archived'], default: 'active' },
  metadata: {
    totalTokens: { type: Number, default: 0 },
    lastActivity: { type: Date, default: Date.now }
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update the updatedAt timestamp before saving
chatSessionSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  this.metadata!.lastActivity = new Date();
  next();
});

const ChatSession = mongoose.model('ChatSession', chatSessionSchema);

// Indexes
chatSessionSchema.index({ userId: 1, documentId: 1 });
chatSessionSchema.index({ clerkId: 1 });
chatSessionSchema.index({ status: 1 });
chatSessionSchema.index({ createdAt: -1 });
chatSessionSchema.index({ 'metadata.lastActivity': -1 });

export default ChatSession;

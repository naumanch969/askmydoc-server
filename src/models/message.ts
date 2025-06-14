import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true },
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
});

const Message = mongoose.model('Message', messageSchema);
messageSchema.index({ sessionId: 1, timestamp: -1 });
messageSchema.index({ role: 1, timestamp: -1 });
messageSchema.index({ timestamp: -1 });
messageSchema.index({ sessionId: 1, role: 1, timestamp: -1 });
messageSchema.index({ sessionId: 1, content: 'text' });

export default Message

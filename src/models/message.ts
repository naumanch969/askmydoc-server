import mongoose from 'mongoose';
import type { Document as MongooseDocument } from 'mongoose';

export const messageSchema = new mongoose.Schema({
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

export const Message = mongoose.model('Message', messageSchema);

export type MessageType = mongoose.InferSchemaType<typeof messageSchema>;
export type MessageInstance = MongooseDocument & MessageType;


export default Message;
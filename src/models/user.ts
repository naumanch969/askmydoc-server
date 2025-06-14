import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    clerkId: { type: String, required: true, unique: true },
    email: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
userSchema.index({ clerkId: 1 }, { unique: true });
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ createdAt: -1 });
userSchema.index({ clerkId: 1, email: 1 }, { unique: true });
userSchema.index({ clerkId: 1, createdAt: -1 });
userSchema.index({ email: 1, createdAt: -1 });
userSchema.index({ clerkId: 1, email: 1, createdAt: -1 }, { unique: true });

export default User;


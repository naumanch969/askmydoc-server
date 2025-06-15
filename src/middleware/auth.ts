import { Request, Response, NextFunction } from 'express';
import { clerkClient } from '@clerk/clerk-sdk-node';
import { logger } from '../utils/logger.js';
import User from '../models/user.js';

export interface AuthRequest extends Request {
    user?: { id: string; clerkId: string; email: string; };
}

export const authMiddleware = async (req: AuthRequest, res: any, next: NextFunction) => {
    try {
        const sessionToken = req.headers.authorization?.split(' ')[1];
        
        if (!sessionToken) {
            return res.status(401).json({ error: 'No session token provided' });
        }

        // Get the session claims from the token
        const { sub: userId } = await clerkClient.verifyToken(sessionToken);
        if (!userId) {
            return res.status(401).json({ error: 'Invalid session token' });
        }

        // Get the user from the session
        const user = await clerkClient.users.getUser(userId);
        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }

        // Sync user with MongoDB
        const dbUser = await User.findOneAndUpdate(
            { clerkId: user.id },
            {
                email: user.emailAddresses[0]?.emailAddress || '',
                updatedAt: new Date()
            },
            { upsert: true, new: true }
        );

        req.user = {
            id: dbUser._id.toString(),
            clerkId: user.id,
            email: user.emailAddresses[0]?.emailAddress || ''
        };

        next();
    } catch (error) {
        logger.error('Authentication error:', error);
        res.status(401).json({ error: 'Authentication failed' });
    }
};
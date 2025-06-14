import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import ChatSession from '../models/session.js';
import Document from '../models/document.js';
import { logger } from '../utils/logger.js';

// Helper for error responses
const handleError = (res: Response, error: unknown, message = 'Internal server error', status = 500) => {
    logger.error(message, error);
    res.status(status).json({ error: message });
};

// Create a new chat session
export const createSession = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { documentId } = req.body;
        const userId = req.user?.id;
        const clerkId = req.user?.clerkId;

        if (!userId || !clerkId) {
            res.status(401).json({ error: 'User not authenticated' });
            return;
        }

        const document = await Document.findOne({ _id: documentId, userId });
        if (!document) {
            res.status(404).json({ error: 'Document not found' });
            return;
        }

        const session = new ChatSession({
            userId,
            clerkId,
            documentId,
            title: `Chat about ${document.originalName}`,
            messages: [],
            metadata: {
                startTime: new Date(),
                lastActivity: new Date(),
                totalTokens: 0
            }
        });

        await session.save();
        res.status(201).json(session);
    } catch (error) {
        handleError(res, error, 'Failed to create chat session');
    }
};

// Get a specific chat session
export const getSession = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { sessionId } = req.params;
        const userId = req.user?.id;

        if (!userId) {
            res.status(401).json({ error: 'User not authenticated' });
            return;
        }

        const session = await ChatSession.findOne({ _id: sessionId, userId })
            .populate('documentId', 'originalName');

        if (!session) {
            res.status(404).json({ error: 'Session not found' });
            return;
        }

        res.json(session);
    } catch (error) {
        handleError(res, error, 'Failed to fetch session');
    }
};

// Get all chat sessions for a user
export const getSessions = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'User not authenticated' });
            return;
        }

        const sessions = await ChatSession.find({ userId })
            .sort({ 'metadata.lastActivity': -1 })
            .populate('documentId', 'originalName');

        res.json(sessions);
    } catch (error) {
        handleError(res, error, 'Failed to fetch sessions');
    }
};

// Update session metadata (e.g., title, lastActivity)
export const updateSession = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { sessionId } = req.params;
        const userId = req.user?.id;
        const { title } = req.body;

        if (!userId) {
            res.status(401).json({ error: 'User not authenticated' });
            return;
        }

        const session = await ChatSession.findOneAndUpdate(
            { _id: sessionId, userId },
            { 
                title,
                'metadata.lastActivity': new Date()
            },
            { new: true }
        );

        if (!session) {
            res.status(404).json({ error: 'Session not found' });
            return;
        }

        res.json(session);
    } catch (error) {
        handleError(res, error, 'Failed to update session');
    }
};

// Delete a chat session
export const deleteSession = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { sessionId } = req.params;
        const userId = req.user?.id;

        if (!userId) {
            res.status(401).json({ error: 'User not authenticated' });
            return;
        }

        const session = await ChatSession.findOneAndDelete({ _id: sessionId, userId });
        if (!session) {
            res.status(404).json({ error: 'Session not found' });
            return;
        }

        res.json({ message: 'Session deleted successfully' });
    } catch (error) {
        handleError(res, error, 'Failed to delete session');
    }
};
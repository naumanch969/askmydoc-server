import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import ChatSession from '../models/session.js';
import Document from '../models/document.js';
import { logger } from '../utils/logger.js';
import { sendResponse, sendError } from '../utils/response.js';


// Create a new chat session
export const createSession = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { documentId } = req.body;
        const userId = req.user?.id;
        const clerkId = req.user?.clerkId;

        if (!userId || !clerkId) {
            sendError(res, 'User not authenticated', 401);
            return;
        }

        const document = await Document.findOne({ _id: documentId, userId });
        if (!document) {
            sendError(res, 'Document not found', 404);
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
        sendResponse(res, session, 'Chat session created successfully', 201);
    } catch (error) {
        logger.error('Failed to create chat session', error);
        sendError(res, 'Failed to create chat session', 500);
    }
};

// Get a specific chat session
export const getSession = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { sessionId } = req.params;
        const userId = req.user?.id;

        if (!userId) {
            sendError(res, 'User not authenticated', 401);
            return;
        }

        const session = await ChatSession.findOne({ _id: sessionId, userId })
            .populate('documentId', 'originalName');

        if (!session) {
            sendError(res, 'Session not found', 404);
            return;
        }

        sendResponse(res, session);
    } catch (error) {
        logger.error('Failed to fetch session', error);
        sendError(res, 'Failed to fetch session', 500);
    }
};

// Get all chat sessions for a user
export const getSessions = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            sendError(res, 'User not authenticated', 401);
            return;
        }

        const sessions = await ChatSession.find({ userId })
            .sort({ 'metadata.lastActivity': -1 })
            .populate('documentId', 'originalName');

        sendResponse(res, sessions);
    } catch (error) {
        logger.error('Failed to fetch sessions', error);
        sendError(res, 'Failed to fetch sessions', 500);
    }
};

// Update session metadata (e.g., title, lastActivity)
export const updateSession = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { sessionId } = req.params;
        const userId = req.user?.id;
        const { title } = req.body;

        if (!userId) {
            sendError(res, 'User not authenticated', 401);
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
            sendError(res, 'Session not found', 404);
            return;
        }

        sendResponse(res, session, 'Session updated successfully');
    } catch (error) {
        logger.error('Failed to update session', error);
        sendError(res, 'Failed to update session', 500);
    }
};

// Delete a chat session
export const deleteSession = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { sessionId } = req.params;
        const userId = req.user?.id;

        if (!userId) {
            sendError(res, 'User not authenticated', 401);
            return;
        }

        const session = await ChatSession.findOneAndDelete({ _id: sessionId, userId });
        if (!session) {
            sendError(res, 'Session not found', 404);
            return;
        }

        sendResponse(res, null, 'Session deleted successfully');
    } catch (error) {
        logger.error('Failed to delete session', error);
        sendError(res, 'Failed to delete session', 500);
    }
};
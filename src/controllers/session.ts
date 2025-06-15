import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import Session from '../models/session.js';
import Document from '../models/document.js';
import { logger } from '../utils/logger.js';
import { sendResponse, sendError } from '../utils/response.js';


// Create a new chat session
export const createSession = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { documentId } = req.body;
        const userId = req.user?.id;
        const clerkId = req.user?.clerkId;

        logger.info('Creating new chat session', { documentId, userId });

        const document = await Document.findOne({ _id: documentId, userId });
        if (!document) {
            logger.warn('Document not found for session creation', { documentId, userId });
            sendError(res, 'Document not found', 404);
            return;
        }

        logger.info('Found document for session', { documentId, originalName: document.originalName });

        const session = new Session({
            user: userId,
            clerkId,
            document: document._id,
            title: `Chat about ${document.originalName}`,
            messages: [],
            metadata: {
                startTime: new Date(),
                lastActivity: new Date(),
                totalTokens: 0
            }
        });

        await session.save();
        logger.info('Chat session created successfully', { sessionId: session._id, documentId, userId });

        sendResponse(res, session, 'Chat session created successfully', 201);
    } catch (error) {
        logger.error('Failed to create chat session', {
            error,
            documentId: req.body.documentId,
            userId: req.user?.id
        });
        sendError(res, 'Failed to create chat session', 500);
    }
};

// Get a specific chat session
export const getSession = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { sessionId } = req.params;
        const userId = req.user?.id;

        logger.info('Fetching chat session', { sessionId, userId });

        if (!userId) {
            logger.warn('Unauthorized session fetch attempt', { sessionId });
            sendError(res, 'User not authenticated', 401);
            return;
        }

        const session = await Session.findOne({ _id: sessionId, user: userId }).populate('document', 'originalName');

        if (!session) {
            logger.warn('Session not found', { sessionId, userId });
            sendError(res, 'Session not found', 404);
            return;
        }

        logger.info('Successfully retrieved session', {
            sessionId,
            documentName: (session.document as any)?.originalName,
            messageCount: session.messages.length
        });

        sendResponse(res, session, "Session fetched successfully", 200);
    } catch (error) {
        logger.error('Failed to fetch session', {
            error,
            sessionId: req.params.sessionId,
            userId: req.user?.id
        });
        sendError(res, 'Failed to fetch session', 500);
    }
};

// Get all chat sessions for a user
export const getSessions = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        console.log('userId', userId)
        logger.info('Fetching all sessions for user', { userId });

        if (!userId) {
            logger.warn('Unauthorized sessions fetch attempt');
            sendError(res, 'User not authenticated', 401);
            return;
        }

        const sessions = await Session.find({ user: userId })
            .sort({ 'metadata.lastActivity': -1 })
            .populate('document', 'originalName');

        console.log('session', sessions)
        logger.info('Successfully retrieved user sessions', {
            userId,
            sessionCount: sessions.length
        });

        sendResponse(res, sessions, "Sessions fetched successfully", 200);
    } catch (error) {
        logger.error('Failed to fetch sessions', { error, userId: req.user?.id });
        sendError(res, 'Failed to fetch sessions', 500);
    }
};

// Update session metadata (e.g., title, lastActivity)
export const updateSession = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { sessionId } = req.params;
        const userId = req.user?.id;
        const { title } = req.body;

        logger.info('Updating session', { sessionId, user: userId, title });

        if (!userId) {
            logger.warn('Unauthorized session update attempt', { sessionId });
            sendError(res, 'User not authenticated', 401);
            return;
        }

        const session = await Session.findOneAndUpdate(
            { _id: sessionId, user: userId },
            { title, 'metadata.lastActivity': new Date() },
            { new: true }
        );

        if (!session) {
            logger.warn('Session not found for update', { sessionId, userId });
            sendError(res, 'Session not found', 404);
            return;
        }

        logger.info('Successfully updated session', {
            sessionId,
            newTitle: title,
            lastActivity: session.metadata?.lastActivity
        });

        sendResponse(res, session, 'Session updated successfully');
    } catch (error) {
        logger.error('Failed to update session', {
            error,
            sessionId: req.params.sessionId,
            userId: req.user?.id
        });
        sendError(res, 'Failed to update session', 500);
    }
};

export const pinSession = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { sessionId } = req.params;
        const userId = req.user?.id;

        if (!userId) {
            sendError(res, 'User not authenticated', 401);
            return;
        }

        const session = await Session.findOne({ _id: sessionId, user: userId });
        if (!session) {
            sendError(res, 'Session not found', 404);
            return;
        }

        const newPinState = !session.isPinned;
        session.isPinned = newPinState;
        session.metadata!.lastActivity = new Date();
        await session.save();
        console.log('session', session)
        sendResponse(res, session, newPinState ? 'Session pinned' : 'Session unpinned');
    } catch (error) {
        logger.error('Failed to toggle pin state', { error });
        sendError(res, 'Failed to update pin state', 500);
    }
};


// Delete a chat session
export const deleteSession = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { sessionId } = req.params;
        const userId = req.user?.id;

        logger.info('Deleting session', { sessionId, userId });

        if (!userId) {
            logger.warn('Unauthorized session deletion attempt', { sessionId });
            sendError(res, 'User not authenticated', 401);
            return;
        }

        const session = await Session.findOneAndDelete({ _id: sessionId, user: userId }).populate('document',);
        if (!session) {
            logger.warn('Session not found for deletion', { sessionId, userId });
            sendError(res, 'Session not found', 404);
            return;
        }

        logger.info('Successfully deleted session', { sessionId, document: session.document?.originalName, messageCount: session.messages.length });

        sendResponse(res, null, 'Session deleted successfully');
    } catch (error) {
        logger.error('Failed to delete session', {
            error,
            sessionId: req.params.sessionId,
            userId: req.user?.id
        });
        sendError(res, 'Failed to delete session', 500);
    }
};
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import Session from '../models/session.js';

// Helper for error responses
const handleError = (res: Response, error: unknown, message = 'Internal server error', status = 500) => {
    console.error(error);
    res.status(status).json({ message });
};

// Create a new session
export const createSession = async (req: Request, res: Response) => {
    try {
        const { docId, userId } = req.body;
        if (!docId || !userId) {
            return res.status(400).json({ message: 'docId and userId are required' });
        }
        const sessionId = uuidv4();
        const session = new Session({ docId, userId, sessionId, startTime: new Date() });
        await session.save();
        res.status(201).json({ sessionId });
    } catch (error) {
        handleError(res, error);
    }
};

// Get a session by sessionId
export const getSession = async (req: Request, res: Response) => {
    try {
        const { sessionId } = req.params;
        const session = await Session.findOne({ sessionId });
        if (!session) {
            return res.status(404).json({ message: 'Session not found' });
        }
        res.json(session);
    } catch (error) {
        handleError(res, error);
    }
};

// Get all sessions (optionally filter by userId or docId)
export const getSessions = async (req: Request, res: Response) => {
    try {
        const { userId, docId } = req.query;
        const filter: any = {};
        if (userId) filter.userId = userId;
        if (docId) filter.docId = docId;
        const sessions = await Session.find(filter);
        res.json(sessions);
    } catch (error) {
        handleError(res, error);
    }
};

// Update a session (e.g., endTime or other fields)
export const updateSession = async (req: Request, res: Response) => {
    try {
        const { sessionId } = req.params;
        const update = req.body;
        const session = await Session.findOneAndUpdate({ sessionId }, update, { new: true });
        if (!session) {
            return res.status(404).json({ message: 'Session not found' });
        }
        res.json(session);
    } catch (error) {
        handleError(res, error);
    }
};

// Delete a session
export const deleteSession = async (req: Request, res: Response) => {
    try {
        const { sessionId } = req.params;
        const session = await Session.findOneAndDelete({ sessionId });
        if (!session) {
            return res.status(404).json({ message: 'Session not found' });
        }
        res.json({ message: 'Session deleted' });
    } catch (error) {
        handleError(res, error);
    }
};
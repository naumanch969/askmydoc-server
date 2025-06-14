import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import ChatSession from '../models/session.js';
import { logger } from '../utils/logger.js';
import { setChatHistory as setRedisChatHistory, getChatHistory as getRedisChatHistory } from '../config/redis.js';
import { buildConversationChain, buildRetrievalChain, wrapWithHistoryChain, buildRephraseQuestionChain, buildAnswerPrompt } from '../utils/chain.js';
import { getRetriever } from '../utils/vectorStore.js';
import { googleGenAi } from '../config/model.js';
import { HistoryMessage } from '../interfaces/index.js';

// Helper for error responses
const handleError = (res: Response, error: unknown, message = 'Internal server error', status = 500) => {
    logger.error(message, error);
    res.status(status).json({ error: message });
};

// Send a message in a chat session
export const sendMessage = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { sessionId } = req.params;
        const { message } = req.body;
        const userId = req.user?.id;

        if (!userId) {
            res.status(401).json({ error: 'User not authenticated' });
            return;
        }

        const session = await ChatSession.findOne({ _id: sessionId, userId })
            .populate('documentId');

        if (!session) {
            res.status(404).json({ error: 'Chat session not found' });
            return;
        }

        const document = session.documentId as any;
        if (!document) {
            res.status(404).json({ error: 'Document not found' });
            return;
        }

        // Get retriever for the document's namespace
        const retriever = await getRetriever(process.env.PINECONE_INDEX_NAME!, document.namespace);

        // Build the chain components
        const rephraseQuestionChain = buildRephraseQuestionChain(googleGenAi);
        const contextRetrievalChain = await buildRetrievalChain(retriever);
        const answerGenerationChainPrompt = buildAnswerPrompt();
        const conversationalRetrievalChain = buildConversationChain(
            googleGenAi,
            rephraseQuestionChain,
            contextRetrievalChain,
            answerGenerationChainPrompt
        );
        const finalRetrievalChain = wrapWithHistoryChain(conversationalRetrievalChain);

        // Get chat history from Redis
        const history = await getRedisChatHistory(sessionId) || [];

        // Generate response
        const stream = await finalRetrievalChain.stream(
            { question: message, sessionId },
            { configurable: { sessionId } }
        );

        // Save message and response
        const userMessage: HistoryMessage = {
            role: 'user',
            content: message,
            createdAt: new Date()
        };

        const assistantMessage: HistoryMessage = {
            role: 'assistant',
            content: String(stream),
            createdAt: new Date()
        };

        // Update MongoDB
        session.messages.push(userMessage, assistantMessage);
        if (session.metadata) {
            session.metadata.totalTokens += message.length / 4;
            session.metadata.lastActivity = new Date();
        }
        await session.save();

        // Update Redis cache
        history.push(userMessage, assistantMessage);
        await setRedisChatHistory(sessionId, history);

        res.json({ message: assistantMessage, stream });
    } catch (error) {
        handleError(res, error, 'Failed to process message');
    }
};

// Get chat history for a session
export const getChatHistory = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { sessionId } = req.params;
        const userId = req.user?.id;

        if (!userId) {
            res.status(401).json({ error: 'User not authenticated' });
            return;
        }

        const session = await ChatSession.findOne({ _id: sessionId, userId });
        if (!session) {
            res.status(404).json({ error: 'Chat session not found' });
            return;
        }

        res.json(session.messages);
    } catch (error) {
        handleError(res, error, 'Failed to fetch chat history');
    }
};

import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import ChatSession from '../models/session.js';
import { logger } from '../utils/logger.js';
import { setChatHistory as setRedisChatHistory, getChatHistory as getRedisChatHistory } from '../config/redis.js';
import { buildConversationChain, buildRetrievalChain, wrapWithHistoryChain, buildRephraseQuestionChain, buildAnswerPrompt } from '../utils/chain.js';
import { getRetriever } from '../utils/vectorStore.js';
import { googleGenAi } from '../config/model.js';
import { HistoryMessage } from '../interfaces/index.js';
import { sendResponse, sendError } from '../utils/response.js';


// Send a message in a chat session
export const sendMessage = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { sessionId } = req.params;
        const { message } = req.body;
        const userId = req.user?.id;

        if (!userId) {
            sendError(res, 'User not authenticated', 401);
            return;
        }

        const session = await ChatSession.findOne({ _id: sessionId, userId })
            .populate('documentId');

        if (!session) {
            sendError(res, 'Chat session not found', 404);
            return;
        }

        const document = session.documentId as any;
        if (!document) {
            sendError(res, 'Document not found', 404);
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

        sendResponse(res, { message: assistantMessage, stream });
    } catch (error) {
        logger.error('Failed to process message', error);
        sendError(res, 'Failed to process message', 500);
    }
};

// Get chat history for a session
export const getChatHistory = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { sessionId } = req.params;
        const userId = req.user?.id;

        if (!userId) {
            sendError(res, 'User not authenticated', 401);
            return;
        }

        const session = await ChatSession.findOne({ _id: sessionId, userId });
        if (!session) {
            sendError(res, 'Chat session not found', 404);
            return;
        }

        sendResponse(res, session.messages);
    } catch (error) {
        logger.error('Failed to fetch chat history', error);
        sendError(res, 'Failed to fetch chat history', 500);
    }
};

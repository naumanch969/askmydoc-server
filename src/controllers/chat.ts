import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import ChatSession, { MessageType } from '../models/session.js';
import { logger } from '../utils/logger.js';
import { getRedisMessageHistory } from '../utils/messageHistory.js';
import { buildConversationChain, buildRetrievalChain, wrapWithHistoryChain, buildRephraseQuestionChain, buildAnswerPrompt } from '../utils/chain.js';
import { getRetriever } from '../utils/vectorStore.js';
import { googleGenAi } from '../config/model.js';
import { sendResponse, sendError } from '../utils/response.js';
import { HumanMessage, AIMessage } from '@langchain/core/messages';

// Send a message in a chat session
export const sendMessage = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { sessionId } = req.params;
        const { message } = req.body;
        const userId = req.user?.id;

        logger.info('Processing new message', { sessionId, userId, messageLength: message?.length });

        if (!userId) {
            logger.warn('Unauthorized message attempt', { sessionId });
            sendError(res, 'User not authenticated', 401);
            return;
        }

        const session = await ChatSession.findOne({ _id: sessionId, userId })
            .populate('documentId');

        if (!session) {
            logger.warn('Chat session not found', { sessionId, userId });
            sendError(res, 'Chat session not found', 404);
            return;
        }

        const document = session.documentId as any;
        if (!document) {
            logger.warn('Document not found for session', { sessionId, userId });
            sendError(res, 'Document not found', 404);
            return;
        }

        logger.info('Building retrieval chain', {
            sessionId,
            documentId: document._id,
            namespace: document.namespace
        });

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

        // Get message history before creating the chain
        const messageHistory = getRedisMessageHistory(sessionId);

        // Create the chain with the message history
        const finalRetrievalChain = wrapWithHistoryChain(conversationalRetrievalChain);

        logger.info('Generating response', { sessionId });

        // Generate response
        const stream = await finalRetrievalChain.invoke(
            { question: message, sessionId },
            { configurable: { sessionId } }
        );

        logger.info('Response generated successfully', {
            sessionId,
            responseLength: String(stream).length,
            stream
        });

        // Save message and response
        const userMessage: MessageType = {
            role: 'user',
            content: message,
            createdAt: new Date()
        };

        const assistantMessage: MessageType = {
            role: 'assistant',
            content: String(stream),
            createdAt: new Date(),
        };

        // Update MongoDB
        session.messages.push(userMessage, assistantMessage);
        if (session.metadata) {
            session.metadata.totalTokens += message.length / 4;
            session.metadata.lastActivity = new Date();
        }
        await session.save();

        logger.info('Updated session in MongoDB', {
            sessionId,
            messageCount: session.messages.length,
            totalTokens: session.metadata?.totalTokens
        });

        // Update Redis cache with LangChain message format
        await messageHistory.addMessage(new HumanMessage(message));
        await messageHistory.addMessage(new AIMessage(String(stream)));

        logger.info('Updated message history in Redis', { sessionId });

        sendResponse(res, assistantMessage, 'Message processed successfully', 200);
    } catch (error) {
        logger.error('Failed to process message', {
            error,
            sessionId: req.params.sessionId,
            userId: req.user?.id
        });
        sendError(res, 'Failed to process message', 500);
    }
};

// Get chat history for a session
export const getChatHistory = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { sessionId } = req.params;
        const userId = req.user?.id;

        logger.info('Fetching chat history', { sessionId, userId });

        if (!userId) {
            logger.warn('Unauthorized history fetch attempt', { sessionId });
            sendError(res, 'User not authenticated', 401);
            return;
        }

        const session = await ChatSession.findOne({ _id: sessionId, userId });
        if (!session) {
            logger.warn('Chat session not found for history fetch', { sessionId, userId });
            sendError(res, 'Chat session not found', 404);
            return;
        }

        logger.info('Successfully retrieved chat history', {
            sessionId,
            messageCount: session.messages.length
        });

        sendResponse(res, session.messages);
    } catch (error) {
        logger.error('Failed to fetch chat history', {
            error,
            sessionId: req.params.sessionId,
            userId: req.user?.id
        });
        sendError(res, 'Failed to fetch chat history', 500);
    }
};

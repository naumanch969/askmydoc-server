import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { logger } from '../utils/logger.js';
import { buildRephraseQuestionChain, buildRetrievalChain, buildAnswerPrompt, buildConversationChain, wrapWithHistoryChain } from '../utils/chain.js';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { getRetriever } from '../utils/vectorStore.js';
import { getRedisMessageHistory } from '../utils/messageHistory.js';
import { googleGenAi } from '../config/model.js';
import Session from '../models/session.js';
import { SocketMessage } from '../interfaces/index.js';

interface ChatMessage {
    sessionId: string;
    message: string;
    userId: string;
}

export class SocketService {
    private io: SocketIOServer;

    constructor(server: HTTPServer) {
        this.io = new SocketIOServer(server, {
            cors: {
                origin: ["http://localhost:3000", "http://localhost:3001"],
                methods: ["GET", "POST"],
                credentials: true
            }
        });

        this.initializeSocketHandlers();
    }

    private initializeSocketHandlers() {
        this.io.on('connection', (socket) => {
            logger.info(`Client connected: ${socket.id}`);

            // Join a chat session
            socket.on('join_session', (sessionId: string) => {
                socket.join(sessionId);
                logger.info(`Client ${socket.id} joined session: ${sessionId}`);
            });

            // Handle chat messages
            socket.on('send_message', async (data: SocketMessage) => {
                try {
                    const { sessionId, message, clerkId } = data;
                    logger.info('Processing new message', { sessionId, userId: clerkId, messageLength: message?.length });

                    if (!clerkId) {
                        logger.warn('Unauthorized message attempt', { sessionId });
                        socket.emit('error', {
                            message: 'User not authenticated',
                            timestamp: new Date().toISOString()
                        });
                        return;
                    }

                    const session = await Session.findOne({ _id: sessionId, clerkId }).populate('document');

                    if (!session) {
                        logger.warn('Chat session not found', { sessionId, clerkId });
                        socket.emit('error', { message: 'Chat session not found', timestamp: new Date().toISOString() });
                        return;
                    }

                    const document = session.document as any;
                    if (!document) {
                        logger.warn('Document not found for session', { sessionId, userId: clerkId });
                        socket.emit('error', { message: 'Document not found', timestamp: new Date().toISOString() });
                        return;
                    }

                    logger.info('Building retrieval chain', { sessionId, documentId: document._id, namespace: document.namespace });

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
                        responseLength: String(stream).length
                    });

                    // Save message and response
                    const userMessage = {
                        role: 'user',
                        content: message,
                        createdAt: new Date()
                    };

                    const assistantMessage = {
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

                    // Emit the response back to the specific session room
                    this.io.to(sessionId).emit('receive_message', {
                        message: assistantMessage.content,
                        timestamp: new Date().toISOString()
                    });

                } catch (error) {
                    logger.error('Failed to process message', {
                        error,
                        sessionId: data.sessionId,
                        clerkId: data.clerkId
                    });
                    socket.emit('error', {
                        message: 'Failed to process message',
                        timestamp: new Date().toISOString()
                    });
                }
            });

            // Handle disconnection
            socket.on('disconnect', () => {
                logger.info(`Client disconnected: ${socket.id}`);
            });
        });
    }

    // Method to broadcast system messages
    public broadcastSystemMessage(sessionId: string, message: string) {
        this.io.to(sessionId).emit('system_message', {
            message,
            timestamp: new Date().toISOString()
        });
    }
} 
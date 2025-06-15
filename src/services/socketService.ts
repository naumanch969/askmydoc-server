import { Server as HTTPServer } from 'http';
import { logger } from '../utils/logger.js';
import { buildRephraseQuestionChain, buildRetrievalChain, buildAnswerPrompt, buildConversationChain, wrapWithHistoryChain } from '../utils/chain.js';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { getRetriever } from '../utils/vectorStore.js';
import { getRedisMessageHistory } from '../utils/messageHistory.js';
import { googleGenAi } from '../config/model.js';
import Session from '../models/session.js';
import { SocketMessage } from '../interfaces/index.js';
import { DocumentWorker } from '../workers/documentWorker.js';
import Document from '../models/document.js';
import { getNamespace } from '../utils/index.js';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { initializeSocket } from '../config/socket.js';
import User from '../models/user.js';

interface ChatMessage {
    sessionId: string;
    message: string;
    userId: string;
}

export class SocketService {
    private documentWorker: DocumentWorker;

    constructor(server: HTTPServer) {
        const io = initializeSocket(server);
        this.documentWorker = new DocumentWorker();
        this.initializeSocketHandlers(io);
    }

    private initializeSocketHandlers(io: any) {
        io.on('connection', (socket: any) => {
            logger.info(`Client connected: ${socket.id}`);

            // Handle file upload
            socket.on('upload_document', async (data: { file: Buffer, filename: string, clerkId: string }) => {
                try {
                    const { file, filename, clerkId } = data;
                    logger.info('Received document upload request', { filename, clerkId, fileSize: file.length });

                    if (!clerkId) {
                        logger.warn('Unauthorized document upload attempt');
                        socket.emit('upload_error', {
                            message: 'User not authenticated',
                            timestamp: new Date().toISOString()
                        });
                        return;
                    }

                    const user = await User.findOne({ clerkId })
                    if (!user) {
                        logger.warn('Unauthorized document upload attempt');
                        socket.emit('upload_error', {
                            message: 'User not authenticated',
                            timestamp: new Date().toISOString()
                        });
                        return;
                    }


                    // Generate unique filename and path
                    const uniqueFilename = `${uuidv4()}-${filename}`;
                    const uploadPath = path.join(process.cwd(), 'uploads', uniqueFilename);

                    // Ensure uploads directory exists
                    await fs.mkdir(path.join(process.cwd(), 'uploads'), { recursive: true });

                    // Save file to disk
                    await fs.writeFile(uploadPath, file);

                    const namespace = getNamespace(clerkId, filename);
                    logger.info('Generated namespace for document', { namespace });

                    // Check if document with same namespace already exists
                    const existingDocument = await Document.findOne({ namespace });
                    if (existingDocument) {
                        logger.warn('Document with same namespace already exists', { namespace, existingDocumentId: existingDocument._id });
                        socket.emit('upload_error', { message: 'A document with this name already exists. Please use a different name or delete the existing document.', timestamp: new Date().toISOString() });
                        return;
                    }

                    // Create document in database
                    const document = new Document({
                        user: user._id,
                        clerkId,
                        filename: uniqueFilename,
                        originalName: filename,
                        mimeType: 'application/pdf', // Assuming PDF for now
                        size: file.length,
                        namespace,
                        path: uploadPath,
                        status: 'pending',
                    });

                    await document.save();
                    logger.info('Document saved to database', {
                        documentId: document._id,
                        namespace,
                        status: document.status
                    });

                    // Add document processing job to queue with socket ID
                    await this.documentWorker.addJob({
                        documentId: String(document._id),
                        socketId: socket.id
                    });

                    logger.info('Document processing job added to queue', { documentId: document._id });

                } catch (error) {
                    logger.error('Upload document error:', {
                        error,
                        filename: data.filename,
                        clerkId: data.clerkId
                    });
                    socket.emit('upload_error', {
                        message: 'Failed to upload document',
                        timestamp: new Date().toISOString()
                    });
                }
            });

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

                    // Emit thinking state
                    io.to(sessionId).emit('ai_state', {
                        state: 'thinking',
                        message: 'Analyzing your question...',
                        timestamp: new Date().toISOString()
                    });

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

                    // Emit generating state
                    io.to(sessionId).emit('ai_state', {
                        state: 'generating',
                        message: 'Generating response...',
                        timestamp: new Date().toISOString()
                    });

                    logger.info('Generating response', { sessionId });

                    // Generate response with streaming
                    const stream = await finalRetrievalChain.stream(
                        { question: message, sessionId },
                        { configurable: { sessionId } }
                    );

                    // Create a temporary message ID for streaming
                    const tempMessageId = Date.now().toString();

                    // Initialize the streaming message
                    io.to(sessionId).emit('stream_start', {
                        messageId: tempMessageId,
                        timestamp: new Date().toISOString()
                    });

                    let fullResponse = '';
                    for await (const chunk of stream) {
                        fullResponse += chunk;
                        // Emit each chunk to the client
                        io.to(sessionId).emit('stream_chunk', {
                            messageId: tempMessageId,
                            content: chunk,
                            timestamp: new Date().toISOString()
                        });
                    }

                    // Emit stream end
                    io.to(sessionId).emit('stream_end', {
                        messageId: tempMessageId,
                        timestamp: new Date().toISOString()
                    });

                    logger.info('Response generated successfully', {
                        sessionId,
                        responseLength: fullResponse.length
                    });

                    // Save message and response
                    const userMessage = {
                        role: 'user',
                        content: message,
                        createdAt: new Date()
                    };

                    const assistantMessage = {
                        role: 'assistant',
                        content: fullResponse,
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
                    await messageHistory.addMessage(new AIMessage(fullResponse));

                    logger.info('Updated message history in Redis', { sessionId });

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
        io.to(sessionId).emit('system_message', {
            message,
            timestamp: new Date().toISOString()
        });
    }
} 
import { Response } from 'express';
import { buildConversationChain, buildRetrievalChain, wrapWithHistoryChain, buildRephraseQuestionChain, buildAnswerPrompt } from '../utils/chain.js';
import { getRetriever } from '../utils/vectorStore.js';
import ChatSession from '../models/session.js';
import Document from '../models/document.js';
import { logger } from '../utils/logger.js';
import { setChatHistory as setRedisChatHistory, getChatHistory as getRedisChatHistory } from '../config/redis.js';
import { AuthRequest } from '../middleware/auth.js';
import { googleGenAi } from '../config/model.js';
import { HistoryMessage } from '../interfaces/index.js';

export const createChatSession = async (req: AuthRequest, res: Response): Promise<void> => {
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
      messages: []
    });

    await session.save();
    res.status(201).json(session);
  } catch (error) {
    logger.error('Create chat session error:', error);
    res.status(500).json({ error: 'Failed to create chat session' });
  }
};

export const getChatSessions = async (req: AuthRequest, res: Response): Promise<void> => {
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
    logger.error('Get chat sessions error:', error);
    res.status(500).json({ error: 'Failed to fetch chat sessions' });
  }
};

export const query = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;
    const { message }: { message: string } = req.body;
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

    // Initialize the model
    const model = googleGenAi;

    // Build the chain components
    const rephraseQuestionChain = buildRephraseQuestionChain(model);
    const contextRetrievalChain = await buildRetrievalChain(retriever);
    const answerGenerationChainPrompt = buildAnswerPrompt();
    const conversationalRetrievalChain = buildConversationChain(
      model,
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
      // TODO: Handle streaming response properly
      content: String(stream),
      createdAt: new Date()
    };

    // Update MongoDB
    session.messages.push(userMessage, assistantMessage);
    if (session.metadata) {
      session.metadata.totalTokens += message.length / 4;
    }
    await session.save();

    // Update Redis cache
    history.push(userMessage, assistantMessage);
    await setRedisChatHistory(sessionId, history);

    res.json({ message: assistantMessage, stream });

  } catch (error) {
    logger.error('Send message error:', error);
    res.status(500).json({ error: 'Failed to process message' });
  }
};

export const getChat = async (req: AuthRequest, res: Response): Promise<void> => {
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
    logger.error('Get chat history error:', error);
    res.status(500).json({ error: 'Failed to fetch chat history' });
  }
};

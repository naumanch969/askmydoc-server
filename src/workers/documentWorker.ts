import { BaseWorker } from './baseWorker.js';
import { logger } from '../utils/logger.js';
import { getEmbeddingsModel, initVectorStoreFromPDF } from '../utils/vectorStore.js';
import Document from '../models/document.js';
import { DocumentStatus } from '../enums/index.js';
import Session from '../models/session.js';
import { getIO } from '../config/socket.js';

export class DocumentWorker extends BaseWorker {
  constructor() {
    super('document-worker', 'document-queue', 2); // Process 2 documents concurrently
  }

  protected async process(job: any): Promise<void> {
    try {
      const { documentId, socketId } = job.data;
      const io = getIO();
      logger.info(`Processing document ${documentId}`);

      const document = await Document.findById(documentId).populate('user');
      if (!document) {
        throw new Error(`Document ${documentId} not found`);
      }

      document.status = DocumentStatus.PROCESSING;
      await document.save();

      // Emit processing started event
      io.to(socketId).emit('document_processing_started', {
        documentId: document._id,
        timestamp: new Date().toISOString()
      });

      // Emit progress updates during processing
      const progressCallback = (progress: number) => {
        io.to(socketId).emit('document_processing_progress', {
          documentId: document._id,
          progress: Math.round(progress * 100),
          timestamp: new Date().toISOString()
        });
      };

      await initVectorStoreFromPDF(document, progressCallback);

      document.status = DocumentStatus.INDEXED;
      document.processedAt = new Date();
      await document.save();
      logger.info(`Document ${documentId} processed successfully`);

      // Create Session
      const session = new Session({
        user: document.user,
        clerkId: document.clerkId,
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
      logger.info(`Session created for document ${documentId}`, { sessionId: session._id });

      // Emit processing completed event with session ID
      io.to(socketId).emit('document_processing_completed', {
        documentId: document._id,
        sessionId: session._id,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error(`Error processing document:`, error);
      throw error;
    }
  }
}

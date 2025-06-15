import { BaseWorker } from './baseWorker.js';
import { logger } from '../utils/logger.js';
import { getEmbeddingsModel, initVectorStoreFromPDF } from '../utils/vectorStore.js';
import Document from '../models/document.js';
import { DocumentStatus } from '../enums/index.js';
import Session from '../models/session.js';

export class DocumentWorker extends BaseWorker {
  constructor() {
    super('document-worker', 'document-queue', 2); // Process 2 documents concurrently
  }

  protected async process(job: any): Promise<void> {
    try {
      const { documentId } = job.data;
      logger.info(`Processing document ${documentId}`);

      const document = await Document.findById(documentId).populate('user');
      if (!document) {
        throw new Error(`Document ${documentId} not found`);
      }

      document.status = DocumentStatus.PROCESSING;
      await document.save();

      await initVectorStoreFromPDF(document);


      document.status = DocumentStatus.INDEXED;
      document.processedAt = new Date();
      await document.save();
      logger.info(`Document ${documentId} processed successfully`);

      console.log('document', document);
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

    } catch (error) {
      logger.error(`Error processing document:`, error);
      throw error;
    }
  }
}

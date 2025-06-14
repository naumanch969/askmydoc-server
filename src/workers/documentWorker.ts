import { Worker } from 'bullmq';
import { logger } from '../utils/logger.js';
import Document from '../models/document.js';
import { DOCUMENT_PROCESSING_QUEUE } from '../constants/index.js';
import { initVectorStoreFromPDF } from '../utils/vectorStore.js';

// Set up the worker
const documentWorker = new Worker(DOCUMENT_PROCESSING_QUEUE,
  async (job) => {
    const { documentId } = job.data;
    const document = await Document.findById(documentId);

    if (!document) throw new Error('Document not found');

    try {
      document.status = 'processing';
      await document.save();

      await initVectorStoreFromPDF(document);

      document.status = 'indexed';
      document.processedAt = new Date();
      await document.save();

      logger.info(`Document ${documentId} processed successfully`);
    } catch (error: any) {
      logger.error(`Error processing document ${documentId}:`, error);
      document.status = 'failed';
      document.error = error.message;
      await document.save();
      throw error;
    }
  },
  {
    connection: { host: 'localhost', port: 6379 },
  }
);

// Log job events
documentWorker.on('completed', (job: any) => {
  logger.info(`✅ Job ${job.id} completed for document ${job.data.documentId}`);
});

documentWorker.on('failed', (job: any, error: any) => {
  logger.error(`❌ Job ${job.id} failed for document ${job.data.documentId}:`, error);
});

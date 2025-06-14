import { Queue } from 'bullmq';
import { DOCUMENT_PROCESSING_QUEUE } from '../constants/index.js';

export const documentQueue = new Queue(DOCUMENT_PROCESSING_QUEUE, {
  connection: { host: 'localhost', port: 6379 },
});

// Function to add a job
export const processDocument = async (documentId: string) => {
  await documentQueue.add('process', { documentId });
};

import { WorkerManager } from './workerManager.js';
import { DocumentWorker } from './documentWorker.js';
import { logger } from '../utils/logger.js';

export async function initializeWorkers(): Promise<void> {
    try {
        const workerManager = WorkerManager.getInstance();

        // Initialize document worker
        const documentWorker = new DocumentWorker();
        await documentWorker.initialize();

        // Start all workers
        await workerManager.startAll();
        logger.info('All workers started successfully');
    } catch (error) {
        logger.error('Failed to initialize workers:', error);
        throw error;
    }
}

export async function shutdownWorkers(): Promise<void> {
    try {
        const workerManager = WorkerManager.getInstance();
        await workerManager.stopAll();
        logger.info('All workers stopped successfully');
    } catch (error) {
        logger.error('Failed to stop workers:', error);
        throw error;
    }
} 
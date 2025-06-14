import { Worker } from 'bullmq';
import { logger } from '../utils/logger.js';
import { redisConnection } from '../config/redis.js';

export interface WorkerConfig {
    name: string;
    queueName: string;
    processor: (job: any) => Promise<any>;
    concurrency?: number;
}

export class WorkerManager {
    private workers: Map<string, Worker> = new Map();
    private static instance: WorkerManager;

    private constructor() { }

    public static getInstance(): WorkerManager {
        if (!WorkerManager.instance) {
            WorkerManager.instance = new WorkerManager();
        }
        return WorkerManager.instance;
    }

    public async registerWorker(config: WorkerConfig): Promise<void> {
        try {
            const worker = new Worker(
                config.queueName,
                config.processor,
                {
                    connection: redisConnection,
                    concurrency: config.concurrency || 1,
                    removeOnComplete: {
                        count: 1000,
                        age: 24 * 3600 // 24 hours
                    },
                    removeOnFail: {
                        count: 5000,
                        age: 24 * 3600 // 24 hours
                    }
                }
            );

            worker.on('completed', (job) => {
                logger.info(`Job ${job.id} completed for worker ${config.name}`);
            });

            worker.on('failed', (job, error) => {
                logger.error(`Job ${job?.id} failed for worker ${config.name}:`, error);
            });

            worker.on('error', (error) => {
                logger.error(`Worker ${config.name} error:`, error);
            });

            this.workers.set(config.name, worker);
            logger.info(`Worker ${config.name} registered successfully`);
        } catch (error) {
            logger.error(`Failed to register worker ${config.name}:`, error);
            throw error;
        }
    }

    public async startAll(): Promise<void> {
        try {
            for (const [name, worker] of this.workers) {
                if (worker.isRunning()) {
                    logger.info(`Worker ${name} is already running, skipping start`);
                    continue;
                }
                await worker.run();
                logger.info(`Worker ${name} started`);
            }
        } catch (error) {
            logger.error('Failed to start workers:', error);
            throw error;
        }
    }

    public async stopAll(): Promise<void> {
        try {
            for (const [name, worker] of this.workers) {
                await worker.close();
                logger.info(`Worker ${name} stopped`);
            }
        } catch (error) {
            logger.error('Failed to stop workers:', error);
            throw error;
        }
    }

    public getWorker(name: string): Worker | undefined {
        return this.workers.get(name);
    }
} 
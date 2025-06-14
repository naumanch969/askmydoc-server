import { Queue } from 'bullmq';
import { logger } from '../utils/logger.js';
import { WorkerManager, WorkerConfig } from './workerManager.js';
import { redisConnection } from '../config/redis.js';

export abstract class BaseWorker {
    protected queue: Queue;
    protected workerManager: WorkerManager;

    constructor(
        protected readonly name: string,
        protected readonly queueName: string,
        protected readonly concurrency: number = 1
    ) {
        this.queue = new Queue(queueName, {
            connection: redisConnection,
            defaultJobOptions: {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 1000
                },
                removeOnComplete: {
                    count: 1000,
                    age: 24 * 3600 // 24 hours
                },
                removeOnFail: {
                    count: 5000,
                    age: 24 * 3600 // 24 hours
                }
            }
        });

        this.workerManager = WorkerManager.getInstance();
    }

    public async initialize(): Promise<void> {
        try {
            const config: WorkerConfig = {
                name: this.name,
                queueName: this.queueName,
                processor: this.process.bind(this),
                concurrency: this.concurrency
            };

            await this.workerManager.registerWorker(config);
            logger.info(`Worker ${this.name} initialized`);
        } catch (error) {
            logger.error(`Failed to initialize worker ${this.name}:`, error);
            throw error;
        }
    }

    public async addJob(data: any, options?: any): Promise<void> {
        try {
            await this.queue.add(this.name, data, options);
            logger.info(`Job added to queue ${this.queueName}`);
        } catch (error) {
            logger.error(`Failed to add job to queue ${this.queueName}:`, error);
            throw error;
        }
    }

    protected abstract process(job: any): Promise<any>;

    public async close(): Promise<void> {
        await this.queue.close();
    }
} 
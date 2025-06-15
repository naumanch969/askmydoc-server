import { Redis } from 'ioredis';
import { logger } from '../utils/logger.js';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Redis client for general operations
const redisClient = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
    },
    enableReadyCheck: true,
    connectTimeout: 10000,
    disconnectTimeout: 2000,
});

// Redis connection for BullMQ
export const redisConnection = {
    host: new URL(REDIS_URL).hostname,
    port: parseInt(new URL(REDIS_URL).port),
    password: new URL(REDIS_URL).password || undefined
};

redisClient.on('error', (err: Error) => {
    logger.error('Redis Client Error:', err);
});

redisClient.on('connect', () => {
    logger.info('Redis Client Connected');
});

redisClient.on('ready', () => {
    logger.info('Redis Client Ready');
});

redisClient.on('reconnecting', () => {
    logger.info('Redis Client Reconnecting');
});

// Helper functions for chat history
export const setChatHistory = async (sessionId: string, messages: any[]) => {
    try {
        await redisClient.set(`chat:${sessionId}`, JSON.stringify(messages));
    } catch (error) {
        logger.error('Error setting chat history:', error);
        throw error;
    }
};

export const getChatHistory = async (sessionId: string) => {
    try {
        const history = await redisClient.get(`chat:${sessionId}`);
        return history ? JSON.parse(history) : [];
    } catch (error) {
        logger.error('Error getting chat history:', error);
        throw error;
    }
};

export const clearChatHistory = async (sessionId: string) => {
    try {
        await redisClient.del(`chat:${sessionId}`);
    } catch (error) {
        logger.error('Error clearing chat history:', error);
        throw error;
    }
};

export default redisClient; 
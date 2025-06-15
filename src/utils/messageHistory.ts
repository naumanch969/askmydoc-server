import { RedisChatMessageHistory } from "@langchain/community/stores/message/redis";
import { BaseChatMessageHistory } from "@langchain/core/chat_history";
import redisClient from '../config/redis.js';
import { logger } from '../utils/logger.js';

// Create a singleton instance of RedisChatMessageHistory for each session
const messageHistoryInstances = new Map<string, RedisChatMessageHistory>();

// Track if we're currently creating an instance
const creatingInstances = new Set<string>();

export const getRedisMessageHistory = (sessionId: string): BaseChatMessageHistory => {
    // If we already have an instance, return it
    if (messageHistoryInstances.has(sessionId)) {
        return messageHistoryInstances.get(sessionId)!;
    }

    // If we're already creating an instance for this session, wait for it
    if (creatingInstances.has(sessionId)) {
        logger.info(`Waiting for existing RedisChatMessageHistory instance for session ${sessionId}`);
        return messageHistoryInstances.get(sessionId)!;
    }

    // Mark that we're creating an instance
    creatingInstances.add(sessionId);

    try {
        logger.info(`Creating new RedisChatMessageHistory instance for session ${sessionId}`);
        const history = new RedisChatMessageHistory({
            sessionId,
            config: {
                url: process.env.REDIS_URL || 'redis://localhost:6379',
            },
            sessionTTL: 60 * 60 * 24 * 7,
        });

        // Store the instance
        messageHistoryInstances.set(sessionId, history);
        return history;
    } finally {
        // Always remove from creating set
        creatingInstances.delete(sessionId);
    }
};

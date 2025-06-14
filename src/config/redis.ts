import { createClient } from 'redis';
import { logger } from '../utils/logger.js';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const redisClient = createClient({
  url: REDIS_URL
});

redisClient.on('error', (err) => {
  logger.error('Redis Client Error:', err);
});

redisClient.on('connect', () => {
  logger.info('Redis Client Connected');
});

export const connectRedis = async () => {
  try {
    await redisClient.connect();
  } catch (error) {
    logger.error('Redis connection error:', error);
    process.exit(1);
  }
};

export const disconnectRedis = async () => {
  try {
    await redisClient.disconnect();
    logger.info('Redis disconnected successfully');
  } catch (error) {
    logger.error('Redis disconnection error:', error);
  }
};

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
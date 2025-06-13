import { RedisChatMessageHistory } from "@langchain/community/stores/message/redis";
import { BaseChatMessageHistory } from "@langchain/core/chat_history";
import { Redis } from "ioredis";

const redisClient = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

export const getRedisMessageHistory = (sessionId: string): BaseChatMessageHistory => {
    return new RedisChatMessageHistory({
        sessionId,
        client: redisClient,
        config: {
            ttl: 60 * 60 * 24 * 7, // 7 days TTL
        },
    });
};

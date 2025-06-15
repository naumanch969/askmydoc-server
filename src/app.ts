import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import redisClient from './config/redis.js';
import { initializeWorkers, shutdownWorkers } from './workers/index.js';
import router from './routes/index.js';
import { logger } from './utils/logger.js';
import { connectDB } from './config/database.js';
import mongoose from 'mongoose';

const app = express();
const port = process.env.PORT || 4000;

// Middleware
app.use(helmet());
app.use(cors({ origin: ["http://localhost:3000", "http://localhost:3001"], credentials: true }));
app.use(express.json());
app.use(morgan('dev'));

// Routes
app.use('/api', router);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
async function startServer() {
    try {
        // Connect to MongoDB
        await connectDB();

        // Initialize workers
        await initializeWorkers();

        // Redis automatically connected when we make ioredis instance.

        // Start server
        app.listen(port, () => {
            logger.info(`Server running on port ${port}`);
        });
    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Graceful shutdown
async function shutdown() {
    try {
        logger.info('Shutting down server...');

        // Stop workers
        await shutdownWorkers();
        logger.info('Workers stopped');

        // Close Redis connection
        await redisClient.quit();
        logger.info('Redis connection closed');

        // Close MongoDB connection
        await mongoose.connection.close();
        logger.info('MongoDB connection closed');

        process.exit(0);
    } catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
    }
}

// Handle shutdown signals
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
process.on('SIGHUP', shutdown);

// Start the server
startServer(); 
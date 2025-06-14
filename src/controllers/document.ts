import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import Document from '../models/document.js';
import { logger } from '../utils/logger.js';
import { DocumentWorker } from '../workers/documentWorker.js';
import { processDocument } from '../queues/documentProcessor.js';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';
import { Pinecone } from '@pinecone-database/pinecone';
import { pineconeIndex } from '../config/pinecone.js';

// Initialize document worker
const documentWorker = new DocumentWorker();

export const uploadDocument = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const file = req.file;
        const userId = req.user?.id;
        const clerkId = req.user?.clerkId;

        if (!file) {
            res.status(400).json({ error: 'No file uploaded' });
            return;
        }

        if (!userId || !clerkId) {
            res.status(401).json({ error: 'User not authenticated' });
            return;
        }

        const document = new Document({
            userId,
            clerkId,
            originalName: file.originalname,
            path: file.path,
            size: file.size,
            mimeType: file.mimetype,
            status: 'pending',
            namespace: `${userId}::${file.originalname}`
        });

        await document.save();

        // Add document processing job to queue
        await documentWorker.addJob({ documentId: document._id });

        res.status(201).json(document);
    } catch (error) {
        logger.error('Upload document error:', error);
        res.status(500).json({ error: 'Failed to upload document' });
    }
};

export const getDocuments = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'User not authenticated' });
            return;
        }

        const documents = await Document.find({ userId })
            .sort({ createdAt: -1 })
            .select('-path');

        res.json(documents);
    } catch (error) {
        logger.error('Get documents error:', error);
        res.status(500).json({ error: 'Failed to fetch documents' });
    }
};

export const getDocument = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;

        if (!userId) {
            res.status(401).json({ error: 'User not authenticated' });
            return;
        }

        const document = await Document.findOne({ _id: id, userId })
            .select('-path');

        if (!document) {
            res.status(404).json({ error: 'Document not found' });
            return;
        }

        res.json(document);
    } catch (error) {
        logger.error('Get document error:', error);
        res.status(500).json({ error: 'Failed to fetch document' });
    }
};

export const deleteDocument = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;

        if (!userId) {
            res.status(401).json({ error: 'User not authenticated' });
            return;
        }

        const document = await Document.findOne({ _id: id, userId });
        if (!document) {
            res.status(404).json({ error: 'Document not found' });
            return;
        }

        // Delete file from storage
        try {
            await fs.unlink(document.path);
        } catch (error) {
            logger.error('File deletion error:', error);
        }

        // Delete vectors from Pinecone
        try {
            await pineconeIndex.deleteMany({
                namespace: document.namespace
            });
            logger.info(`Deleted vectors for namespace: ${document.namespace}`);
        } catch (error) {
            logger.error('Pinecone deletion error:', error);
        }

        // Delete document from database
        await document.deleteOne();

        res.json({ message: 'Document deleted successfully' });
    } catch (error) {
        logger.error('Delete document error:', error);
        res.status(500).json({ error: 'Failed to delete document' });
    }
}; 
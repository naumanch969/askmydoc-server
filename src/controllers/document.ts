import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import Document from '../models/document.js';
import { logger } from '../utils/logger.js';
import { processDocument } from '../queues/documentProcessor.js';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';
import { Pinecone } from '@pinecone-database/pinecone';
import { pineconeIndex } from '../config/pinecone.js';

export const uploadDocument = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        if (!req.file) {
            res.status(400).json({ error: 'No file uploaded' });
            return;
        }

        const { originalname, mimetype, size, filename } = req.file;
        const userId = req.user?.id;
        const clerkId = req.user?.clerkId;

        if (!userId || !clerkId) {
            res.status(401).json({ error: 'User not authenticated' });
            return;
        }

        const docId = uuidv4();
        const namespace = `${clerkId}:${docId}`;
        const filePath = path.join(process.env.UPLOAD_DIR || 'uploads', filename);

        const document = new Document({
            userId,
            clerkId,
            filename,
            originalName: originalname,
            mimeType: mimetype,
            size,
            namespace,
            path: filePath,
            status: 'pending'
        });

        await document.save();

        // Queue document processing
        await processDocument(document._id.toString());

        res.status(201).json({
            message: 'Document uploaded successfully',
            document: {
                id: document._id,
                status: document.status,
                namespace: document.namespace
            }
        });
    } catch (error) {
        logger.error('Document upload error:', error);
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
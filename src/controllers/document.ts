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
import { getNamespace } from '../utils/index.js';
import { sendResponse, sendError } from '../utils/response.js';

// Initialize document worker
const documentWorker = new DocumentWorker();

export const uploadDocument = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const file = req.file;
        const userId = req.user?.id;
        const clerkId = req.user?.clerkId;

        if (!file) {
            sendError(res, 'No file uploaded', 400);
            return;
        }

        if (!userId || !clerkId) {
            sendError(res, 'User not authenticated', 401);
            return;
        }

        const namespace = getNamespace(userId, file.originalname);

        // Check if document with same namespace already exists
        const existingDocument = await Document.findOne({ namespace });
        if (existingDocument) {
            sendResponse(res, existingDocument, 'A document with this name already exists. Please use a different name or delete the existing document.', 409);
            return;
        }

        console.log('file:', file);
        const document = new Document({
            userId,
            clerkId,
            filename: file.filename,
            originalName: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
            namespace,
            path: file.path,
            status: 'pending',
        });

        await document.save();
        console.log('document:', document);

        // Add document processing job to queue
        await documentWorker.addJob({ documentId: document._id });

        sendResponse(res, document, 'Document uploaded successfully', 201);
    } catch (error) {
        logger.error('Upload document error:', error);
        sendError(res, 'Failed to upload document');
    }
};

export const getDocuments = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            sendError(res, 'User not authenticated', 401);
            return;
        }

        const documents = await Document.find({ userId })
            .sort({ createdAt: -1 })
            .select('-path');

        sendResponse(res, documents);
    } catch (error) {
        logger.error('Get documents error:', error);
        sendError(res, 'Failed to fetch documents');
    }
};

export const getDocument = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;

        if (!userId) {
            sendError(res, 'User not authenticated', 401);
            return;
        }

        const document = await Document.findOne({ _id: id, userId })
            .select('-path');

        if (!document) {
            sendError(res, 'Document not found', 404);
            return;
        }

        sendResponse(res, document);
    } catch (error) {
        logger.error('Get document error:', error);
        sendError(res, 'Failed to fetch document');
    }
};

export const deleteDocument = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;

        if (!userId) {
            sendError(res, 'User not authenticated', 401);
            return;
        }

        const document = await Document.findOne({ _id: id, userId });
        if (!document) {
            sendError(res, 'Document not found', 404);
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

        sendResponse(res, null, 'Document deleted successfully');
    } catch (error) {
        logger.error('Delete document error:', error);
        sendError(res, 'Failed to delete document');
    }
}; 
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import Document from '../models/document.js';
import { logger } from '../utils/logger.js';
import { DocumentWorker } from '../workers/documentWorker.js';
import fs from 'fs/promises';
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

        logger.info('Processing document upload', {
            userId,
            filename: file?.originalname,
            size: file?.size
        });

        if (!file) {
            logger.warn('No file uploaded');
            sendError(res, 'No file uploaded', 400);
            return;
        }

        if (!userId || !clerkId) {
            logger.warn('Unauthorized document upload attempt');
            sendError(res, 'User not authenticated', 401);
            return;
        }

        const namespace = getNamespace(userId, file.originalname);
        logger.info('Generated namespace for document', { namespace });

        // Check if document with same namespace already exists
        const existingDocument = await Document.findOne({ namespace });
        if (existingDocument) {
            logger.warn('Document with same namespace already exists', {
                namespace,
                existingDocumentId: existingDocument._id
            });
            sendResponse(res, existingDocument, 'A document with this name already exists. Please use a different name or delete the existing document.', 409);
            return;
        }

        const document = new Document({
            user: userId,
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
        logger.info('Document saved to database', {
            documentId: document._id,
            namespace,
            status: document.status
        });

        // Add document processing job to queue
        await documentWorker.addJob({ documentId: document._id });
        logger.info('Document processing job added to queue', { documentId: document._id });

        sendResponse(res, document, 'Document uploaded successfully', 201);
    } catch (error) {
        logger.error('Upload document error:', {
            error,
            userId: req.user?.id,
            filename: req.file?.originalname
        });
        sendError(res, 'Failed to upload document');
    }
};

export const getDocuments = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;

        logger.info('Fetching documents for user', { userId });

        if (!userId) {
            logger.warn('Unauthorized documents fetch attempt');
            sendError(res, 'User not authenticated', 401);
            return;
        }

        const documents = await Document.find({ userId })
            .sort({ createdAt: -1 })
            .select('-path');

        logger.info('Successfully retrieved documents', {
            userId,
            documentCount: documents.length
        });

        sendResponse(res, documents, "Documents fetched successfully", 200);
    } catch (error) {
        logger.error('Get documents error:', {
            error,
            userId: req.user?.id
        });
        sendError(res, 'Failed to fetch documents');
    }
};

export const getDocument = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;

        logger.info('Fetching document', { documentId: id, userId });

        if (!userId) {
            logger.warn('Unauthorized document fetch attempt', { documentId: id });
            sendError(res, 'User not authenticated', 401);
            return;
        }

        const document = await Document.findOne({ _id: id, userId })
            .select('-path');

        if (!document) {
            logger.warn('Document not found', { documentId: id, userId });
            sendError(res, 'Document not found', 404);
            return;
        }

        logger.info('Successfully retrieved document', {
            documentId: id,
            namespace: document.namespace,
            status: document.status
        });

        sendResponse(res, document, "Document fetched successfully", 200);
    } catch (error) {
        logger.error('Get document error:', {
            error,
            documentId: req.params.id,
            userId: req.user?.id
        });
        sendError(res, 'Failed to fetch document');
    }
};

export const deleteDocument = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;

        logger.info('Deleting document', { documentId: id, userId });

        if (!userId) {
            logger.warn('Unauthorized document deletion attempt', { documentId: id });
            sendError(res, 'User not authenticated', 401);
            return;
        }

        const document = await Document.findOne({ _id: id, userId });
        if (!document) {
            logger.warn('Document not found for deletion', { documentId: id, userId });
            sendError(res, 'Document not found', 404);
            return;
        }

        // Delete file from storage
        try {
            await fs.unlink(document.path);
            logger.info('File deleted from storage', {
                documentId: id,
                path: document.path
            });
        } catch (error) {
            logger.error('File deletion error:', {
                error,
                documentId: id,
                path: document.path
            });
        }

        // Delete vectors from Pinecone
        try {
            await pineconeIndex.deleteMany({
                namespace: document.namespace
            });
            logger.info('Deleted vectors from Pinecone', {
                documentId: id,
                namespace: document.namespace
            });
        } catch (error) {
            logger.error('Pinecone deletion error:', {
                error,
                documentId: id,
                namespace: document.namespace
            });
        }

        // Delete document from database
        await document.deleteOne();
        logger.info('Document deleted from database', { documentId: id });

        sendResponse(res, null, 'Document deleted successfully');
    } catch (error) {
        logger.error('Delete document error:', {
            error,
            documentId: req.params.id,
            userId: req.user?.id
        });
        sendError(res, 'Failed to delete document');
    }
}; 
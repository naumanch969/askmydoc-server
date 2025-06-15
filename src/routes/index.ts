import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { uploadDocument, getDocuments, getDocument, deleteDocument } from '../controllers/document.js';
import { createSession, getSessions, getSession, updateSession, deleteSession } from '../controllers/session.js';
import { sendMessage, getChatHistory } from '../controllers/chat.js';
import { deleteDocumentValidation, getDocumentValidation } from '../validations/document.js';
import { createSessionValidation, deleteSessionValidation, getSessionValidation, updateSessionValidation } from '../validations/session.js';
import { getChatHistoryValidation, sendMessageValidation } from '../validations/chat.js';
import multer from 'multer';
import { storage } from '../utils/index.js';

const router = Router();

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files are allowed'));
        }
    },
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

// Document routes
router.post('/documents', authMiddleware, upload.single('file'), uploadDocument);
router.get('/documents', authMiddleware, getDocuments);
router.get('/documents/:id', authMiddleware, getDocumentValidation, validate, getDocument);
router.delete('/documents/:id', authMiddleware, deleteDocumentValidation, validate, deleteDocument);

// Session routes
router.post('/sessions', authMiddleware, createSessionValidation, validate, createSession);
router.get('/sessions', authMiddleware, getSessions);
router.get('/sessions/:sessionId', authMiddleware, getSessionValidation, validate, getSession);
router.put('/sessions/:sessionId', authMiddleware, updateSessionValidation, validate, updateSession);
router.delete('/sessions/:sessionId', authMiddleware, deleteSessionValidation, validate, deleteSession);

// Chat routes
router.post('/sessions/:sessionId/messages', authMiddleware, sendMessageValidation, validate, sendMessage);
router.get('/sessions/:sessionId/messages', authMiddleware, getChatHistoryValidation, validate, getChatHistory);

export default router; 
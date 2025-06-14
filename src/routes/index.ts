import express from 'express';
import multer from 'multer';
import { authMiddleware } from '../middleware/auth.js';
import { storage } from '../utils/index.js';
import { deleteDocument, getDocument, getDocuments, uploadDocument } from '../controllers/document.js';
import { createSession, deleteSession, getSession, getSessions, updateSession } from '../controllers/session.js';
import { getChatHistory } from '../config/redis.js';
import { sendMessage } from '../controllers/chat.js';

const router = express.Router();

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
router.get('/documents/:id', authMiddleware, getDocument);
router.delete('/documents/:id', authMiddleware, deleteDocument);

// Session routes
router.post('/sessions', authMiddleware, createSession);
router.get('/sessions', authMiddleware, getSessions);
router.get('/sessions/:sessionId', authMiddleware, getSession);
router.patch('/sessions/:sessionId', authMiddleware, updateSession);
router.delete('/sessions/:sessionId', authMiddleware, deleteSession);

// Chat routes
router.post('/sessions/:sessionId/messages', authMiddleware, sendMessage);
router.get('/sessions/:sessionId/messages', authMiddleware, getChatHistory);

export default router; 
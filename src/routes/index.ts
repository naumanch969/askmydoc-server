import express, { RequestHandler } from 'express';
import multer from 'multer';
import { authMiddleware } from '../middleware/auth.js';
import * as documentController from '../controllers/document.js';
import * as chatController from '../controllers/chat.js';
import { storage } from '../utils/index.js';

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
router.post('/documents', authMiddleware, upload.single('file'), documentController.uploadDocument as RequestHandler);
router.get('/documents', authMiddleware, documentController.getDocuments as RequestHandler);
router.get('/documents/:id', authMiddleware, documentController.getDocument as RequestHandler);
router.delete('/documents/:id', authMiddleware, documentController.deleteDocument as RequestHandler);

// Chat routes
router.post('/chat/sessions', authMiddleware, chatController.createChatSession as RequestHandler);
router.get('/chat/sessions', authMiddleware, chatController.getChatSessions as RequestHandler);
router.post('/chat/sessions/:sessionId/messages', authMiddleware, chatController.query as RequestHandler);
router.get('/chat/sessions/:sessionId/messages', authMiddleware, chatController.getChat as RequestHandler);

export default router; 
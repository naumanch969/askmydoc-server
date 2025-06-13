import { Router } from 'express';
import { uploadPDF } from '../controllers/upload.js';
import multer from 'multer';
import { storage } from '../utils/index.js';

const router = Router();

const upload = multer({ storage });

router.post('/pdf', upload.single('pdf'), uploadPDF);

export default router;
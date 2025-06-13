import { Router } from 'express';
import { queryPDF } from '../controllers/chat.js';

const router = Router();

router.get('/query', queryPDF);

export default router;
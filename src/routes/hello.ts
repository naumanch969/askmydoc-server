import { Router } from 'express';
import { helloController } from '../controllers/hello.js';

const router = Router();

router.get('/hello', helloController);

export default router;
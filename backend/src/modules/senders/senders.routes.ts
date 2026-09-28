import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import * as controller from './senders.controller.js';

const router = Router();

router.get('/', authMiddleware, controller.getSenders);
router.get('/limits', authMiddleware, controller.getLimits);

export { router as sendersRouter };

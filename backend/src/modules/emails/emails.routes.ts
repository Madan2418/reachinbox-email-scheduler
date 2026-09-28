import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import * as controller from './emails.controller.js';

const router = Router();

router.get('/', authMiddleware, controller.listEmails);
router.get('/search', authMiddleware, controller.searchEmails);

export { router as emailsRouter };

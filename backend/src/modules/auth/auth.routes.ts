import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import * as controller from './auth.controller.js';

const router = Router();

router.get('/google', controller.startGoogleAuth);
router.get('/google/callback', controller.googleCallback);
router.get('/me', authMiddleware, controller.getMe);
router.post('/logout', controller.logout);

export { router as authRouter };

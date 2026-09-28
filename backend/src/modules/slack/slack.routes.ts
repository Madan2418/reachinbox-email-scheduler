import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import * as controller from './slack.controller.js';

const router = Router();

router.get('/connect', authMiddleware, controller.startSlackConnect);
router.get('/callback', controller.slackCallback);
router.get('/status', authMiddleware, controller.getSlackStatus);
router.post('/disconnect', authMiddleware, controller.disconnectSlack);

export { router as slackRouter };

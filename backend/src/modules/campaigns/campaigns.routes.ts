import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './campaigns.controller.js';
import { createCampaignSchema } from './campaigns.schema.js';

const router = Router();

router.post('/', authMiddleware, validate(createCampaignSchema), controller.createCampaign);

export { router as campaignsRouter };

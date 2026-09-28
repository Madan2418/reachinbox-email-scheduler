import type { Request, Response, NextFunction } from 'express';
import type { CreateCampaignInput } from './campaigns.schema.js';
import { createCampaignWithEmails } from './campaigns.service.js';

export async function createCampaign(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.session!.userId;
    const input = req.body as CreateCampaignInput;
    const result = await createCampaignWithEmails(userId, input);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

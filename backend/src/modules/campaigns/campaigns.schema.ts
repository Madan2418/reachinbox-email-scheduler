import { z } from 'zod';

const leadSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
});

export const createCampaignSchema = z.object({
  subject: z.string().min(1).max(500),
  body: z.string().min(1),
  startAt: z.string().datetime().refine(
    (s) => new Date(s) > new Date(),
    'Start time must be in the future',
  ),
  delayMs: z.number().int().nonnegative(),
  hourlyLimit: z.number().int().positive(),
  leads: z.array(leadSchema).min(1).max(10_000),
});

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;

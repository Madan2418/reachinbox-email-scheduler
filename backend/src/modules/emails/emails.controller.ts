import type { Request, Response, NextFunction } from 'express';
import { db } from '../../db/client.js';
import { emails } from '../../db/schema.js';
import { eq, and, inArray, desc } from 'drizzle-orm';
import { searchEmails as esSearch } from '../../integrations/elastic.js';
import { z } from 'zod';

const listQuerySchema = z.object({
  status: z.enum(['scheduled', 'sent']).default('scheduled'),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

const searchQuerySchema = z.object({
  q: z.string().default(''),
  status: z.enum(['scheduled', 'processing', 'sent', 'failed']).optional(),
  page: z.coerce.number().int().positive().default(1),
});

export async function listEmails(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.session!.userId;
    const query = listQuerySchema.parse(req.query);

    // "sent" tab shows both sent and failed
    const statusFilter =
      query.status === 'sent'
        ? inArray(emails.status, ['sent', 'failed'])
        : eq(emails.status, 'scheduled');

    const rows = await db
      .select()
      .from(emails)
      .where(and(eq(emails.userId, userId), statusFilter))
      .orderBy(desc(emails.scheduledAt))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize);

    res.json({ emails: rows, page: query.page, pageSize: query.pageSize });
  } catch (err) {
    next(err);
  }
}

export async function searchEmails(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.session!.userId;
    const query = searchQuerySchema.parse(req.query);
    const { hits, total } = await esSearch(userId, query.q, query.status, query.page);
    res.json({ results: hits, total, page: query.page });
  } catch (err) {
    next(err);
  }
}

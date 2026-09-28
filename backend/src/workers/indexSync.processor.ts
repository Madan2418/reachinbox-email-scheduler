import type { Job } from 'bullmq';
import { db } from '../db/client.js';
import { emails } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { indexEmail } from '../integrations/elastic.js';
import { createChildLogger } from '../lib/logger.js';
import type { IndexSyncJobData } from '../queue/queues.js';

const log = createChildLogger('indexSync.processor');

export async function indexSyncProcessor(job: Job<IndexSyncJobData>): Promise<void> {
  const { emailId } = job.data;

  const [email] = await db
    .select()
    .from(emails)
    .where(eq(emails.id, emailId))
    .limit(1);

  if (!email) {
    log.warn({ emailId }, 'Email not found for index sync');
    return;
  }

  await indexEmail({
    id: email.id,
    userId: email.userId,
    campaignId: email.campaignId,
    to: email.toEmail,
    subject: email.subject,
    body: email.body,
    status: email.status,
    scheduledAt: email.scheduledAt.toISOString(),
    sentAt: email.sentAt?.toISOString() ?? null,
  });

  log.debug({ emailId }, 'Email indexed to Elasticsearch');
}

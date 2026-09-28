import { db } from '../db/client.js';
import { emails } from '../db/schema.js';
import { emailSendQueue } from './queues.js';
import { eq, and, lt } from 'drizzle-orm';
import { createChildLogger } from '../lib/logger.js';

const log = createChildLogger('reconcile');

/**
 * Run once on API/worker boot.
 *
 * 1. Reset stale `processing` rows (older than 2 min) back to `scheduled`.
 * 2. Find `scheduled` rows with no matching BullMQ job and re-add them.
 *
 * This ensures recovery from Redis wipes and process crashes.
 */
export async function reconcileQueue(): Promise<void> {
  log.info('Starting queue reconciliation');

  // Step 1: Reset stale processing rows
  const staleThreshold = new Date(Date.now() - 2 * 60 * 1000);
  const staleReset = await db
    .update(emails)
    .set({ status: 'scheduled' })
    .where(
      and(
        eq(emails.status, 'processing'),
        lt(emails.scheduledAt, staleThreshold),
      ),
    )
    .returning({ id: emails.id });

  if (staleReset.length > 0) {
    log.info({ count: staleReset.length }, 'Reset stale processing rows to scheduled');
  }

  // Step 2: Re-enqueue scheduled rows with no job in BullMQ
  const scheduledEmails = await db
    .select()
    .from(emails)
    .where(eq(emails.status, 'scheduled'));

  let requeued = 0;
  const nowMs = Date.now();

  for (const email of scheduledEmails) {
    const job = await emailSendQueue.getJob(email.id);
    if (job !== undefined && job !== null) continue; // Already in queue

    const delay = Math.max(0, email.scheduledAt.getTime() - nowMs);
    await emailSendQueue.add(
      'send-email',
      { emailId: email.id },
      { jobId: email.id, delay },
    );
    requeued++;
  }

  log.info({ requeued, total: scheduledEmails.length }, 'Queue reconciliation complete');
}

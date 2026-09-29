import { db } from '../db/client.js';
import { emails, senders } from '../db/schema.js';
import { emailSendQueue } from './queues.js';
import { eq } from 'drizzle-orm';
import { createChildLogger } from '../lib/logger.js';

const log = createChildLogger('reconcile');

/**
 * Run once on API/worker boot.
 *
 * 1. Fix any senders where fromEmail was set to a URL instead of email address.
 * 2. Reset processing rows back to `scheduled`.
 * 3. Find `scheduled` rows with no pending BullMQ job and re-add them.
 *
 * This ensures recovery from Redis wipes, process crashes, and retries.
 */
export async function reconcileQueue(): Promise<void> {
  log.info('Starting queue reconciliation');

  // Step 1: Fix any senders where fromEmail is a URL
  try {
    const allSenders = await db.select().from(senders);
    for (const s of allSenders) {
      if (s.fromEmail.startsWith('http') || s.fromEmail.includes('://')) {
        await db
          .update(senders)
          .set({ fromEmail: s.smtpUser })
          .where(eq(senders.id, s.id));
        log.info({ senderId: s.id, fromEmail: s.smtpUser }, 'Fixed sender fromEmail to smtpUser');
      }
    }
  } catch (err) {
    log.warn({ err }, 'Failed to check/fix senders');
  }

  // Step 2: Reset processing rows back to scheduled
  const staleReset = await db
    .update(emails)
    .set({ status: 'scheduled' })
    .where(eq(emails.status, 'processing'))
    .returning({ id: emails.id });

  if (staleReset.length > 0) {
    log.info({ count: staleReset.length }, 'Reset processing rows to scheduled');
  }

  // Step 3: Re-enqueue scheduled rows with no active job in BullMQ
  const scheduledEmails = await db
    .select()
    .from(emails)
    .where(eq(emails.status, 'scheduled'));

  let requeued = 0;
  const nowMs = Date.now();

  for (const email of scheduledEmails) {
    const job = await emailSendQueue.getJob(email.id);
    if (job) {
      const state = await job.getState();
      if (state === 'completed' || state === 'failed') {
        await job.remove();
      } else {
        continue; // Job is already active, waiting, or delayed
      }
    }

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

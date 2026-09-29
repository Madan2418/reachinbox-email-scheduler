import type { Job } from 'bullmq';
import { DelayedError } from 'bullmq';
import { db } from '../db/client.js';
import { emails, campaigns, senders } from '../db/schema.js';
import { eq, and, inArray } from 'drizzle-orm';
import { redis } from '../lib/redis.js';
import { createChildLogger } from '../lib/logger.js';
import { sendEmail } from '../integrations/smtp.js';
import { enqueueIndexSync } from '../queue/enqueue.js';
import { reserveSlot, effectiveLimit, setSlackNotified } from './rateLimiter/rateLimiter.js';
import { postSlackMessage } from '../integrations/slack.js';
import { decrypt } from '../lib/crypto.js';
import { db as dbClient } from '../db/client.js';
import type { SendEmailJobData } from '../queue/queues.js';
import { currentHourWindowEnd } from '../lib/time.js';
import { slackConnections } from '../db/schema.js';

const log = createChildLogger('sendEmail.processor');

export async function sendEmailProcessor(job: Job<SendEmailJobData>): Promise<void> {
  const { emailId } = job.data;

  // --- Step 1: Load email, campaign, sender ---
  const [email] = await db
    .select()
    .from(emails)
    .where(eq(emails.id, emailId))
    .limit(1);

  if (!email) {
    log.warn({ emailId }, 'Email not found, skipping');
    return;
  }

  // Idempotency layer 1: already handled
  if (email.status === 'sent' || email.status === 'failed') {
    log.info({ emailId, status: email.status }, 'Email already handled, skipping');
    return;
  }

  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.id, email.campaignId))
    .limit(1);

  const [sender] = await db
    .select()
    .from(senders)
    .where(eq(senders.id, email.senderId))
    .limit(1);

  if (!campaign || !sender) {
    log.error({ emailId }, 'Campaign or sender not found');
    return;
  }

  // --- Step 2: Reserve slot (atomic Lua) ---
  const limit = effectiveLimit(campaign.hourlyLimit, sender.hourlyLimit);
  const reservation = await reserveSlot(redis, sender.id, limit);

  if (reservation.status === 'HOURLY_LIMIT' || reservation.status === 'TOO_SOON') {
    let waitMs = reservation.waitMs;

    if (reservation.status === 'HOURLY_LIMIT') {
      // Preserve relative order: seq-based offset into next window
      waitMs = currentHourWindowEnd() - Date.now() + (email.seq % 1000) * 25;

      // Fire Slack alert once per sender per window
      const isFirst = await setSlackNotified(redis, sender.id);
      if (isFirst) {
        const [connection] = await db
          .select()
          .from(slackConnections)
          .where(eq(slackConnections.userId, email.userId))
          .limit(1);

        if (connection) {
          const webhookUrl = decrypt(connection.webhookUrlEnc);
          await postSlackMessage(
            webhookUrl,
            `🚦 *Rate limit hit* for sender \`${sender.fromEmail}\`.\n` +
              `Limit: ${limit}/hr • Emails delayed to next window.`,
          );
        }
      }
    }

    // Update scheduledAt in DB
    await db
      .update(emails)
      .set({ scheduledAt: new Date(Date.now() + waitMs) })
      .where(eq(emails.id, emailId));

    // Move job to delayed state
    await job.moveToDelayed(Date.now() + waitMs, job.token);
    throw new DelayedError();
  }

  // --- Step 3: Claim the row (idempotency layer 2) ---
  const claimed = await db
    .update(emails)
    .set({ status: 'processing', attempts: email.attempts + 1 })
    .where(and(eq(emails.id, emailId), inArray(emails.status, ['scheduled', 'processing'])))
    .returning({ id: emails.id });

  if (claimed.length === 0) {
    log.info({ emailId }, 'Another worker claimed this email, skipping');
    return;
  }

  // --- Step 4: Send via Nodemailer ---
  try {
    const result = await sendEmail(sender, email.toEmail, email.subject, email.body);

    // --- Step 5: Mark sent ---
    await db
      .update(emails)
      .set({
        status: 'sent',
        messageId: result.messageId,
        previewUrl: result.previewUrl,
        sentAt: new Date(),
      })
      .where(eq(emails.id, emailId));

    // --- Step 6: Index sync ---
    await enqueueIndexSync(emailId);

    log.info({ emailId, to: email.toEmail }, 'Email sent successfully');
  } catch (err) {
    // Reset status back to 'scheduled' so BullMQ retry can claim it again
    await db
      .update(emails)
      .set({ status: 'scheduled' })
      .where(eq(emails.id, emailId));

    // BullMQ will retry with exponential backoff
    log.error({ err, emailId }, 'Failed to send email, will retry');
    throw err;
  }
}

/**
 * Called when all retries are exhausted.
 */
export async function onSendEmailFailed(job: Job<SendEmailJobData>, err: Error): Promise<void> {
  const { emailId } = job.data;
  await db
    .update(emails)
    .set({ status: 'failed', error: err.message })
    .where(eq(emails.id, emailId));
  await enqueueIndexSync(emailId);
  log.error({ emailId, err: err.message }, 'Email permanently failed');
}

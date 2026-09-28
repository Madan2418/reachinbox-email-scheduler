import { db } from '../../db/client.js';
import { campaigns, emails, senders } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import type { CreateCampaignInput } from './campaigns.schema.js';
import { enqueueSendJobs, enqueueIndexSync } from '../../queue/enqueue.js';
import { jitter } from '../../lib/time.js';
import { env } from '../../config/env.js';
import { createChildLogger } from '../../lib/logger.js';

const log = createChildLogger('campaigns.service');

const DB_CHUNK_SIZE = 500;

export async function createCampaignWithEmails(
  userId: string,
  input: CreateCampaignInput,
) {
  // Load the user's senders for round-robin assignment
  const userSenders = await db.select().from(senders).where(eq(senders.userId, userId));
  if (userSenders.length === 0) {
    throw new Error('No senders available. Please log out and back in to seed senders.');
  }

  // Deduplicate leads by email
  const seen = new Set<string>();
  const uniqueLeads = input.leads.filter((l) => {
    const key = l.email.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const startAt = new Date(input.startAt);
  const totalCount = uniqueLeads.length;

  // Insert campaign + email rows in one transaction
  const insertedEmails = await db.transaction(async (tx) => {
    const [campaign] = await tx
      .insert(campaigns)
      .values({
        userId,
        subject: input.subject,
        body: input.body,
        startAt,
        delayMs: input.delayMs,
        hourlyLimit: input.hourlyLimit,
        totalCount,
        status: 'active',
      })
      .returning();

    const campaignId = campaign!.id;
    const allInserted: (typeof emails.$inferSelect)[] = [];

    // Insert in chunks to avoid huge param lists
    for (let i = 0; i < uniqueLeads.length; i += DB_CHUNK_SIZE) {
      const chunk = uniqueLeads.slice(i, i + DB_CHUNK_SIZE);
      const rows = chunk.map((lead, idx) => {
        const seq = i + idx;
        const sender = userSenders[seq % userSenders.length]!;
        const scheduledAtMs =
          startAt.getTime() +
          seq * input.delayMs +
          jitter(env.SEND_JITTER_MS);

        const scheduledAt = new Date(scheduledAtMs);
        return {
          campaignId,
          userId,
          senderId: sender.id,
          seq,
          toEmail: lead.email.toLowerCase(),
          subject: input.subject,
          body: input.body,
          scheduledAt,
          originalScheduledAt: scheduledAt,
          status: 'scheduled',
        };
      });

      // onConflictDoNothing handles CSV duplicates and double-submits
      const inserted = await tx
        .insert(emails)
        .values(rows)
        .onConflictDoNothing()
        .returning();

      allInserted.push(...inserted);
    }

    return allInserted;
  });

  log.info(
    { userId, count: insertedEmails.length, total: uniqueLeads.length },
    'Campaign created, enqueuing jobs',
  );

  // Enqueue after commit (best-effort, reconcile repairs on restart)
  await enqueueSendJobs(insertedEmails);

  // Enqueue index sync jobs (best effort)
  for (const email of insertedEmails) {
    await enqueueIndexSync(email.id);
  }

  return {
    campaignId: insertedEmails[0]?.campaignId,
    totalScheduled: insertedEmails.length,
    skipped: uniqueLeads.length - insertedEmails.length,
  };
}

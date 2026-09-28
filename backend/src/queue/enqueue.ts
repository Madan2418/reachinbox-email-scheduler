import type { Email } from '../db/schema.js';
import { emailSendQueue, indexSyncQueue } from './queues.js';
import { createChildLogger } from '../lib/logger.js';

const log = createChildLogger('enqueue');

const BULK_CHUNK_SIZE = 500;

/**
 * Enqueues delayed send jobs for the given emails in chunks of 500.
 * Job ID equals email.id for deduplication (idempotency layer 3).
 */
export async function enqueueSendJobs(emails: Email[]): Promise<void> {
  const nowMs = Date.now();

  for (let i = 0; i < emails.length; i += BULK_CHUNK_SIZE) {
    const chunk = emails.slice(i, i + BULK_CHUNK_SIZE);
    const jobs = chunk.map((email) => {
      const delay = Math.max(0, email.scheduledAt.getTime() - nowMs);
      return {
        name: 'send-email',
        data: { emailId: email.id },
        opts: {
          jobId: email.id, // idempotency: BullMQ rejects duplicates
          delay,
        },
      };
    });

    await emailSendQueue.addBulk(jobs);
    log.info({ count: chunk.length, offset: i }, 'Enqueued send job chunk');
  }
}

/**
 * Enqueues an index-sync job for the given email (best effort).
 */
export async function enqueueIndexSync(emailId: string): Promise<void> {
  try {
    await indexSyncQueue.add('index-sync', { emailId }, { jobId: `sync:${emailId}` });
  } catch (err) {
    // Best effort — never block sending on Elasticsearch
    log.warn({ err, emailId }, 'Failed to enqueue index-sync job');
  }
}

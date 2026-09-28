import { Worker } from 'bullmq';
import { bullRedis } from '../lib/redis.js';
import { env } from '../config/env.js';
import { createChildLogger } from '../lib/logger.js';
import { sendEmailProcessor, onSendEmailFailed } from './sendEmail.processor.js';
import { indexSyncProcessor } from './indexSync.processor.js';

const log = createChildLogger('worker');

let sendWorker: Worker | null = null;
let syncWorker: Worker | null = null;

export function startWorkers(): void {
  sendWorker = new Worker('email-send', sendEmailProcessor, {
    connection: bullRedis,
    concurrency: env.WORKER_CONCURRENCY,
  });

  sendWorker.on('completed', (job) => {
    log.info({ jobId: job.id, emailId: job.data.emailId }, 'Send job completed');
  });

  sendWorker.on('failed', async (job, err) => {
    if (!job) return;
    log.error({ jobId: job.id, err: err.message }, 'Send job failed');
    // Handle final failure (all retries exhausted)
    if ((job.attemptsMade ?? 0) >= (job.opts.attempts ?? 3)) {
      await onSendEmailFailed(job, err);
    }
  });

  syncWorker = new Worker('index-sync', indexSyncProcessor, {
    connection: bullRedis,
    concurrency: 10,
  });

  syncWorker.on('failed', (job, err) => {
    log.warn({ jobId: job?.id, err: err.message }, 'Index sync job failed');
  });

  log.info(
    { concurrency: env.WORKER_CONCURRENCY },
    'Workers started (email-send + index-sync)',
  );
}

export async function stopWorkers(): Promise<void> {
  if (sendWorker) await sendWorker.close();
  if (syncWorker) await syncWorker.close();
  log.info('Workers stopped');
}

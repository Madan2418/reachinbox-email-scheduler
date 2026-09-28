import { Queue } from 'bullmq';
import { bullRedis } from '../lib/redis.js';

export interface SendEmailJobData {
  emailId: string;
}

export interface IndexSyncJobData {
  emailId: string;
}

export const emailSendQueue = new Queue<SendEmailJobData>('email-send', {
  connection: bullRedis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { age: 86400 },
    removeOnFail: false,
  },
});

export const indexSyncQueue = new Queue<IndexSyncJobData>('index-sync', {
  connection: bullRedis,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { age: 3600 },
    removeOnFail: { age: 86400 },
  },
});

export async function closeQueues(): Promise<void> {
  await emailSendQueue.close();
  await indexSyncQueue.close();
}

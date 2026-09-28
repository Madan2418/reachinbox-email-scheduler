import { Redis } from 'ioredis';
import { env } from '../config/env.js';
import { createChildLogger } from './logger.js';

const log = createChildLogger('redis');

function createRedisClient(name: string): Redis {
  const client = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null, // required by BullMQ
    enableReadyCheck: false,
    lazyConnect: true,
  });

  client.on('connect', () => log.info({ client: name }, 'Redis connected'));
  client.on('error', (err: Error) => log.error({ client: name, err }, 'Redis error'));
  client.on('close', () => log.warn({ client: name }, 'Redis connection closed'));

  return client;
}

// Main client for general use
export const redis = createRedisClient('main');

// Separate client for BullMQ (it blocks the connection)
export const bullRedis = createRedisClient('bullmq');

export async function checkRedisConnection(): Promise<boolean> {
  try {
    await redis.connect();
    await redis.ping();
    return true;
  } catch {
    return false;
  }
}

export async function closeRedis(): Promise<void> {
  await redis.quit();
  await bullRedis.quit();
}

import 'dotenv/config';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { redis, closeRedis } from './lib/redis.js';
import { closeDb } from './db/client.js';
import { closeQueues } from './queue/queues.js';
import { startWorkers, stopWorkers } from './workers/index.js';
import { reconcileQueue } from './queue/reconcile.js';
import { ensureIndex } from './integrations/elastic.js';

async function main() {
  logger.info({ mode: env.START_MODE, port: env.PORT }, 'Starting server');

  // Ensure Elasticsearch index exists
  try {
    await ensureIndex();
  } catch (err) {
    logger.warn({ err }, 'Elasticsearch unavailable on boot, continuing');
  }

  // Run reconciliation on boot
  try {
    await reconcileQueue();
  } catch (err) {
    logger.warn({ err }, 'Reconciliation failed on boot, continuing');
  }

  // Start workers if needed
  if (env.START_MODE === 'worker' || env.START_MODE === 'all') {
    startWorkers();
  }

  // Start API server if needed
  if (env.START_MODE === 'api' || env.START_MODE === 'all') {
    const app = createApp();
    const server = app.listen(env.PORT, () => {
      logger.info({ port: env.PORT }, `API server listening`);
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info({ signal }, 'Shutdown signal received');
      server.close(async () => {
        await stopWorkers();
        await closeQueues();
        await closeRedis();
        await closeDb();
        logger.info('Graceful shutdown complete');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => void shutdown('SIGTERM'));
    process.on('SIGINT', () => void shutdown('SIGINT'));
  }
}

main().catch((err) => {
  logger.error({ err }, 'Fatal error on startup');
  process.exit(1);
});

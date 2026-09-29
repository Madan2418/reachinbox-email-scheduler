import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter.js';
import { ExpressAdapter } from '@bull-board/express';
import { env } from './config/env.js';
import { errorMiddleware } from './middleware/error.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { campaignsRouter } from './modules/campaigns/campaigns.routes.js';
import { emailsRouter } from './modules/emails/emails.routes.js';
import { sendersRouter } from './modules/senders/senders.routes.js';
import { slackRouter } from './modules/slack/slack.routes.js';
import { emailSendQueue, indexSyncQueue } from './queue/queues.js';
import { checkDbConnection } from './db/client.js';
import { checkRedisConnection } from './lib/redis.js';
import { checkElasticConnection } from './integrations/elastic.js';

export function createApp() {
  const app = express();

  // Security
  app.use(helmet());
  app.use(
    cors({
      origin: env.FRONTEND_URL,
      credentials: true,
    }),
  );

  // Parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(cookieParser());

  // Root route
  app.get('/', (_req, res) => {
    if (env.FRONTEND_URL && env.FRONTEND_URL.startsWith('http')) {
      res.redirect(env.FRONTEND_URL);
    } else {
      res.json({ service: 'reachinbox-backend', status: 'running', health: '/health' });
    }
  });

  // Health check (no auth)
  app.get('/health', async (_req, res) => {
    const [db, redis, es] = await Promise.all([
      checkDbConnection(),
      checkRedisConnection(),
      checkElasticConnection(),
    ]);
    const ok = db && redis && es;
    res.status(ok ? 200 : 503).json({ status: ok ? 'ok' : 'degraded', db, redis, es });
  });

  // Bull Board with basic auth
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');

  createBullBoard({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    queues: [
      new BullMQAdapter(emailSendQueue) as any,
      new BullMQAdapter(indexSyncQueue) as any,
    ],
    serverAdapter,
  });

  app.use(
    '/admin/queues',
    (req, res, next) => {
      const authHeader = req.headers['authorization'] ?? '';
      const expected = `Basic ${Buffer.from(`${env.ADMIN_USER}:${env.ADMIN_PASS}`).toString('base64')}`;
      if (authHeader !== expected) {
        res.setHeader('WWW-Authenticate', 'Basic realm="Bull Board"');
        res.status(401).send('Unauthorized');
        return;
      }
      next();
    },
    serverAdapter.getRouter(),
  );

  // API routes
  app.use('/api/auth', authRouter);
  app.use('/api/campaigns', campaignsRouter);
  app.use('/api/emails', emailsRouter);
  app.use('/api/senders', sendersRouter);
  app.use('/api/slack', slackRouter);

  // Error handler (must be last)
  app.use(errorMiddleware);

  return app;
}

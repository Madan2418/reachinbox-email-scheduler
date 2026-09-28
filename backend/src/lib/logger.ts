import pino from 'pino';
import { env } from '../config/env.js';

const isDev = env.NODE_ENV === 'development';

export const logger = pino(
  isDev
    ? {
        level: 'info',
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:standard' },
        },
      }
    : { level: env.NODE_ENV === 'test' ? 'silent' : 'info' },
);

export function createChildLogger(name: string) {
  return logger.child({ module: name });
}

import { pgTable, uuid, text, integer, timestamp, unique, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  googleId: text('google_id').notNull().unique(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const senders = pgTable('senders', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  label: text('label').notNull(),
  fromEmail: text('from_email').notNull(),
  smtpHost: text('smtp_host').notNull(),
  smtpPort: integer('smtp_port').notNull(),
  smtpUser: text('smtp_user').notNull(),
  smtpPassEnc: text('smtp_pass_enc').notNull(), // AES-256-GCM encrypted
  hourlyLimit: integer('hourly_limit'), // optional per-sender override
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const campaigns = pgTable('campaigns', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  subject: text('subject').notNull(),
  body: text('body').notNull(),
  startAt: timestamp('start_at', { withTimezone: true }).notNull(),
  delayMs: integer('delay_ms').notNull(),
  hourlyLimit: integer('hourly_limit').notNull(),
  totalCount: integer('total_count').notNull(),
  status: text('status').notNull().default('active'), // active | paused | complete
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const emails = pgTable(
  'emails',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    senderId: uuid('sender_id')
      .notNull()
      .references(() => senders.id),
    seq: integer('seq').notNull(), // order within campaign
    toEmail: text('to_email').notNull(),
    subject: text('subject').notNull(),
    body: text('body').notNull(),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
    originalScheduledAt: timestamp('original_scheduled_at', { withTimezone: true }).notNull(),
    status: text('status').notNull().default('scheduled'),
    attempts: integer('attempts').notNull().default(0),
    messageId: text('message_id'),
    previewUrl: text('preview_url'),
    error: text('error'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqueEmailPerCampaign: unique().on(t.campaignId, t.toEmail),
    statusCheck: check(
      'emails_status_check',
      sql`${t.status} IN ('scheduled', 'processing', 'sent', 'failed')`,
    ),
  }),
);

export const slackConnections = pgTable('slack_connections', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' })
    .unique(),
  teamName: text('team_name').notNull(),
  channel: text('channel').notNull(),
  webhookUrlEnc: text('webhook_url_enc').notNull(), // AES-256-GCM encrypted
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Sender = typeof senders.$inferSelect;
export type NewSender = typeof senders.$inferInsert;
export type Campaign = typeof campaigns.$inferSelect;
export type NewCampaign = typeof campaigns.$inferInsert;
export type Email = typeof emails.$inferSelect;
export type NewEmail = typeof emails.$inferInsert;
export type SlackConnection = typeof slackConnections.$inferSelect;
export type NewSlackConnection = typeof slackConnections.$inferInsert;

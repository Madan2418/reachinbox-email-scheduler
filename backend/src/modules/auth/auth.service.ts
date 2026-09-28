import { db } from '../../db/client.js';
import { users, senders } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import type { GoogleUserInfo } from '../../integrations/google.js';
import { createEtherealAccount } from '../../integrations/smtp.js';
import { encrypt } from '../../lib/crypto.js';
import { createChildLogger } from '../../lib/logger.js';

const log = createChildLogger('auth.service');

const SENDERS_PER_USER = 3;

export async function upsertUser(googleUser: GoogleUserInfo) {
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.googleId, googleUser.googleId))
    .limit(1);

  if (existing.length > 0 && existing[0]) {
    // Update name/avatar in case they changed
    const [updated] = await db
      .update(users)
      .set({ name: googleUser.name, avatarUrl: googleUser.avatarUrl })
      .where(eq(users.googleId, googleUser.googleId))
      .returning();
    return updated!;
  }

  const [newUser] = await db
    .insert(users)
    .values({
      googleId: googleUser.googleId,
      email: googleUser.email,
      name: googleUser.name,
      avatarUrl: googleUser.avatarUrl,
    })
    .returning();

  log.info({ userId: newUser!.id }, 'New user created');
  return newUser!;
}

/**
 * Creates SENDERS_PER_USER Ethereal accounts for a user on first login.
 * Idempotent: skips if senders already exist.
 */
export async function seedSendersForUser(userId: string): Promise<void> {
  const existing = await db.select().from(senders).where(eq(senders.userId, userId));

  if (existing.length >= SENDERS_PER_USER) return;

  const toCreate = SENDERS_PER_USER - existing.length;
  log.info({ userId, toCreate }, 'Seeding Ethereal senders');

  const newSenders = await Promise.all(
    Array.from({ length: toCreate }, (_, i) =>
      createEtherealAccount().then((account) => ({
        userId,
        label: `Sender ${existing.length + i + 1}`,
        fromEmail: account.email,
        smtpHost: account.host,
        smtpPort: account.port,
        smtpUser: account.user,
        smtpPassEnc: encrypt(account.pass),
      })),
    ),
  );

  await db.insert(senders).values(newSenders);
  log.info({ userId, count: newSenders.length }, 'Ethereal senders seeded');
}

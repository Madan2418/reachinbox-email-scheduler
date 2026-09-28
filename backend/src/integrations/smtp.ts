import nodemailer, { type Transporter } from 'nodemailer';
import type { Sender } from '../db/schema.js';
import { decrypt } from '../lib/crypto.js';
import { createChildLogger } from '../lib/logger.js';

const log = createChildLogger('smtp');

export interface SendResult {
  messageId: string;
  previewUrl: string | null;
}

/**
 * Creates a Nodemailer transporter from a decrypted Sender.
 */
export function createTransporter(sender: Sender): Transporter {
  const pass = decrypt(sender.smtpPassEnc);
  return nodemailer.createTransport({
    host: sender.smtpHost,
    port: sender.smtpPort,
    secure: sender.smtpPort === 465,
    auth: {
      user: sender.smtpUser,
      pass,
    },
  });
}

/**
 * Sends an email through the given sender's Ethereal account.
 */
export async function sendEmail(
  sender: Sender,
  to: string,
  subject: string,
  body: string,
): Promise<SendResult> {
  const transporter = createTransporter(sender);
  const info = await transporter.sendMail({
    from: `"${sender.label}" <${sender.fromEmail}>`,
    to,
    subject,
    text: body,
    html: body.replace(/\n/g, '<br>'),
  });

  log.info({ messageId: info.messageId, to, sender: sender.fromEmail }, 'Email sent');

  const previewUrl = nodemailer.getTestMessageUrl(info);
  return {
    messageId: info.messageId as string,
    previewUrl: typeof previewUrl === 'string' ? previewUrl : null,
  };
}

/**
 * Creates a new Ethereal test account.
 */
export async function createEtherealAccount(): Promise<{
  email: string;
  pass: string;
  host: string;
  port: number;
  user: string;
}> {
  const account = await nodemailer.createTestAccount();
  log.info({ user: account.user }, 'Ethereal account created');
  return {
    email: account.web,
    pass: account.pass,
    host: account.smtp.host,
    port: account.smtp.port,
    user: account.user,
  };
}

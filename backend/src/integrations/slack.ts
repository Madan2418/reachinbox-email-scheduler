import { createChildLogger } from '../lib/logger.js';

const log = createChildLogger('slack');

/**
 * Posts a message to a Slack incoming webhook URL.
 * Never throws — Slack alerts are best-effort.
 */
export async function postSlackMessage(
  webhookUrl: string,
  text: string,
): Promise<void> {
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      log.warn({ status: res.status }, 'Slack webhook returned non-200');
    }
  } catch (err) {
    log.error({ err }, 'Failed to post Slack message');
  }
}

/**
 * Exchanges a Slack OAuth code for a webhook URL and channel info.
 */
export async function exchangeSlackCode(code: string, redirectUri: string): Promise<{
  webhookUrl: string;
  channel: string;
  teamName: string;
}> {
  const clientId = process.env['SLACK_CLIENT_ID'] ?? '';
  const clientSecret = process.env['SLACK_CLIENT_SECRET'] ?? '';

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
  });

  const res = await fetch(`https://slack.com/api/oauth.v2.access?${params.toString()}`);
  if (!res.ok) throw new Error('Slack OAuth request failed');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (await res.json()) as any;
  if (!data.ok) throw new Error(`Slack OAuth error: ${data.error as string}`);

  return {
    webhookUrl: data.incoming_webhook.url as string,
    channel: data.incoming_webhook.channel as string,
    teamName: data.team.name as string,
  };
}

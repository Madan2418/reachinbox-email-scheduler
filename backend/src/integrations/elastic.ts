import { Client } from '@elastic/elasticsearch';
import { env } from '../config/env.js';
import { createChildLogger } from '../lib/logger.js';

const log = createChildLogger('elastic');

export const esClient = new Client({
  node: env.ELASTICSEARCH_URL,
  ...(env.ELASTICSEARCH_API_KEY
    ? { auth: { apiKey: env.ELASTICSEARCH_API_KEY } }
    : {}),
});

export const EMAIL_INDEX = 'reachinbox_emails';

export interface EmailDocument {
  id: string;
  userId: string;
  campaignId: string;
  to: string;
  subject: string;
  body: string;
  status: string;
  scheduledAt: string;
  sentAt: string | null;
}

/**
 * Ensures the emails index exists with proper mappings.
 */
export async function ensureIndex(): Promise<void> {
  const exists = await esClient.indices.exists({ index: EMAIL_INDEX });
  if (exists) return;

  await esClient.indices.create({
    index: EMAIL_INDEX,
    mappings: {
      properties: {
        id: { type: 'keyword' },
        userId: { type: 'keyword' },
        campaignId: { type: 'keyword' },
        to: { type: 'keyword' },
        subject: { type: 'text' },
        body: { type: 'text' },
        status: { type: 'keyword' },
        scheduledAt: { type: 'date' },
        sentAt: { type: 'date' },
      },
    },
  });

  log.info({ index: EMAIL_INDEX }, 'Elasticsearch index created');
}

/**
 * Indexes or updates an email document.
 */
export async function indexEmail(doc: EmailDocument): Promise<void> {
  await esClient.index({
    index: EMAIL_INDEX,
    id: doc.id,
    document: doc,
  });
}

/**
 * Searches emails for a user. Filters by userId always.
 */
export async function searchEmails(
  userId: string,
  q: string,
  status?: string,
  page = 1,
  pageSize = 20,
): Promise<{ hits: EmailDocument[]; total: number }> {
  const from = (page - 1) * pageSize;

  const must: object[] = [{ term: { userId } }];
  if (q) {
    must.push({ multi_match: { query: q, fields: ['subject', 'body', 'to'] } });
  }
  if (status) {
    must.push({ term: { status } });
  }

  const result = await esClient.search<EmailDocument>({
    index: EMAIL_INDEX,
    from,
    size: pageSize,
    query: { bool: { must } },
    sort: [{ scheduledAt: { order: 'desc' } }],
  });

  const hits = result.hits.hits
    .map((h) => h._source)
    .filter((s): s is EmailDocument => s !== undefined);

  const total =
    typeof result.hits.total === 'number'
      ? result.hits.total
      : (result.hits.total?.value ?? 0);

  return { hits, total };
}

export async function checkElasticConnection(): Promise<boolean> {
  try {
    await esClient.ping();
    return true;
  } catch {
    return false;
  }
}

import type {
  User,
  PaginatedEmails,
  SearchResult,
  Sender,
  SenderLimit,
  CreateCampaignPayload,
  CreateCampaignResponse,
  SlackStatus,
} from './types';

const BASE = import.meta.env.VITE_API_URL
  ? `${(import.meta.env.VITE_API_URL as string).replace(/\/+$/, '')}/api`
  : '/api';

class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
    ...init,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as {
      error?: { code?: string; message?: string };
    };
    throw new ApiError(
      body.error?.code ?? 'UNKNOWN',
      body.error?.message ?? res.statusText,
      res.status,
    );
  }

  return res.json() as Promise<T>;
}

// ── Auth ────────────────────────────────────────────────────────────────────

export const api = {
  auth: {
    me: () => request<{ user: User }>('/auth/me'),
    logout: () => request<{ ok: boolean }>('/auth/logout', { method: 'POST' }),
    googleUrl: () => `${BASE}/auth/google`,
  },

  // ── Campaigns ─────────────────────────────────────────────────────────────
  campaigns: {
    create: (payload: CreateCampaignPayload) =>
      request<CreateCampaignResponse>('/campaigns', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  },

  // ── Emails ────────────────────────────────────────────────────────────────
  emails: {
    list: (status: 'scheduled' | 'sent', page = 1, pageSize = 20) =>
      request<PaginatedEmails>(`/emails?status=${status}&page=${page}&pageSize=${pageSize}`),
    search: (q: string, status?: string, page = 1) =>
      request<SearchResult>(
        `/emails/search?q=${encodeURIComponent(q)}${status ? `&status=${status}` : ''}&page=${page}`,
      ),
  },

  // ── Senders ───────────────────────────────────────────────────────────────
  senders: {
    list: () => request<{ senders: Sender[] }>('/senders'),
    limits: () => request<{ limits: SenderLimit[] }>('/senders/limits'),
  },

  // ── Slack ─────────────────────────────────────────────────────────────────
  slack: {
    status: () => request<SlackStatus>('/slack/status'),
    connectUrl: () => `${BASE}/slack/connect`,
    disconnect: () => request<{ ok: boolean }>('/slack/disconnect', { method: 'POST' }),
  },
};

export { ApiError };

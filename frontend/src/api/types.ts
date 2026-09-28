export interface User {
  userId: string;
  email: string;
  name: string;
  avatarUrl?: string;
}

export interface Sender {
  id: string;
  label: string;
  fromEmail: string;
  hourlyLimit: number | null;
}

export interface SenderLimit {
  senderId: string;
  label: string;
  fromEmail: string;
  used: number;
  limit: number;
  resetsAt: string;
}

export type EmailStatus = 'scheduled' | 'processing' | 'sent' | 'failed';

export interface Email {
  id: string;
  campaignId: string;
  userId: string;
  senderId: string;
  seq: number;
  toEmail: string;
  subject: string;
  body: string;
  scheduledAt: string;
  originalScheduledAt: string;
  status: EmailStatus;
  attempts: number;
  messageId: string | null;
  previewUrl: string | null;
  error: string | null;
  sentAt: string | null;
  createdAt: string;
}

export interface Campaign {
  id: string;
  userId: string;
  subject: string;
  body: string;
  startAt: string;
  delayMs: number;
  hourlyLimit: number;
  totalCount: number;
  status: string;
  createdAt: string;
}

export interface CreateCampaignPayload {
  subject: string;
  body: string;
  startAt: string;
  delayMs: number;
  hourlyLimit: number;
  leads: Array<{ email: string; name?: string }>;
}

export interface CreateCampaignResponse {
  campaignId: string;
  totalScheduled: number;
  skipped: number;
}

export interface SlackStatus {
  connected: boolean;
  teamName?: string;
  channel?: string;
}

export interface PaginatedEmails {
  emails: Email[];
  page: number;
  pageSize: number;
}

export interface SearchResult {
  results: Array<{
    id: string;
    to: string;
    subject: string;
    status: string;
    scheduledAt: string;
    sentAt: string | null;
  }>;
  total: number;
  page: number;
}

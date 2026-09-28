import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';
import type { CreateCampaignPayload } from '../types';

// ── Auth ───────────────────────────────────────────────────────────────────

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: () => api.auth.me(),
    retry: false,
    staleTime: 60_000,
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.auth.logout(),
    onSuccess: () => {
      qc.clear();
      window.location.href = '/login';
    },
  });
}

// ── Emails ─────────────────────────────────────────────────────────────────

export function useScheduledEmails(page = 1) {
  return useQuery({
    queryKey: ['emails', 'scheduled', page],
    queryFn: () => api.emails.list('scheduled', page),
    refetchInterval: 10_000, // live polling
  });
}

export function useSentEmails(page = 1) {
  return useQuery({
    queryKey: ['emails', 'sent', page],
    queryFn: () => api.emails.list('sent', page),
    refetchInterval: 10_000,
  });
}

export function useEmailSearch(q: string, status?: string, page = 1) {
  return useQuery({
    queryKey: ['emails', 'search', q, status, page],
    queryFn: () => api.emails.search(q, status, page),
    enabled: q.length > 0,
  });
}

// ── Campaigns ──────────────────────────────────────────────────────────────

export function useCreateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateCampaignPayload) => api.campaigns.create(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['emails'] });
    },
  });
}

// ── Senders ────────────────────────────────────────────────────────────────

export function useSenders() {
  return useQuery({
    queryKey: ['senders'],
    queryFn: () => api.senders.list(),
    staleTime: 30_000,
  });
}

export function useSenderLimits() {
  return useQuery({
    queryKey: ['senders', 'limits'],
    queryFn: () => api.senders.limits(),
    refetchInterval: 10_000,
  });
}

// ── Slack ──────────────────────────────────────────────────────────────────

export function useSlackStatus() {
  return useQuery({
    queryKey: ['slack', 'status'],
    queryFn: () => api.slack.status(),
    staleTime: 30_000,
  });
}

export function useSlackDisconnect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.slack.disconnect(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['slack'] });
    },
  });
}

type BadgeVariant = 'scheduled' | 'processing' | 'sent' | 'failed' | 'default';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
}

const badgeMap: Record<BadgeVariant, { label: string; className: string }> = {
  scheduled: { label: 'Scheduled', className: 'badge-scheduled' },
  processing: { label: 'Processing', className: 'badge-processing' },
  sent: { label: 'Sent', className: 'badge-sent' },
  failed: { label: 'Failed', className: 'badge-failed' },
  default: { label: '', className: 'badge-default' },
};

export function Badge({ variant = 'default', children }: BadgeProps) {
  const { className } = badgeMap[variant];
  return <span className={`badge ${className}`}>{children}</span>;
}

export function StatusBadge({ status }: { status: string }) {
  const variant = (status as BadgeVariant) in badgeMap ? (status as BadgeVariant) : 'default';
  return <Badge variant={variant}>{status}</Badge>;
}

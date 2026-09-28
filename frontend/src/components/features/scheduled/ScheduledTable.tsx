import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useScheduledEmails } from '../../../api/hooks';
import { StatusBadge } from '../../ui/Badge';
import { TableSkeleton } from '../../ui/Skeleton';
import { EmptyState } from '../../ui/EmptyState';
import { formatDateTime } from '../../../lib/format';

export function ScheduledTable() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, refetch } = useScheduledEmails(page);

  if (isLoading) return <TableSkeleton rows={8} cols={4} />;

  if (isError) {
    return (
      <div className="table-error">
        <p>Failed to load emails.</p>
        <button onClick={() => refetch()} className="link-btn">Try again</button>
      </div>
    );
  }

  if (!data?.emails.length) {
    return (
      <EmptyState
        title="No emails scheduled yet"
        description="Compose an email campaign to get started."
      />
    );
  }

  return (
    <div className="table-container">
      <table className="data-table" aria-label="Scheduled emails">
        <thead>
          <tr>
            <th>To</th>
            <th>Subject</th>
            <th>Scheduled for</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <AnimatePresence initial={false}>
            {data.emails.map((email, i) => (
              <motion.tr
                key={email.id}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ delay: i * 0.02, duration: 0.25 }}
              >
                <td className="truncate" style={{ maxWidth: 200 }}>{email.toEmail}</td>
                <td className="truncate" style={{ maxWidth: 280 }}>{email.subject}</td>
                <td className="tabular-nums">{formatDateTime(email.scheduledAt)}</td>
                <td><StatusBadge status={email.status} /></td>
              </motion.tr>
            ))}
          </AnimatePresence>
        </tbody>
      </table>

      <div className="table-pagination">
        <button
          className="pagination-btn"
          disabled={page === 1}
          onClick={() => setPage((p) => p - 1)}
        >
          ← Previous
        </button>
        <span className="pagination-page">Page {page}</span>
        <button
          className="pagination-btn"
          disabled={data.emails.length < data.pageSize}
          onClick={() => setPage((p) => p + 1)}
        >
          Next →
        </button>
      </div>
    </div>
  );
}

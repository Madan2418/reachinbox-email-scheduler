import { motion } from 'framer-motion';
import { useSenderLimits } from '../../../api/hooks';
import { Skeleton } from '../../ui/Skeleton';
import { formatDistanceToNow } from '../../../lib/format';

export function SenderLimitsPanel() {
  const { data, isLoading } = useSenderLimits();

  return (
    <div className="limits-panel">
      <h3 className="limits-title">Sender limits</h3>

      {isLoading ? (
        <div className="limits-list">
          {[1, 2, 3].map((i) => (
            <div key={i} className="limit-card">
              <Skeleton style={{ width: '60%', height: 14, marginBottom: 8 }} />
              <Skeleton style={{ width: '100%', height: 8 }} />
            </div>
          ))}
        </div>
      ) : (
        <div className="limits-list">
          {data?.limits.map((sender) => {
            const pct = Math.min((sender.used / sender.limit) * 100, 100);
            const isWarning = pct >= 80;
            const isError = pct >= 100;

            return (
              <motion.div
                key={sender.senderId}
                className={`limit-card ${isError ? 'limit-err' : isWarning ? 'limit-warn' : ''}`}
                whileHover={{ scale: 1.02, rotateY: 2 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              >
                <div className="limit-header">
                  <span className="limit-email truncate">{sender.fromEmail}</span>
                  <span className="limit-count tabular-nums">
                    {sender.used}/{sender.limit}
                  </span>
                </div>

                <div className="limit-bar-track">
                  <motion.div
                    className={`limit-bar-fill ${isError ? 'limit-bar-err' : isWarning ? 'limit-bar-warn' : ''}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                  />
                </div>

                <div className="limit-resets">
                  Resets {formatDistanceToNow(sender.resetsAt)}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

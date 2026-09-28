import { motion } from 'framer-motion';
import { useMe, useLogout, useSlackStatus } from '../../api/hooks';
import { api } from '../../api/client';

export function Header() {
  const { data } = useMe();
  const logout = useLogout();
  const { data: slack } = useSlackStatus();
  const user = data?.user;

  return (
    <motion.header
      className="header"
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="header-brand">
        <div className="header-logo">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <rect x="2" y="5" width="20" height="14" rx="3" fill="var(--accent)" opacity="0.15"/>
            <rect x="2" y="5" width="20" height="14" rx="3" stroke="var(--accent)" strokeWidth="1.5"/>
            <path d="M2 9L12 15L22 9" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
        <span className="header-brand-name">ReachInbox</span>
      </div>

      <div className="header-actions">
        {/* Bull Board link */}
        <a
          href="/admin/queues"
          target="_blank"
          rel="noopener noreferrer"
          className="header-action-btn"
          title="Bull Board"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="1" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
            <rect x="9" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
            <rect x="1" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
            <rect x="9" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
          <span>Bull Board</span>
        </a>

        {/* Slack status */}
        {slack?.connected ? (
          <div className="header-slack-badge connected">
            <span className="slack-dot" />
            Slack connected
          </div>
        ) : (
          <a href={api.slack.connectUrl()} className="header-action-btn">
            Connect Slack
          </a>
        )}

        {/* User avatar */}
        {user && (
          <div className="header-user">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.name} className="user-avatar" />
            ) : (
              <div className="user-avatar-fallback">{user.name[0]?.toUpperCase()}</div>
            )}
            <div className="user-info">
              <span className="user-name">{user.name}</span>
              <span className="user-email">{user.email}</span>
            </div>
            <button
              className="header-action-btn"
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </motion.header>
  );
}

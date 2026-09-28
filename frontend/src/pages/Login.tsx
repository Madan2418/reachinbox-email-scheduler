import { Suspense, lazy } from 'react';
import { motion } from 'framer-motion';
import { api } from '../api/client';

const EnvelopeScene = lazy(() =>
  import('../components/three/EnvelopeScene').then((m) => ({ default: m.EnvelopeScene })),
);

const SceneFallback = () => (
  <div className="login-hero-fallback">
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
      <rect x="10" y="30" width="100" height="68" rx="10" fill="var(--accent-soft)" stroke="var(--line)" strokeWidth="2"/>
      <path d="M10 45L60 75L110 45" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="80" cy="35" r="18" fill="var(--accent)" opacity="0.15"/>
      <circle cx="80" cy="35" r="12" fill="var(--accent)" opacity="0.3"/>
      <circle cx="80" cy="35" r="6" fill="var(--accent)"/>
    </svg>
  </div>
);

export default function LoginPage() {
  return (
    <div className="login-page">
      {/* Left: 3D Hero */}
      <div className="login-hero">
        <Suspense fallback={<SceneFallback />}>
          <EnvelopeScene />
        </Suspense>
      </div>

      {/* Right: Auth card */}
      <div className="login-card-wrap">
        <motion.div
          className="login-card"
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="login-logo">
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
              <rect x="3" y="7" width="30" height="22" rx="5" fill="var(--accent)" opacity="0.15"/>
              <rect x="3" y="7" width="30" height="22" rx="5" stroke="var(--accent)" strokeWidth="2"/>
              <path d="M3 13L18 23L33 13" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>

          <h1 className="login-title">Welcome to ReachInbox</h1>
          <p className="login-subtitle">
            Schedule emails at scale with real-time tracking, rate limiting, and Slack alerts.
          </p>

          <a
            href={api.auth.googleUrl()}
            className="login-google-btn"
            id="google-login-btn"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M18.171 10.188c0-.631-.057-1.237-.162-1.82H10v3.44h4.593a3.93 3.93 0 01-1.704 2.576v2.14h2.76c1.614-1.487 2.522-3.676 2.522-6.336z" fill="#4285F4"/>
              <path d="M10 18.5c2.307 0 4.242-.766 5.656-2.076l-2.76-2.14c-.765.512-1.745.813-2.896.813-2.226 0-4.11-1.503-4.784-3.523H2.36v2.21A8.5 8.5 0 0010 18.5z" fill="#34A853"/>
              <path d="M5.216 11.574a5.106 5.106 0 010-3.148V6.216H2.36a8.5 8.5 0 000 7.568l2.856-2.21z" fill="#FBBC05"/>
              <path d="M10 4.803a4.6 4.6 0 013.252 1.272l2.44-2.44A8.17 8.17 0 0010 1.5 8.5 8.5 0 002.36 6.216l2.856 2.21C5.89 6.306 7.774 4.803 10 4.803z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </a>

          <p className="login-disclaimer">
            By signing in, you agree to our Terms of Service and Privacy Policy.
          </p>

          <div className="login-features">
            {[
              { icon: '📬', text: 'Bulk email scheduling' },
              { icon: '⚡', text: 'Rate limiting & overflow control' },
              { icon: '🔁', text: 'Restart-safe, no duplicates' },
              { icon: '🔔', text: 'Real-time Slack alerts' },
            ].map((f) => (
              <div key={f.text} className="login-feature">
                <span>{f.icon}</span>
                <span>{f.text}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { api } from '../api/client';
import { EnvelopeScene } from '../components/three/EnvelopeScene';

export default function LoginPage() {
  // Reset body/html to white
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevBody = body.style.background;
    const prevHtml = html.style.background;
    html.style.background = '#f5f7ff';
    body.style.background = '#f5f7ff';
    return () => {
      html.style.background = prevHtml;
      body.style.background = prevBody;
    };
  }, []);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      width: '100vw',
      height: '100vh',
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #f0f2ff 0%, #ffffff 50%, #eef0ff 100%)',
    }}>

      {/* SVG flying mail icons — no WebGL needed */}
      <div style={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}>
        <EnvelopeScene mode="light" count={18} />
      </div>

      {/* Subtle inner glow to center focus */}
      <div style={{
        position: 'absolute',
        inset: 0,
        zIndex: 1,
        background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.6) 20%, transparent 75%)',
        pointerEvents: 'none',
      }} />

      {/* Login card */}
      <div style={{ position: 'relative', zIndex: 2, width: '100%', maxWidth: 440, padding: '0 24px' }}>
        <motion.div
          initial={{ opacity: 0, y: 28, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          style={{
            background: '#ffffff',
            border: '1px solid rgba(51,70,255,0.12)',
            borderRadius: 24,
            padding: '40px 36px 36px',
            boxShadow: '0 4px 24px rgba(51,70,255,0.08), 0 24px 64px rgba(0,0,0,0.08)',
          }}
        >
          {/* Logo */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 56, height: 56, borderRadius: 16, margin: '0 auto 20px',
            background: 'rgba(51,70,255,0.08)',
            border: '1.5px solid rgba(51,70,255,0.2)',
            boxShadow: '0 0 20px rgba(51,70,255,0.12)',
          }}>
            <svg width="28" height="28" viewBox="0 0 36 36" fill="none">
              <rect x="3" y="7" width="30" height="22" rx="5" fill="#3346ff" opacity="0.15"/>
              <rect x="3" y="7" width="30" height="22" rx="5" stroke="#3346ff" strokeWidth="2"/>
              <path d="M3 13L18 23L33 13" stroke="#3346ff" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </div>

          <h1 style={{
            fontSize: '1.6rem', fontWeight: 700, color: '#0f1420',
            textAlign: 'center', letterSpacing: '-0.03em',
            margin: '0 0 8px', fontFamily: 'inherit',
          }}>Welcome to ReachInbox</h1>

          <p style={{
            fontSize: '0.875rem', color: '#5b6474',
            textAlign: 'center', lineHeight: 1.6, margin: '0 0 28px',
          }}>
            Schedule emails at scale with real-time tracking, rate limiting, and Slack alerts.
          </p>

          <a
            href={api.auth.googleUrl()}
            id="google-login-btn"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 10, width: '100%', height: 48,
              background: '#ffffff',
              border: '1.5px solid #e6e9ef',
              borderRadius: 12, color: '#0f1420',
              fontSize: '0.875rem', fontWeight: 500,
              textDecoration: 'none', cursor: 'pointer',
              marginBottom: 16,
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
              transition: 'all 0.2s',
              fontFamily: 'inherit',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.borderColor = '#3346ff';
              (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 4px 16px rgba(51,70,255,0.15)';
              (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.borderColor = '#e6e9ef';
              (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)';
              (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(0)';
            }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M18.171 10.188c0-.631-.057-1.237-.162-1.82H10v3.44h4.593a3.93 3.93 0 01-1.704 2.576v2.14h2.76c1.614-1.487 2.522-3.676 2.522-6.336z" fill="#4285F4"/>
              <path d="M10 18.5c2.307 0 4.242-.766 5.656-2.076l-2.76-2.14c-.765.512-1.745.813-2.896.813-2.226 0-4.11-1.503-4.784-3.523H2.36v2.21A8.5 8.5 0 0010 18.5z" fill="#34A853"/>
              <path d="M5.216 11.574a5.106 5.106 0 010-3.148V6.216H2.36a8.5 8.5 0 000 7.568l2.856-2.21z" fill="#FBBC05"/>
              <path d="M10 4.803a4.6 4.6 0 013.252 1.272l2.44-2.44A8.17 8.17 0 0010 1.5 8.5 8.5 0 002.36 6.216l2.856 2.21C5.89 6.306 7.774 4.803 10 4.803z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </a>

          <p style={{
            fontSize: '0.75rem', color: '#8b93a4',
            textAlign: 'center', margin: '0 0 24px',
          }}>
            By signing in, you agree to our Terms of Service and Privacy Policy.
          </p>

          <div style={{
            borderTop: '1px solid #f0f2f7',
            paddingTop: 20, display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            {[
              { icon: '📬', text: 'Bulk email scheduling' },
              { icon: '⚡', text: 'Rate limiting & overflow control' },
              { icon: '🔁', text: 'Restart-safe, no duplicates' },
              { icon: '🔔', text: 'Real-time Slack alerts' },
            ].map((f) => (
              <div key={f.text} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                fontSize: '0.8125rem', color: '#5b6474',
              }}>
                <span style={{ fontSize: '1rem' }}>{f.icon}</span>
                <span>{f.text}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Bottom tag */}
        <p style={{
          textAlign: 'center', marginTop: 20,
          fontSize: '0.75rem', color: '#8b93a4',
        }}>
          ReachInbox — Built for scale
        </p>
      </div>
    </div>
  );
}

interface LogoProps {
  size?: number;
  className?: string;
}

export function ReachInboxLogo({ size = 28, className = '' }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'inline-block', flexShrink: 0 }}
    >
      <defs>
        <linearGradient id="reachLogoBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3B82F6"/>
          <stop offset="50%" stopColor="#2563EB"/>
          <stop offset="100%" stopColor="#1D4ED8"/>
        </linearGradient>
        <linearGradient id="reachLogoAccent" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#93C5FD"/>
          <stop offset="100%" stopColor="#60A5FA"/>
        </linearGradient>
      </defs>

      {/* Rounded Squircle Container */}
      <rect width="36" height="36" rx="9" fill="url(#reachLogoBg)"/>
      <rect x="0.5" y="0.5" width="35" height="35" rx="8.5" stroke="rgba(255,255,255,0.25)" strokeWidth="1"/>

      {/* Modern stylized ascending inbox envelope fold */}
      <path
        d="M9 13.5C9 11.567 10.567 10 12.5 10H23.5C25.433 10 27 11.567 27 13.5V22.5C27 24.433 25.433 26 23.5 26H12.5C10.567 26 9 24.433 9 22.5V13.5Z"
        fill="#1E40AF"
        fillOpacity="0.45"
      />
      <path
        d="M9.5 12L18 18.5L26.5 12"
        stroke="#FFFFFF"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 24.5L18 19.5L24 24.5"
        stroke="url(#reachLogoAccent)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="18" cy="18.5" r="1.75" fill="#FFFFFF"/>
    </svg>
  );
}

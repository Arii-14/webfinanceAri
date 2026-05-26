/** Logo TendouAriisu Finance — monogram TA + kurva keuangan */
export default function BrandLogo({ size = 88, className = '' }) {
  const uid = 'taFinanceLogo';
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient id={`${uid}-g`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a5b4fc" />
          <stop offset="45%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>
        <linearGradient id={`${uid}-shine`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.25)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
      </defs>
      <rect x="6" y="6" width="108" height="108" rx="26" fill="#0a0f1c" stroke={`url(#${uid}-g)`} strokeWidth="2.5" />
      <rect x="6" y="6" width="108" height="54" rx="26" fill={`url(#${uid}-shine)`} opacity="0.5" />
      <text x="60" y="58" textAnchor="middle" fontSize="34" fontWeight="800" fill={`url(#${uid}-g)`} fontFamily="Inter, system-ui, sans-serif">
        TA
      </text>
      <path
        d="M22 82 Q42 68 60 78 T98 82"
        stroke={`url(#${uid}-g)`}
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="98" cy="82" r="5" fill="#10b981" />
      <path d="M28 92h64" stroke="rgba(99,102,241,0.35)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

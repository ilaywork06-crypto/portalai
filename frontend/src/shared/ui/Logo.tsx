export function PortalMark({ size = 30 }: { size?: number }) {
  const id = `kg${size}`;
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true" style={{ flex: "none" }}>
      <defs>
        <linearGradient id={id} x1="6" y1="3" x2="34" y2="38" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F1AF61" />
          <stop offset="0.55" stopColor="#E0954A" />
          <stop offset="1" stopColor="#CB7C31" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="36" height="36" rx="11" fill={`url(#${id})`} />
      <path fill="#fff" d="M19 8.5 Q20.6 19.4 31.5 21 Q20.6 22.6 19 33.5 Q17.4 22.6 6.5 21 Q17.4 19.4 19 8.5 Z" />
      <path fill="#fff" d="M30.5 5.5 Q31 9 34.5 9.5 Q31 10 30.5 13.5 Q30 10 26.5 9.5 Q30 9 30.5 5.5 Z" />
    </svg>
  );
}

export function Logo({ size = 30, onClick }: { size?: number; onClick: () => void }) {
  return (
    <button onClick={onClick} className="row" aria-label="Portal AI" style={{ gap: 6, background: "none", border: 0, padding: 0 }}>
      <PortalMark size={size} />
      <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--ink)", whiteSpace: "nowrap" }}>
        Portal<span style={{ color: "var(--accent)" }}>&nbsp;AI</span>
      </span>
    </button>
  );
}

import { Icon, type IconName } from "./Icon";

const TONES = {
  accent: { bg: "var(--accent-tint)", fg: "var(--accent-ink)", bd: "var(--c-200)" },
  neutral: { bg: "var(--n-50)", fg: "var(--ink-2)", bd: "var(--border)" },
} as const;

interface IconTileProps {
  name: IconName;
  size?: number;
  tone?: keyof typeof TONES;
}

export function IconTile({ name, size = 44, tone = "accent" }: IconTileProps) {
  const t = TONES[tone];
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size / 3.4),
        background: t.bg,
        border: `1px solid ${t.bd}`,
        color: t.fg,
        display: "grid",
        placeItems: "center",
        flex: "none",
      }}
    >
      <Icon name={name} size={Math.round(size * 0.46)} stroke={2} />
    </div>
  );
}

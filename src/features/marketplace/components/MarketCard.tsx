import { Icon, iconOr } from "@/shared/ui/Icon";
import { IconTile } from "@/shared/ui/IconTile";
import { useToggleStar, type ItemCard } from "../api";
import { fmtK, PLUGIN_PARTS, VERIFIED_BY } from "../constants";

const meta = { gap: 4, fontSize: 12, color: "var(--ink-3)" } as const;

export function MarketCard({ item, onOpen }: { item: ItemCard; onOpen: (item: ItemCard) => void }) {
  return (
    <button
      onClick={() => onOpen(item)}
      className="card card-hover"
      style={{ textAlign: "right", padding: 18, display: "flex", flexDirection: "column", gap: 12, background: "var(--surface)", height: "100%" }}
    >
      <div className="row" style={{ justifyContent: "space-between" }}>
        <IconTile name={iconOr(item.icon)} size={40} tone="neutral" />
        <span className="badge badge-mono">{item.type}</span>
      </div>
      <div>
        <div className="row" style={{ gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <span className="t-h4" style={{ fontSize: 15 }}>
            {item.name}
          </span>
          {item.verifiedBy === VERIFIED_BY && (
            <span title="פותח ע״י קרמל">
              <Icon name="checkCircle" size={15} style={{ color: "var(--ok)" }} />
            </span>
          )}
        </div>
        <div className="row" style={{ gap: 10, marginTop: 4, flexWrap: "wrap" }}>
          <span className="row" style={meta}>
            <Icon name="users" size={12} style={{ color: "var(--muted)" }} /> {item.ownerName}
          </span>
          <span className="row" title="התקנות" style={meta}>
            <Icon name="package" size={12} style={{ color: "var(--muted)" }} /> {fmtK(item.installs)}
          </span>
          <span className="row" title="כוכבים" style={meta}>
            <Icon
              name="star"
              size={12}
              style={{ color: item.viewerStarred ? "var(--c-500)" : "var(--muted)", fill: item.viewerStarred ? "var(--c-500)" : "none" }}
            />{" "}
            {fmtK(item.stars)}
          </span>
        </div>
      </div>
      <p className="t-sm" style={{ color: "var(--ink-3)", margin: 0, flex: 1 }}>
        {item.blurb}
      </p>
      {item.type === "Plugin" && item.includes && (
        <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
          {PLUGIN_PARTS.filter(([key]) => item.includes?.[key].length).map(([key, label]) => (
            <span key={key} className="badge" style={{ fontSize: 11 }}>
              {item.includes?.[key].length} {label}
            </span>
          ))}
        </div>
      )}
      <div className="row" style={{ justifyContent: "flex-end", marginTop: "auto" }}>
        <span className="row" style={{ gap: 4, color: "var(--accent)", fontSize: 13, fontWeight: 600 }}>
          פרטים <Icon name="arrowRight" size={14} />
        </span>
      </div>
    </button>
  );
}

export function MarketStarButton({ item }: { item: ItemCard }) {
  const toggle = useToggleStar(item);
  const starred = item.viewerStarred;
  return (
    <div
      className="row"
      style={{ border: "1px solid var(--border-strong)", borderRadius: 8, overflow: "hidden", height: 32, background: "var(--surface)" }}
    >
      <button
        onClick={() => toggle.mutate()}
        className="row"
        title={starred ? "הסרת כוכב" : "סימון בכוכב"}
        aria-pressed={starred}
        style={{
          gap: 6,
          border: 0,
          background: starred ? "var(--c-50)" : "var(--n-25)",
          padding: "0 12px",
          height: "100%",
          fontSize: 13,
          fontWeight: 600,
          color: "var(--ink)",
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        <Icon
          name="star"
          size={15}
          style={{ color: starred ? "var(--c-500)" : "var(--ink-3)", fill: starred ? "var(--c-500)" : "none" }}
        />{" "}
        {starred ? "סימנתם בכוכב" : "כוכב"}
      </button>
      <span
        style={{
          borderInlineStart: "1px solid var(--border-strong)",
          padding: "0 11px",
          fontSize: 13,
          fontWeight: 650,
          fontVariantNumeric: "tabular-nums",
          height: "100%",
          display: "grid",
          placeItems: "center",
        }}
      >
        {fmtK(item.stars)}
      </span>
    </div>
  );
}

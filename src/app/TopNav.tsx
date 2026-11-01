import { useState } from "react";
import { Icon } from "@/shared/ui/Icon";
import { Logo } from "@/shared/ui/Logo";
import { NAV, type Section } from "./nav";

export function TopNav({ active, go }: { active: string; go: (section: Section) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "rgba(255,255,255,0.88)",
        backdropFilter: "saturate(180%) blur(12px)",
        borderBottom: "1px solid var(--border)",
        height: "var(--nav-h)",
      }}
    >
      <div className="wrap row" style={{ height: "100%", gap: 18, maxWidth: 1280 }}>
        <Logo size={24} onClick={() => go("marketplace")} />
        <nav className="row nav-desktop" style={{ gap: 2, marginInlineStart: 8 }}>
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => go(n.id)}
              className="btn btn-ghost btn-sm"
              aria-current={active === n.id ? "page" : undefined}
              style={{
                color: active === n.id ? "var(--ink)" : "var(--ink-3)",
                fontWeight: active === n.id ? 650 : 500,
                background: active === n.id ? "var(--n-100)" : "transparent",
              }}
            >
              {n.label}
            </button>
          ))}
        </nav>
        <div className="grow" />
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--accent)", whiteSpace: "nowrap" }}>אתר חדש בדרך, יש למה לצפות✨</span>
        <button
          className="btn btn-icon btn-ghost nav-burger"
          onClick={() => setOpen(!open)}
          style={{ display: "none" }}
          aria-label={open ? "סגירת התפריט" : "פתיחת התפריט"}
          aria-expanded={open}
        >
          <Icon name={open ? "x" : "list"} size={20} />
        </button>
      </div>
      {open && (
        <div className="nav-mobile-menu" style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)", padding: 12 }}>
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => {
                go(n.id);
                setOpen(false);
              }}
              className="row"
              style={{
                width: "100%",
                gap: 11,
                padding: "11px 12px",
                borderRadius: "var(--r-sm)",
                textAlign: "right",
                background: active === n.id ? "var(--n-100)" : "transparent",
                color: "var(--ink)",
                fontWeight: 550,
                fontSize: 15,
              }}
            >
              <Icon name={n.icon} size={17} style={{ color: "var(--accent)" }} /> {n.label}
            </button>
          ))}
        </div>
      )}
    </header>
  );
}

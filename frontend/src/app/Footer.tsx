import { Logo } from "@/shared/ui/Logo";
import { NAV, type Section } from "./nav";

export function Footer({ go }: { go: (section: Section) => void }) {
  return (
    <footer style={{ borderTop: "1px solid var(--border)", background: "var(--n-25)", marginTop: 40 }}>
      <div className="wrap row" style={{ paddingTop: 28, paddingBottom: 28, maxWidth: 1280, justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
        <div className="row" style={{ gap: 14, flexWrap: "wrap" }}>
          <Logo size={20} onClick={() => go("marketplace")} />
          <span className="t-cap">גרסה 1 · מרקטפלייס, קהילה ונתוני שימוש</span>
        </div>
        <div className="row" style={{ gap: 18 }}>
          {NAV.map((n) => (
            <button key={n.id} onClick={() => go(n.id)} className="t-sm" style={{ background: "none", border: 0, padding: 0, color: "var(--ink-3)" }}>
              {n.label}
            </button>
          ))}
        </div>
      </div>
    </footer>
  );
}

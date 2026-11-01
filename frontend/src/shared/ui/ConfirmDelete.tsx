import { createPortal } from "react-dom";
import { useEscape } from "@/shared/lib/useEscape";
import { Icon } from "./Icon";

interface ConfirmDeleteProps {
  title: string;
  text: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDelete({ title, text, busy = false, onCancel, onConfirm }: ConfirmDeleteProps) {
  useEscape(onCancel);
  return createPortal(
    <div
      onClick={(e) => {
        e.stopPropagation();
        onCancel();
      }}
      style={{ position: "fixed", inset: 0, background: "rgba(40,30,15,0.4)", zIndex: 130, display: "grid", placeItems: "center", padding: 20 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className="card"
        style={{ width: "min(380px,100%)", padding: 24, background: "var(--surface)", boxShadow: "var(--sh-lg)", textAlign: "center" }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            background: "var(--warn-bg)",
            color: "var(--warn)",
            display: "grid",
            placeItems: "center",
            margin: "0 auto 14px",
          }}
        >
          <Icon name="trash" size={22} />
        </div>
        <div className="t-h3" style={{ fontSize: 18, marginBottom: 6 }}>
          {title}
        </div>
        <p className="t-sm" style={{ color: "var(--ink-3)", marginBottom: 18 }}>
          {text}
        </p>
        <div className="row" style={{ gap: 10, justifyContent: "center" }}>
          <button className="btn btn-secondary" onClick={onCancel}>
            ביטול
          </button>
          <button className="btn btn-primary" onClick={onConfirm} disabled={busy} style={{ background: "var(--err)" }}>
            <Icon name="trash" size={15} /> מחיקה
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

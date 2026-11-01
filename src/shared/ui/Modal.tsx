import type { CSSProperties, ReactNode } from "react";
import { createPortal } from "react-dom";
import { useEscape } from "@/shared/lib/useEscape";

interface LayerProps {
  onClose: () => void;
  width: number;
  label: string;
  children: ReactNode;
}

/** Tall modal: the overlay scrolls and the card is centered horizontally. */
export function Modal({ onClose, width, label, cardStyle, children }: LayerProps & { cardStyle?: CSSProperties }) {
  useEscape(onClose);
  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(40,30,15,0.45)",
        zIndex: 110,
        display: "flex",
        justifyContent: "center",
        overflowY: "auto",
        padding: "40px 20px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="card"
        style={{
          width: `min(${width}px,100%)`,
          height: "fit-content",
          padding: 0,
          background: "var(--surface)",
          boxShadow: "var(--sh-lg)",
          overflow: "hidden",
          ...cardStyle,
        }}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

/** Small dialog centered on screen. */
export function Dialog({ onClose, width, label, children }: LayerProps) {
  useEscape(onClose);
  return createPortal(
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(40,30,15,0.4)", zIndex: 120, display: "grid", placeItems: "center", padding: 20 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="card"
        style={{ width: `min(${width}px,100%)`, padding: 22, background: "var(--surface)", boxShadow: "var(--sh-lg)" }}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

import type { CSSProperties } from "react";
import { GENERIC_ERROR } from "@/shared/api/errors";
import { Icon } from "./Icon";

/** Placeholder sized like the card it stands in for. */
export function Skeleton({ height, style }: { height: number; style?: CSSProperties }) {
  return <div className="card skeleton" aria-hidden="true" style={{ height, ...style }} />;
}

export function SkeletonGrid({ count, height, columns }: { count: number; height: number; columns: number }) {
  return (
    <div aria-busy="true" style={{ display: "grid", gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: 16 }}>
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} height={height} />
      ))}
    </div>
  );
}

export function ErrorState({ onRetry, message = GENERIC_ERROR }: { onRetry: () => void; message?: string }) {
  return (
    <div
      role="alert"
      className="row"
      style={{ gap: 12, padding: "14px 16px", borderRadius: "var(--r-md)", background: "var(--err-bg)", color: "var(--err)", justifyContent: "space-between" }}
    >
      <span className="row" style={{ gap: 8, fontWeight: 600, fontSize: 14 }}>
        <Icon name="alert" size={16} /> {message}
      </span>
      <button className="btn btn-secondary btn-sm" onClick={onRetry}>
        נסו שוב
      </button>
    </div>
  );
}

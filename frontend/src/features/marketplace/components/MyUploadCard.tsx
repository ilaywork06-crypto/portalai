import { Icon, iconOr } from "@/shared/ui/Icon";
import { IconTile } from "@/shared/ui/IconTile";
import type { ItemCard } from "../api";
import { TYPE_LABEL } from "../constants";

interface MyUploadCardProps {
  item: ItemCard;
  onOpen: (item: ItemCard) => void;
  onEdit: (item: ItemCard) => void;
  onDelete: (item: ItemCard) => void;
}

export function MyUploadCard({ item, onOpen, onEdit, onDelete }: MyUploadCardProps) {
  return (
    <div className="card" style={{ padding: 18, background: "var(--surface)", display: "flex", flexDirection: "column", gap: 12, height: "100%" }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <IconTile name={iconOr(item.icon)} size={40} tone="neutral" />
        <span className="badge badge-mono">{TYPE_LABEL[item.type]}</span>
      </div>
      <div>
        <div className="t-h4" style={{ fontSize: 15 }}>
          {item.name}
        </div>
        <div className="row" style={{ gap: 6, marginTop: 5 }}>
          <span className="badge badge-ok">
            <Icon name="check" size={11} stroke={3} /> פורסם
          </span>
        </div>
      </div>
      <p className="t-sm" style={{ color: "var(--ink-3)", margin: 0, flex: 1 }}>
        {item.blurb}
      </p>
      <div className="row" style={{ gap: 8, marginTop: "auto" }}>
        <button className="btn btn-secondary btn-sm" onClick={() => onOpen(item)}>
          <Icon name="eye" size={14} /> צפייה
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => onEdit(item)}>
          <Icon name="pencil" size={14} /> עריכה
        </button>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => onDelete(item)}
          style={{ color: "var(--err)", marginInlineStart: "auto" }}
          aria-label="מחיקה"
          title="מחיקה"
        >
          <Icon name="trash" size={14} />
        </button>
      </div>
    </div>
  );
}

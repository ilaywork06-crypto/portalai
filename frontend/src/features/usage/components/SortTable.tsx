import { useMemo, type CSSProperties, type ReactNode } from "react";

export interface Column<R> {
  key: string;
  label: string;
  numeric?: boolean;
  value?: (row: R) => number;
  render: (row: R, index: number) => ReactNode;
}

export type SortState = readonly [key: string, descending: boolean];

interface SortTableProps<R extends { id: string }> {
  columns: Column<R>[];
  rows: R[];
  sort: SortState;
  setSort: (sort: SortState) => void;
  onRow?: (row: R) => void;
  maxHeight?: number;
}

const headerCell: CSSProperties = {
  padding: "10px 12px",
  fontSize: 12,
  fontWeight: 600,
  color: "var(--muted)",
  textAlign: "right",
  whiteSpace: "nowrap",
  borderBottom: "1px solid var(--border)",
  background: "var(--bg-warm)",
  position: "sticky",
  top: 0,
  zIndex: 1,
};

/** Clicking a sortable header sorts by it; clicking again flips the direction. */
export function SortTable<R extends { id: string }>({ columns, rows, sort, setSort, onRow, maxHeight }: SortTableProps<R>) {
  const [sortKey, descending] = sort;
  const sorted = useMemo(() => {
    const value = columns.find((c) => c.key === sortKey)?.value;
    return value ? rows.slice().sort((a, b) => (value(a) - value(b)) * (descending ? -1 : 1)) : rows;
  }, [rows, columns, sortKey, descending]);
  return (
    <div
      style={{
        overflowX: "auto",
        overflowY: maxHeight ? "auto" : undefined,
        maxHeight,
        margin: "0 -24px",
        padding: "0 24px",
        borderBottom: maxHeight ? "1px solid var(--border-soft)" : undefined,
      }}
    >
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5, minWidth: 820 }}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                aria-sort={sortKey === c.key ? (descending ? "descending" : "ascending") : undefined}
                style={{ ...headerCell, cursor: c.value ? "pointer" : "default", textAlign: c.numeric ? "left" : "right", color: sortKey === c.key ? "var(--ink)" : "var(--muted)" }}
                onClick={() => c.value && setSort([c.key, sortKey === c.key ? !descending : true])}
              >
                {c.label}
                {sortKey === c.key && <span style={{ fontSize: 9, marginInlineStart: 4 }}>{descending ? "▼" : "▲"}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr
              key={row.id}
              onClick={() => onRow?.(row)}
              style={{ cursor: onRow ? "pointer" : "default", borderBottom: "1px solid var(--border-soft)" }}
              onMouseOver={(e) => (e.currentTarget.style.background = "var(--n-25)")}
              onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
            >
              {columns.map((c) => (
                <td key={c.key} style={{ padding: "11px 12px", textAlign: c.numeric ? "left" : "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", verticalAlign: "middle" }}>
                  {c.render(row, i)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

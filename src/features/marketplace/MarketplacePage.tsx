import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMe } from "@/features/auth/session";
import { isStatus } from "@/shared/api/errors";
import { useDebouncedValue } from "@/shared/lib/useDebouncedValue";
import { ConfirmDelete } from "@/shared/ui/ConfirmDelete";
import { Icon } from "@/shared/ui/Icon";
import { SearchBar } from "@/shared/ui/SearchBar";
import { ErrorState, SkeletonGrid } from "@/shared/ui/States";
import { useCatalog, useItem, useMyUploads, useRemoveItem, useSaveItem, type Category, type ItemCard, type ItemType, type SortOrder } from "./api";
import { MarketCard } from "./components/MarketCard";
import { MarketDetail } from "./components/MarketDetail";
import { MarketSortMenu } from "./components/MarketSortMenu";
import { MyUploadCard } from "./components/MyUploadCard";
import { UploadModal } from "./components/UploadModal";
import { SORTS, TAG_CAP, TYPE_FILTERS } from "./constants";

type Editing = { id: null } | { id: string };
const grid = { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 } as const;
const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);

export function MarketplacePage() {
  const { itemId = null } = useParams();
  const navigate = useNavigate();
  const me = useMe();
  const [mode, setMode] = useState<"browse" | "mine">("browse");
  const [type, setType] = useState<ItemType | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortOrder>("new");
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [showAllTags, setShowAllTags] = useState(false);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [deleting, setDeleting] = useState<Pick<ItemCard, "id" | "name"> | null>(null);
  const q = useDebouncedValue(query.trim());

  const catalog = useCatalog({ type, categories, tags, q, sort });
  const uploads = useMyUploads(mode === "mine");
  const detail = useItem(itemId);
  const edited = useItem(editing && editing.id !== null ? editing.id : null);
  const save = useSaveItem();
  const remove = useRemoveItem();

  useEffect(() => {
    if (itemId && isStatus(detail.error, 404)) navigate("/marketplace", { replace: true });
  }, [itemId, detail.error, navigate]);

  const openDetail = (item: Pick<ItemCard, "id">) => navigate(`/marketplace/${encodeURIComponent(item.id)}`);
  const closeDetail = () => navigate("/marketplace");
  const facets = catalog.data?.facets;
  const availableCategories = facets?.categories ?? [];
  const availableTags = (facets?.tags ?? []).map(([tag]) => tag);
  const visibleTags = showAllTags ? availableTags : [...new Set([...tags, ...availableTags])].slice(0, Math.max(TAG_CAP, tags.length));
  const hiddenTagCount = availableTags.length - visibleTags.length;
  const mineCount = catalog.data?.mineCount ?? 0;
  const items = catalog.data?.items ?? [];

  const onSave = (input: Parameters<typeof save.mutate>[0]["input"]) =>
    save.mutate({ id: editing?.id ?? null, input }, { onSuccess: () => setEditing(null) });
  const onDelete = () => {
    if (!deleting) return;
    remove.mutate(deleting.id, {
      onSuccess: () => {
        setDeleting(null);
        if (itemId) closeDetail();
      },
    });
  };

  return (
    <>
      <div className="route-fade wrap" style={{ paddingTop: 36, paddingBottom: 80 }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", marginBottom: 22, gap: 16, flexWrap: "wrap" }}>
          <div>
            <span className="t-eyebrow">מרקטפלייס</span>
            <h1 className="t-h1" style={{ marginTop: 10 }}>
              הרחיבו את היכולות של כלי ה-AI שלכם
            </h1>
            <p className="t-body" style={{ fontSize: 16, color: "var(--ink-3)", maxWidth: 620, marginTop: 8 }}>
              גלו Skills שיעזרו ל-AI שלכם לעבוד כמו מומחה, MCPs שיחברו אתכם למערכות השונות, סוכנים שיבצעו עבורכם משימות באופן אוטומטי, ו-Plugins שמאגדים כמה מהם להתקנה אחת.
            </p>
            <p className="t-sm" style={{ color: "var(--accent)", marginTop: 8 }}>
              יצרתם משהו חדש? שתפו כדי שכולם יוכלו להנות ממנו <Icon name="rocket" size={14} style={{ display: "inline", verticalAlign: "-2px" }} />
            </p>
          </div>
          <div className="row" style={{ gap: 10, flex: "none" }}>
            <button
              key={mode === "mine" ? "mine-active" : "mine-inactive"}
              className={mode === "mine" ? "btn btn-primary" : "btn btn-secondary"}
              onClick={() => setMode(mode === "mine" ? "browse" : "mine")}
              aria-pressed={mode === "mine"}
            >
              <Icon name="layers" size={15} /> ההעלאות שלי{mineCount ? ` (${mineCount})` : ""}
            </button>
            <button className="btn btn-primary" onClick={() => setEditing({ id: null })}>
              <Icon name="plus" size={16} /> פרסום
            </button>
          </div>
        </div>

        {mode === "browse" ? (
          <>
            <div style={{ width: "min(560px, 100%)", marginBottom: 14 }}>
              <SearchBar value={query} onChange={setQuery} placeholder="חיפוש לפי שם, תיאור, צוות או תגית…" />
            </div>
            <div className="row" style={{ gap: 10, justifyContent: "space-between", flexWrap: "wrap", marginBottom: 16 }}>
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                {TYPE_FILTERS.map(([label, value]) => (
                  <button
                    key={label}
                    className="chip"
                    data-on={type === value}
                    aria-pressed={type === value}
                    onClick={() => {
                      setType(value);
                      setCategories([]);
                      setTags([]);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <MarketSortMenu value={sort} onChange={setSort} options={SORTS} />
            </div>

            {availableCategories.length > 1 && (
              <div className="row" style={{ gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
                <span className="row t-cap" style={{ gap: 5, fontWeight: 600, color: "var(--ink-3)" }}>
                  <Icon name="layers" size={13} /> קטגוריה
                </span>
                {availableCategories.map((c) => {
                  const on = categories.includes(c);
                  return (
                    <button
                      key={c}
                      onClick={() => setCategories((cur) => toggle(cur, c))}
                      aria-pressed={on}
                      className="row"
                      style={{
                        gap: 5,
                        padding: "4px 11px",
                        borderRadius: "var(--r-full)",
                        fontSize: 12.5,
                        fontWeight: 600,
                        cursor: "pointer",
                        border: `1px solid ${on ? "var(--accent)" : "var(--border)"}`,
                        background: on ? "var(--accent-tint)" : "var(--surface)",
                        color: on ? "var(--accent-ink)" : "var(--ink-3)",
                      }}
                    >
                      {on && <Icon name="check" size={11} stroke={3} />} {c}
                    </button>
                  );
                })}
                {categories.length > 0 && (
                  <button className="btn btn-ghost btn-sm" onClick={() => setCategories([])} style={{ color: "var(--muted)" }}>
                    <Icon name="x" size={13} /> נקה
                  </button>
                )}
              </div>
            )}

            {availableTags.length > 0 && (
              <div className="row" style={{ gap: 8, marginBottom: 22, flexWrap: "wrap", alignItems: "center" }}>
                <span className="row t-cap" style={{ gap: 5, fontWeight: 600, color: "var(--ink-3)" }}>
                  <Icon name="tag" size={13} /> סינון לפי תגית
                </span>
                {visibleTags.map((t) => {
                  const on = tags.includes(t);
                  return (
                    <button
                      key={t}
                      onClick={() => setTags((cur) => toggle(cur, t))}
                      aria-pressed={on}
                      className="row"
                      style={{
                        gap: 4,
                        padding: "3px 9px",
                        borderRadius: "var(--r-full)",
                        fontSize: 11.5,
                        fontWeight: 500,
                        cursor: "pointer",
                        border: `1px solid ${on ? "var(--accent)" : "var(--border-soft)"}`,
                        background: on ? "var(--accent-tint)" : "transparent",
                        color: on ? "var(--accent-ink)" : "var(--muted)",
                      }}
                    >
                      {on ? <Icon name="check" size={10} stroke={3} /> : <span style={{ color: "var(--faint)", fontSize: 10 }}>#</span>} {t}
                    </button>
                  );
                })}
                {!showAllTags && hiddenTagCount > 0 && (
                  <button className="btn btn-ghost btn-sm" onClick={() => setShowAllTags(true)} style={{ color: "var(--accent)" }}>
                    +{hiddenTagCount} נוספות
                  </button>
                )}
                {showAllTags && availableTags.length > TAG_CAP && (
                  <button className="btn btn-ghost btn-sm" onClick={() => setShowAllTags(false)} style={{ color: "var(--muted)" }}>
                    הצג פחות
                  </button>
                )}
                {tags.length > 0 && (
                  <button className="btn btn-ghost btn-sm" onClick={() => setTags([])} style={{ color: "var(--muted)" }}>
                    <Icon name="x" size={13} /> נקה
                  </button>
                )}
              </div>
            )}

            {q && catalog.data && (
              <div className="t-cap" style={{ marginBottom: 14 }}>
                {items.length} {items.length === 1 ? "תוצאה" : "תוצאות"} עבור “{q}”
              </div>
            )}

            {catalog.isPending ? (
              <SkeletonGrid count={9} height={212} columns={3} />
            ) : catalog.isError ? (
              <ErrorState onRetry={() => void catalog.refetch()} />
            ) : (
              <>
                <div className="stagger" style={grid}>
                  {items.map((item) => (
                    <MarketCard key={item.id} item={item} onOpen={openDetail} />
                  ))}
                </div>
                {items.length === 0 && (
                  <div className="card" style={{ padding: 48, textAlign: "center", color: "var(--muted)" }}>
                    <Icon name={q ? "search" : "package"} size={28} style={{ color: "var(--faint)" }} />
                    <p className="t-body" style={{ marginTop: 10 }}>
                      {q ? `שום דבר לא תואם ל“${q}”.` : "אין כאן עדיין כלום. היו הראשונים לשתף."}
                    </p>
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          <>
            <button className="btn btn-ghost btn-sm" onClick={() => setMode("browse")} style={{ marginBottom: 14, paddingRight: 6 }}>
              <Icon name="chevronLeft" size={16} /> חזרה למרקטפלייס
            </button>
            <div className="card" style={{ padding: 16, background: "var(--n-25)", marginBottom: 20 }}>
              <div className="row" style={{ gap: 10 }}>
                <Icon name="layers" size={18} style={{ color: "var(--accent)" }} />
                <p className="t-sm" style={{ color: "var(--ink-2)" }}>
                  כל מה ששיתפתם. ערכו או הסירו בכל עת — השינויים חיים לכולם.
                </p>
              </div>
            </div>
            {uploads.isPending ? (
              <SkeletonGrid count={3} height={200} columns={3} />
            ) : uploads.isError ? (
              <ErrorState onRetry={() => void uploads.refetch()} />
            ) : uploads.data.items.length === 0 ? (
              <div className="card" style={{ padding: 48, textAlign: "center" }}>
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: "var(--r-lg)",
                    background: "var(--accent-tint)",
                    color: "var(--accent)",
                    display: "grid",
                    placeItems: "center",
                    margin: "0 auto 14px",
                  }}
                >
                  <Icon name="plus" size={24} />
                </div>
                <div className="t-h3" style={{ marginBottom: 6 }}>
                  עדיין לא שיתפתם שום דבר
                </div>
                <p className="t-sm" style={{ color: "var(--ink-3)", maxWidth: 380, margin: "0 auto 18px" }}>
                  יש לכם MCP או מיומנות שעובדים טוב? שתפו כדי שגם שאר החברה תוכל להשתמש.
                </p>
                <button className="btn btn-primary btn-lg" onClick={() => setEditing({ id: null })}>
                  <Icon name="plus" size={16} /> פרסום
                </button>
              </div>
            ) : (
              <div className="stagger" style={grid}>
                {uploads.data.items.map((item) => (
                  <MyUploadCard key={item.id} item={item} onOpen={openDetail} onEdit={(it) => setEditing({ id: it.id })} onDelete={setDeleting} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {detail.data && (
        <MarketDetail
          item={detail.data}
          onClose={closeDetail}
          onEdit={(it) => {
            closeDetail();
            setEditing({ id: it.id });
          }}
          onDelete={setDeleting}
        />
      )}
      {editing && (editing.id === null || edited.data) && (
        <UploadModal
          key={editing.id ?? "new"}
          initial={editing.id === null ? null : (edited.data ?? null)}
          defaultPublisher={me.author}
          saving={save.isPending}
          onClose={() => setEditing(null)}
          onSave={onSave}
        />
      )}
      {deleting && (
        <ConfirmDelete
          title={`למחוק את "${deleting.name}"?`}
          text="זה יוסר לכולם. לא ניתן לבטל."
          busy={remove.isPending}
          onCancel={() => setDeleting(null)}
          onConfirm={onDelete}
        />
      )}
    </>
  );
}

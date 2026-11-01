import { useRef, useState, type ChangeEvent, type CSSProperties, type Dispatch, type KeyboardEvent, type SetStateAction } from "react";
import { compressImage } from "@/shared/lib/images";
import { fileSize, relativeTime } from "@/shared/lib/relativeTime";
import { Icon } from "@/shared/ui/Icon";
import { useToast } from "@/shared/ui/Toast";
import { useToggleHelpful, useUploadAttachment, type Attachment, type Post, type PostCategory, type QuotedPost as Quote } from "../api";

export const CATEGORIES: readonly PostCategory[] = ["טיפים", "שאלה", "הצג וספר", "דיון"];

const CATEGORY_TONE: Record<PostCategory, { bg: string; fg: string }> = {
  טיפים: { bg: "var(--ok-bg)", fg: "var(--ok)" },
  שאלה: { bg: "var(--info-bg)", fg: "var(--info)" },
  "הצג וספר": { bg: "var(--c-100)", fg: "var(--accent-ink)" },
  דיון: { bg: "var(--n-100)", fg: "var(--ink-2)" },
};

export const textArea: CSSProperties = {
  width: "100%",
  border: "1.5px solid var(--border)",
  borderRadius: "var(--r-sm)",
  padding: "10px 12px",
  fontSize: 14,
  outline: "none",
  background: "var(--surface)",
  color: "var(--ink)",
  resize: "vertical",
  fontFamily: "inherit",
};

const attachmentRow: CSSProperties = { gap: 10, background: "var(--n-25)", borderRadius: "var(--r-sm)", border: "1px solid var(--border-soft)" };
const ellipsis: CSSProperties = { flex: 1, fontWeight: 500, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };

export function Avatar({ author, color, size = 38 }: { author: string; color: string; size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, borderRadius: "50%", background: color, color: "#fff", display: "grid", placeItems: "center", fontWeight: 700, flex: "none", fontSize: size * 0.42 }}
    >
      {author.charAt(0)}
    </span>
  );
}

export function CategoryBadge({ category }: { category: PostCategory }) {
  const tone = CATEGORY_TONE[category];
  return (
    <span className="badge" style={{ background: tone.bg, color: tone.fg, border: 0 }}>
      {category}
    </span>
  );
}

export function TagPills({ tags, onClick, active }: { tags: string[]; onClick?: (tag: string) => void; active?: string[] }) {
  if (!tags.length) return null;
  return (
    <div className="row" style={{ gap: 7, flexWrap: "wrap", marginTop: 12 }}>
      {tags.map((tag) => {
        const on = active?.includes(tag) ?? false;
        return (
          <button
            key={tag}
            onClick={
              onClick
                ? (e) => {
                    e.stopPropagation();
                    onClick(tag);
                  }
                : undefined
            }
            aria-pressed={onClick ? on : undefined}
            className="row"
            style={{
              gap: 5,
              padding: "3px 10px",
              borderRadius: "var(--r-full)",
              fontSize: 12,
              fontWeight: 600,
              cursor: onClick ? "pointer" : "default",
              border: `1px solid ${on ? "var(--accent)" : "var(--border)"}`,
              background: on ? "var(--accent-tint)" : "var(--n-25)",
              color: on ? "var(--accent-ink)" : "var(--ink-3)",
            }}
          >
            <Icon name="tag" size={11} /> {tag}
          </button>
        );
      })}
    </div>
  );
}

function TagEditor({ tags, setTags }: { tags: string[]; setTags: Dispatch<SetStateAction<string[]>> }) {
  const [draft, setDraft] = useState("");
  function add(raw: string) {
    const parts = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!parts.length) return;
    setTags((current) => {
      const next = current.slice();
      for (const part of parts) if (!next.some((x) => x.toLowerCase() === part.toLowerCase())) next.push(part);
      return next;
    });
    setDraft("");
  }
  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(draft);
    } else if (e.key === "Backspace" && !draft && tags.length) setTags((t) => t.slice(0, -1));
  }
  return (
    <div>
      <div className="row" style={{ gap: 6, marginBottom: 8 }}>
        <Icon name="tag" size={14} style={{ color: "var(--muted)" }} />
        <span className="t-cap" style={{ fontWeight: 600 }}>
          תגיות
        </span>
        <span className="t-cap">עוזרות לאנשים למצוא את זה — הוסיפו משלכם</span>
      </div>
      <div
        className="row"
        style={{ gap: 7, flexWrap: "wrap", alignItems: "center", border: "1.5px solid var(--border)", borderRadius: "var(--r-sm)", padding: "7px 9px", background: "var(--surface)" }}
      >
        {tags.map((tag) => (
          <span
            key={tag}
            className="row"
            style={{
              gap: 5,
              padding: "3px 10px 3px 6px",
              borderRadius: "var(--r-full)",
              fontSize: 12,
              fontWeight: 600,
              background: "var(--accent-tint)",
              color: "var(--accent-ink)",
              border: "1px solid var(--c-200)",
            }}
          >
            {tag}
            <button
              type="button"
              onClick={() => setTags((c) => c.filter((x) => x !== tag))}
              aria-label={`הסרת התגית ${tag}`}
              className="row"
              style={{ width: 16, height: 16, borderRadius: "50%", background: "var(--c-200)", color: "var(--accent-ink)", justifyContent: "center", border: 0, cursor: "pointer" }}
            >
              <Icon name="x" size={10} stroke={3} />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
          onBlur={() => add(draft)}
          placeholder={tags.length ? "הוסיפו עוד…" : "הוסיפו תגית והקישו Enter…"}
          aria-label="תגיות"
          style={{ flex: 1, minWidth: 130, border: 0, outline: "none", background: "transparent", color: "var(--ink)", fontSize: 13.5, fontFamily: "inherit", padding: "2px 0" }}
        />
      </div>
    </div>
  );
}

function AttachmentEditor({ attachments, setAttachments }: { attachments: Attachment[]; setAttachments: Dispatch<SetStateAction<Attachment[]>> }) {
  const imageInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const upload = useUploadAttachment();
  const toast = useToast();

  async function onPick(e: ChangeEvent<HTMLInputElement>, kind: "image" | "file") {
    const files = [...(e.target.files ?? [])];
    e.target.value = "";
    for (const file of files) {
      const blob = kind === "image" ? await compressImage(file).catch(() => null) : file;
      if (!blob) {
        // e.g. HEIC photos, which most browsers cannot decode
        toast(`לא הצלחנו לפתוח את ${file.name} כתמונה. נסו קובץ JPG או PNG.`);
        continue;
      }
      const name = kind === "image" ? file.name.replace(/\.\w+$/, ".jpg") : file.name;
      const attachment = await upload.mutateAsync({ file: blob, name }).catch(() => null);
      if (attachment) setAttachments((current) => [...current, attachment]);
    }
  }
  const remove = (index: number) => setAttachments((current) => current.filter((_, j) => j !== index));
  const indexed = attachments.map((a, i) => ({ ...a, i }));
  const images = indexed.filter((a) => a.kind === "image");
  const files = indexed.filter((a) => a.kind === "file");

  return (
    <div>
      <input ref={imageInput} type="file" accept="image/*" multiple hidden onChange={(e) => void onPick(e, "image")} />
      <input ref={fileInput} type="file" multiple hidden onChange={(e) => void onPick(e, "file")} />
      <div className="row" style={{ gap: 8, marginBottom: attachments.length ? 12 : 0 }}>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => imageInput.current?.click()} disabled={upload.isPending}>
          <Icon name="image" size={15} /> תמונה
        </button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => fileInput.current?.click()} disabled={upload.isPending}>
          <Icon name="paperclip" size={15} /> קובץ
        </button>
      </div>
      {images.length > 0 && (
        <div className="row" style={{ gap: 10, flexWrap: "wrap", marginBottom: files.length ? 10 : 0 }}>
          {images.map((a) => (
            <div key={a.url} style={{ position: "relative" }}>
              <img src={a.url} alt={a.name} style={{ width: 76, height: 76, objectFit: "cover", borderRadius: "var(--r-sm)", display: "block", border: "1px solid var(--border)" }} />
              <button
                type="button"
                onClick={() => remove(a.i)}
                aria-label={`הסרת ${a.name}`}
                style={{
                  position: "absolute",
                  top: -7,
                  insetInlineEnd: -7,
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  background: "var(--ink)",
                  color: "#fff",
                  display: "grid",
                  placeItems: "center",
                  border: "2px solid var(--surface)",
                }}
              >
                <Icon name="x" size={12} stroke={3} />
              </button>
            </div>
          ))}
        </div>
      )}
      {files.length > 0 && (
        <div className="col" style={{ gap: 8 }}>
          {files.map((a) => (
            <div key={a.url} className="row" style={{ ...attachmentRow, padding: "8px 10px" }}>
              <Icon name="file" size={16} style={{ color: "var(--accent)", flex: "none" }} />
              <span className="t-sm" style={ellipsis}>
                {a.name}
              </span>
              <span className="t-cap">{fileSize(a.size)}</span>
              <button type="button" className="btn btn-icon btn-ghost btn-sm" onClick={() => remove(a.i)} aria-label={`הסרת ${a.name}`}>
                <Icon name="x" size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AttachmentView({ attachments, compact = false }: { attachments: Attachment[]; compact?: boolean }) {
  if (!attachments.length) return null;
  const images = attachments.filter((a) => a.kind === "image");
  const files = attachments.filter((a) => a.kind === "file");
  const shown = compact ? images.slice(0, 3) : images;
  const extra = compact ? images.length - shown.length : 0;
  return (
    <div style={{ marginTop: 12 }}>
      {images.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: images.length === 1 ? "1fr" : "repeat(auto-fill, minmax(120px, 1fr))", gap: 8 }}>
          {shown.map((a, i) => (
            <div key={a.url} style={{ position: "relative" }}>
              <img
                src={a.url}
                alt={a.name}
                style={{ width: "100%", maxHeight: compact ? 150 : 360, objectFit: "cover", borderRadius: "var(--r-sm)", display: "block", border: "1px solid var(--border)" }}
              />
              {compact && i === shown.length - 1 && extra > 0 && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: "var(--r-sm)",
                    background: "rgba(20,14,6,0.55)",
                    color: "#fff",
                    display: "grid",
                    placeItems: "center",
                    fontWeight: 700,
                    fontSize: 20,
                  }}
                >
                  +{extra}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {files.length > 0 && (
        <div className="col" style={{ gap: 8, marginTop: images.length ? 8 : 0 }}>
          {files.map((a) => (
            <a key={a.url} href={a.url} onClick={(e) => e.stopPropagation()} className="row" style={{ ...attachmentRow, padding: "9px 12px" }}>
              <Icon name="file" size={16} style={{ color: "var(--accent)", flex: "none" }} />
              <span className="t-sm" style={ellipsis}>
                {a.name}
              </span>
              <span className="t-cap">{fileSize(a.size)}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export interface PostDraft {
  category: PostCategory;
  title: string;
  body: string;
  attachments: Attachment[];
  tags: string[];
}

export function usePostDraft(initial?: PostDraft) {
  const [category, setCategory] = useState<PostCategory>(initial?.category ?? "טיפים");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [attachments, setAttachments] = useState<Attachment[]>(initial?.attachments ?? []);
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const draft: PostDraft = { category, title, body, attachments, tags };
  const reset = (to: PostDraft) => {
    setCategory(to.category);
    setTitle(to.title);
    setBody(to.body);
    setAttachments(to.attachments);
    setTags(to.tags);
  };
  return { draft, valid: Boolean(title.trim() && body.trim()), setCategory, setTitle, setBody, setAttachments, setTags, reset };
}

export function PostFields({ form }: { form: ReturnType<typeof usePostDraft> }) {
  const { draft } = form;
  return (
    <>
      <div className="row" style={{ gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {CATEGORIES.map((c) => (
          <button key={c} className="chip" data-on={draft.category === c} aria-pressed={draft.category === c} onClick={() => form.setCategory(c)}>
            {c}
          </button>
        ))}
      </div>
      <input
        value={draft.title}
        onChange={(e) => form.setTitle(e.target.value)}
        placeholder="תנו לזה כותרת ברורה"
        aria-label="כותרת"
        style={{ ...textArea, marginBottom: 10, fontWeight: 600, fontSize: 15 }}
      />
      <textarea
        value={draft.body}
        onChange={(e) => form.setBody(e.target.value)}
        rows={4}
        placeholder="שתפו את הפרטים. מה ניסיתם, מה עבד, מה אתם שואלים?"
        aria-label="תוכן הפוסט"
        style={{ ...textArea, marginBottom: 14 }}
      />
      <AttachmentEditor attachments={draft.attachments} setAttachments={form.setAttachments} />
      <div style={{ marginTop: 14 }}>
        <TagEditor tags={draft.tags} setTags={form.setTags} />
      </div>
    </>
  );
}

export function QuotedPost({ quote }: { quote: Quote | Post }) {
  return (
    <div className="card" style={{ padding: 13, background: "var(--n-25)", marginTop: 10 }}>
      <div className="row" style={{ gap: 9, marginBottom: 6 }}>
        <Avatar author={quote.author} color={quote.avatarColor} size={26} />
        <span className="t-sm" style={{ fontWeight: 600 }}>
          {quote.author}
        </span>
        <span className="t-cap">{quote.role}</span>
      </div>
      <div className="t-sm" style={{ fontWeight: 600, marginBottom: 3 }}>
        {quote.title}
      </div>
      <p className="t-sm" style={{ color: "var(--ink-3)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
        {quote.body}
      </p>
      <AttachmentView attachments={quote.attachments} compact />
    </div>
  );
}

export function HelpfulButton({ post, size, label }: { post: Post; size: number; label?: string }) {
  const toggle = useToggleHelpful(post);
  return (
    <button
      className="btn btn-ghost btn-sm"
      onClick={(e) => {
        e.stopPropagation();
        toggle.mutate();
      }}
      aria-pressed={post.viewerHelpful}
      title="עזר לי"
      style={{ color: post.viewerHelpful ? "var(--accent)" : "var(--ink-3)", gap: 6 }}
    >
      <Icon name="heart" size={size} stroke={label || !post.viewerHelpful ? 2 : 0} style={{ fill: post.viewerHelpful ? "var(--accent)" : "none" }} /> {post.helpfulCount}
      {label && ` ${label}`}
    </button>
  );
}

interface PostCardProps {
  post: Post;
  onOpen: () => void;
  onRepost: () => void;
  onShare: () => void;
  onTag: (tag: string) => void;
  activeTags: string[];
}

export function PostCard({ post, onOpen, onRepost, onShare, onTag, activeTags }: PostCardProps) {
  const stop = (action: () => void) => (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    action();
  };
  return (
    <div className="card card-hover" style={{ padding: 18, background: "var(--surface)", cursor: "pointer" }} onClick={onOpen}>
      <div className="row" style={{ gap: 11, marginBottom: 10 }}>
        <Avatar author={post.author} color={post.avatarColor} size={40} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="row" style={{ gap: 7 }}>
            <span className="t-h4" style={{ fontSize: 14.5 }}>
              {post.author}
            </span>
            {post.repostOf && (
              <span className="row t-cap" style={{ gap: 4, color: "var(--muted)" }}>
                <Icon name="repeat" size={12} /> שיתוף מחדש
              </span>
            )}
          </div>
          <span className="t-cap">
            {post.role} · {relativeTime(post.createdAt)}
            {post.edited ? " · נערך" : ""}
          </span>
        </div>
        <CategoryBadge category={post.category} />
      </div>
      <div className="t-h4" style={{ fontSize: 16, marginBottom: 5 }}>
        {post.title}
      </div>
      <p className="t-sm" style={{ color: "var(--ink-2)", lineHeight: 1.55, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
        {post.body}
      </p>
      <AttachmentView attachments={post.attachments} compact />
      {post.repostOf && <QuotedPost quote={post.repostOf} />}
      <TagPills tags={post.tags} onClick={onTag} active={activeTags} />
      <div className="row" style={{ gap: 6, marginTop: 12 }}>
        <HelpfulButton post={post} size={15} />
        <button className="btn btn-ghost btn-sm" onClick={stop(onOpen)} style={{ color: "var(--ink-3)", gap: 6 }} title="תגובות">
          <Icon name="message" size={15} /> {post.replies.length}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={stop(onRepost)} style={{ color: "var(--ink-3)", gap: 6 }} title="שיתוף מחדש">
          <Icon name="repeat" size={15} /> {post.reposts}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={stop(onShare)} style={{ color: "var(--ink-3)", gap: 6, marginInlineStart: "auto" }} title="שיתוף">
          <Icon name="link" size={15} /> שתפו
        </button>
      </div>
    </div>
  );
}

import { useState } from "react";
import { relativeTime } from "@/shared/lib/relativeTime";
import { useCopy } from "@/shared/lib/useCopy";
import { ConfirmDelete } from "@/shared/ui/ConfirmDelete";
import { Icon, type IconName } from "@/shared/ui/Icon";
import { Dialog, Modal } from "@/shared/ui/Modal";
import { OrgVisibilityConfirm, OrgVisibilityNote } from "@/shared/ui/OrgVisibility";
import type { Author } from "@/features/auth/session";
import type { Post, PostInput, Reply } from "../api";
import { AttachmentView, Avatar, CategoryBadge, HelpfulButton, PostFields, QuotedPost, TagPills, textArea, usePostDraft } from "./parts";

export const postLink = (post: Pick<Post, "id">) => `${window.location.origin}${import.meta.env.BASE_URL}community/${post.id}`;

export function ShareModal({ post, onClose }: { post: Post; onClose: () => void }) {
  const { copied, copy } = useCopy<"link">(1600);
  const url = postLink(post);
  const text = `${post.title} — בקהילת Portal AI`;
  const apps: { name: string; icon: IconName; href: string }[] = [
    { name: "Slack", icon: "slack", href: `https://slack.com/intl/en/?redir=%2Fapp_redirect%3Fchannel%3D&text=${encodeURIComponent(`${text} ${url}`)}` },
    { name: "אימייל", icon: "mail", href: `mailto:?subject=${encodeURIComponent(post.title)}&body=${encodeURIComponent(`${text}\n\n${url}`)}` },
    { name: "WhatsApp", icon: "message", href: `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}` },
  ];
  return (
    <Dialog onClose={onClose} width={440} label="שתפו את הפוסט">
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 16 }}>
        <div className="row" style={{ gap: 8 }}>
          <Icon name="link" size={18} style={{ color: "var(--accent)" }} />
          <span className="t-h3" style={{ fontSize: 18 }}>
            שתפו את הפוסט
          </span>
        </div>
        <button className="btn btn-icon btn-ghost" onClick={onClose} aria-label="סגירה">
          <Icon name="x" size={18} />
        </button>
      </div>
      <div className="t-cap" style={{ marginBottom: 6 }}>
        קישור
      </div>
      <div
        className="row"
        style={{ gap: 8, justifyContent: "space-between", background: "var(--n-50)", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", padding: "9px 12px", marginBottom: 16 }}
      >
        <span className="t-mono" style={{ color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12.5, direction: "ltr" }}>
          {url}
        </span>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => copy(url, "link")}
          style={{ flex: "none", padding: "3px 8px", color: copied ? "var(--ok)" : "var(--ink-3)" }}
        >
          <Icon name={copied ? "check" : "copy"} size={14} /> {copied ? "הועתק" : "העתק"}
        </button>
      </div>
      <div className="t-cap" style={{ marginBottom: 8 }}>
        שלחו אל
      </div>
      <div className="row" style={{ gap: 10 }}>
        {apps.map((app) => (
          <a
            key={app.name}
            href={app.href}
            target="_blank"
            rel="noopener noreferrer"
            className="card card-hover col"
            style={{ flex: 1, padding: "14px 10px", alignItems: "center", gap: 8, textDecoration: "none", background: "var(--surface)" }}
          >
            <span style={{ width: 38, height: 38, borderRadius: "var(--r-sm)", background: "var(--accent-tint)", color: "var(--accent)", display: "grid", placeItems: "center" }}>
              <Icon name={app.icon} size={18} />
            </span>
            <span className="t-sm" style={{ fontWeight: 600, color: "var(--ink-2)" }}>
              {app.name}
            </span>
          </a>
        ))}
      </div>
    </Dialog>
  );
}

interface ComposerProps {
  me: Author;
  saving: boolean;
  onPost: (post: PostInput) => void;
  onClose: () => void;
}

export function ComposerModal({ me, saving, onPost, onClose }: ComposerProps) {
  const form = usePostDraft();
  const [confirming, setConfirming] = useState(false);
  const [agree, setAgree] = useState(false);
  const { draft, valid } = form;

  function submit() {
    if (!valid) return;
    if (!confirming) {
      setConfirming(true);
      setAgree(false);
      return;
    }
    if (agree) onPost({ ...draft, title: draft.title.trim(), body: draft.body.trim() });
  }

  return (
    <Modal onClose={onClose} width={620} label="פוסט חדש">
      <div className="row" style={{ justifyContent: "space-between", padding: "16px 24px", borderBottom: "1px solid var(--border-soft)" }}>
        <div className="row" style={{ gap: 9 }}>
          <Icon name="pencil" size={18} style={{ color: "var(--accent)" }} />
          <span className="t-h3" style={{ fontSize: 18 }}>
            פוסט חדש
          </span>
        </div>
        <button className="btn btn-icon btn-ghost" onClick={onClose} aria-label="סגירה">
          <Icon name="x" size={18} />
        </button>
      </div>
      {confirming ? (
        <OrgVisibilityConfirm
          name={draft.title.trim()}
          agree={agree}
          setAgree={setAgree}
          body={`כל אחד יוכל לקרוא, להגיב ולשתף את הפוסט${draft.attachments.length ? " ואת הקבצים המצורפים." : "."}`}
          checks={["סיסמאות, טוקנים או מפתחות API, גם בצילומי מסך", "מידע מסווג או מידע שמיועד רק לצוות שלכם", "מידע אישי על עובדים או לקוחות"]}
        />
      ) : (
        <div style={{ padding: 24 }}>
          <OrgVisibilityNote text="הפוסט יהיה גלוי לכל העובדים בארגון." />
          <div className="row" style={{ gap: 12, marginBottom: 16 }}>
            <Avatar author={me.author} color={me.avatar} size={38} />
            <div>
              <div className="t-h4" style={{ fontSize: 14.5 }}>
                {me.author}
              </div>
              <span className="t-cap">מפרסמים כ{me.role}</span>
            </div>
          </div>
          <PostFields form={form} />
        </div>
      )}
      <div className="row" style={{ justifyContent: "space-between", gap: 10, padding: "16px 24px", borderTop: "1px solid var(--border-soft)" }}>
        <span className="t-cap" style={{ color: "var(--ink-3)" }}>
          {confirming ? "אפשר לערוך או למחוק את הפוסט בכל זמן." : "בשלב הבא תאשרו שהתוכן מתאים לכל הארגון."}
        </span>
        <div className="row" style={{ gap: 10 }}>
          <button className="btn btn-ghost" onClick={confirming ? () => setConfirming(false) : onClose}>
            {confirming ? "חזרה לעריכה" : "ביטול"}
          </button>
          {confirming ? (
            <button className="btn btn-primary" disabled={!agree || saving} onClick={submit} style={{ opacity: agree ? 1 : 0.5 }}>
              <Icon name="globe" size={15} /> פרסום לכל הארגון
            </button>
          ) : (
            <button className="btn btn-primary" disabled={!valid} onClick={submit} style={{ opacity: valid ? 1 : 0.5 }}>
              המשך <Icon name="chevronLeft" size={15} />
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

export function RepostModal({ post, saving, onClose, onConfirm }: { post: Post; saving: boolean; onClose: () => void; onConfirm: (comment: string) => void }) {
  const [comment, setComment] = useState("");
  return (
    <Dialog onClose={onClose} width={520} label="שיתוף מחדש עם תגובה">
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 14 }}>
        <div className="row" style={{ gap: 8 }}>
          <Icon name="repeat" size={18} style={{ color: "var(--accent)" }} />
          <span className="t-h3" style={{ fontSize: 18 }}>
            שיתוף מחדש עם תגובה
          </span>
        </div>
        <button className="btn btn-icon btn-ghost" onClick={onClose} aria-label="סגירה">
          <Icon name="x" size={18} />
        </button>
      </div>
      <textarea
        autoFocus
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={3}
        placeholder="הוסיפו את דעתכם (אופציונלי)…"
        aria-label="הוסיפו את דעתכם"
        style={{ ...textArea, marginBottom: 12 }}
      />
      <QuotedPost quote={post.repostOf ?? post} />
      <div className="row" style={{ justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
        <button className="btn btn-ghost" onClick={onClose}>
          ביטול
        </button>
        <button className="btn btn-primary" onClick={() => onConfirm(comment.trim())} disabled={saving}>
          <Icon name="repeat" size={15} /> שתפו מחדש
        </button>
      </div>
    </Dialog>
  );
}

function ReplyItem({ reply, onEdit, onDelete }: { reply: Reply; onEdit: (body: string) => void; onDelete: () => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(reply.body);
  if (editing) {
    return (
      <div className="row" style={{ gap: 11, alignItems: "flex-start" }}>
        <Avatar author={reply.author} color={reply.avatarColor} size={34} />
        <div style={{ flex: 1 }}>
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={2} style={{ ...textArea }} aria-label="עריכת תגובה" />
          <div className="row" style={{ justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setDraft(reply.body);
                setEditing(false);
              }}
            >
              ביטול
            </button>
            <button
              className="btn btn-primary btn-sm"
              disabled={!draft.trim()}
              onClick={() => {
                onEdit(draft.trim());
                setEditing(false);
              }}
              style={{ opacity: draft.trim() ? 1 : 0.5 }}
            >
              שמירה
            </button>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="row" style={{ gap: 11, alignItems: "flex-start" }}>
      <Avatar author={reply.author} color={reply.avatarColor} size={34} />
      <div style={{ flex: 1 }}>
        <div className="row" style={{ gap: 7, marginBottom: 2 }}>
          <span className="t-sm" style={{ fontWeight: 600 }}>
            {reply.author}
          </span>
          <span className="t-cap">
            {reply.role} · {relativeTime(reply.createdAt)}
            {reply.edited ? " · נערך" : ""}
          </span>
          {reply.mine && (
            <span className="row" style={{ gap: 2, marginInlineStart: "auto" }}>
              <button className="btn btn-icon btn-ghost btn-sm" title="עריכה" aria-label="עריכה" onClick={() => setEditing(true)}>
                <Icon name="pencil" size={13} />
              </button>
              <button className="btn btn-icon btn-ghost btn-sm" title="מחיקה" aria-label="מחיקה" onClick={onDelete}>
                <Icon name="trash" size={13} />
              </button>
            </span>
          )}
        </div>
        <p className="t-sm" style={{ color: "var(--ink-2)", lineHeight: 1.55 }}>
          {reply.body}
        </p>
      </div>
    </div>
  );
}

export interface PostActions {
  onRepost: () => void;
  onShare: () => void;
  onReply: (body: string) => Promise<unknown>;
  onEdit: (post: PostInput) => Promise<unknown>;
  onDelete: () => void;
  onEditReply: (replyId: string, body: string) => void;
  onDeleteReply: (replyId: string) => void;
}

export function PostModal({ post, me, onClose, actions, deleting }: { post: Post; me: Author; onClose: () => void; actions: PostActions; deleting: boolean }) {
  const [reply, setReply] = useState("");
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const form = usePostDraft(post);
  const { draft, valid } = form;

  const send = () => {
    if (reply.trim()) void actions.onReply(reply.trim()).then(() => setReply(""));
  };
  const startEdit = () => {
    form.reset(post);
    setEditing(true);
  };
  const saveEdit = () => {
    if (valid) void actions.onEdit({ ...draft, title: draft.title.trim(), body: draft.body.trim() }).then(() => setEditing(false));
  };

  return (
    <Modal onClose={onClose} width={680} label={post.title}>
      <div
        className="row"
        style={{ justifyContent: "space-between", padding: "16px 22px", borderBottom: "1px solid var(--border-soft)", position: "sticky", top: 0, background: "var(--surface)", zIndex: 1 }}
      >
        <CategoryBadge category={editing ? draft.category : post.category} />
        <div className="row" style={{ gap: 4 }}>
          {post.mine && !editing && (
            <>
              <button className="btn btn-ghost btn-sm" onClick={startEdit}>
                <Icon name="pencil" size={14} /> עריכה
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(true)} style={{ color: "var(--err)" }}>
                <Icon name="trash" size={14} /> מחיקה
              </button>
            </>
          )}
          {!editing && (
            <button className="btn btn-ghost btn-sm" onClick={actions.onShare}>
              <Icon name="link" size={14} /> שיתוף
            </button>
          )}
          <button className="btn btn-icon btn-ghost" onClick={onClose} aria-label="סגירה">
            <Icon name="x" size={18} />
          </button>
        </div>
      </div>
      <div style={{ padding: 26 }}>
        <div className="row" style={{ gap: 12, marginBottom: 16 }}>
          <Avatar author={post.author} color={post.avatarColor} size={46} />
          <div>
            <div className="row" style={{ gap: 7 }}>
              <span className="t-h4" style={{ fontSize: 15 }}>
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
        </div>

        {editing ? (
          <div style={{ marginBottom: 8 }}>
            <PostFields form={form} />
            <div className="row" style={{ justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
              <button className="btn btn-ghost" onClick={() => setEditing(false)}>
                ביטול
              </button>
              <button className="btn btn-primary" disabled={!valid} onClick={saveEdit} style={{ opacity: valid ? 1 : 0.5 }}>
                <Icon name="check" size={15} /> שמרו שינויים
              </button>
            </div>
          </div>
        ) : (
          <>
            <h2 className="t-h2" style={{ marginBottom: 12 }}>
              {post.title}
            </h2>
            <p className="t-body" style={{ color: "var(--ink-2)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
              {post.body}
            </p>
            <AttachmentView attachments={post.attachments} />
            {post.repostOf && <QuotedPost quote={post.repostOf} />}
            <TagPills tags={post.tags} />
            <div className="row" style={{ gap: 6, marginTop: 16, paddingBottom: 18, borderBottom: "1px solid var(--border-soft)" }}>
              <HelpfulButton post={post} size={16} label="עזר" />
              <button className="btn btn-ghost btn-sm" onClick={actions.onRepost} style={{ color: "var(--ink-3)", gap: 6 }}>
                <Icon name="repeat" size={16} /> {post.reposts} שיתופים
              </button>
              <button className="btn btn-ghost btn-sm" onClick={actions.onShare} style={{ color: "var(--ink-3)", gap: 6, marginInlineStart: "auto" }}>
                <Icon name="link" size={16} /> שיתוף
              </button>
            </div>
          </>
        )}

        {!editing && (
          <>
            <div className="t-cap" style={{ textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700, color: "var(--ink-3)", margin: "20px 0 14px" }}>
              {post.replies.length} {post.replies.length === 1 ? "תגובה" : "תגובות"}
            </div>

            <div className="row" style={{ gap: 11, marginBottom: 22, alignItems: "flex-start" }}>
              <Avatar author={me.author} color={me.avatar} size={34} />
              <div style={{ flex: 1 }}>
                <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={2} placeholder="כתבו תגובה…" aria-label="כתבו תגובה" style={{ ...textArea }} />
                <div className="row" style={{ justifyContent: "flex-end", marginTop: 8 }}>
                  <button className="btn btn-primary btn-sm" disabled={!reply.trim()} onClick={send} style={{ opacity: reply.trim() ? 1 : 0.5 }}>
                    <Icon name="send" size={14} /> הגיבו
                  </button>
                </div>
              </div>
            </div>

            <div className="col" style={{ gap: 16 }}>
              {post.replies.map((r) => (
                <ReplyItem key={r.id} reply={r} onEdit={(body) => actions.onEditReply(r.id, body)} onDelete={() => actions.onDeleteReply(r.id)} />
              ))}
              {post.replies.length === 0 && (
                <p className="t-sm" style={{ color: "var(--muted)" }}>
                  אין עדיין תגובות — היו הראשונים.
                </p>
              )}
            </div>
          </>
        )}
      </div>

      {confirmDelete && (
        <ConfirmDelete title="למחוק את הפוסט?" text="לא ניתן לבטל." busy={deleting} onCancel={() => setConfirmDelete(false)} onConfirm={actions.onDelete} />
      )}
    </Modal>
  );
}

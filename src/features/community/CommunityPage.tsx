import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMe } from "@/features/auth/session";
import { isStatus } from "@/shared/api/errors";
import { useDebouncedValue } from "@/shared/lib/useDebouncedValue";
import { Icon } from "@/shared/ui/Icon";
import { SearchBar } from "@/shared/ui/SearchBar";
import { ErrorState, Skeleton } from "@/shared/ui/States";
import { communityApi, useFeed, useFeedChange, usePost, usePostChange, type FeedSort, type Post, type PostCategory, type PostInput } from "./api";
import { FeedSortMenu } from "./components/FeedSortMenu";
import { ComposerModal, PostModal, RepostModal, ShareModal } from "./components/modals";
import { CATEGORIES, PostCard } from "./components/parts";

const TAG_CAP = 5;
const FILTERS: readonly (PostCategory | "הכול")[] = ["הכול", ...CATEGORIES];
const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);

export function CommunityPage() {
  const { postId = null } = useParams();
  const navigate = useNavigate();
  const me = useMe();
  const [filter, setFilter] = useState<PostCategory | "הכול">("הכול");
  const [sort, setSort] = useState<FeedSort>("new");
  const [query, setQuery] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [reposting, setReposting] = useState<Post | null>(null);
  const [sharing, setSharing] = useState<Post | null>(null);
  const [composing, setComposing] = useState(false);
  const [showAllTags, setShowAllTags] = useState(false);
  const q = useDebouncedValue(query.trim().toLowerCase());

  const feed = useFeed({ category: filter === "הכול" ? null : filter, tags, q, sort });
  const open = usePost(postId);
  const publish = useFeedChange((post: PostInput) => communityApi.publish(post));
  const repost = useFeedChange(({ id, comment }: { id: string; comment: string }) => communityApi.repost(id, comment));
  const remove = useFeedChange((id: string) => communityApi.remove(id));
  const edit = usePostChange(({ id, post }: { id: string; post: PostInput }) => communityApi.revise(id, post));
  const reply = usePostChange(({ id, body }: { id: string; body: string }) => communityApi.reply(id, body));
  const editReply = usePostChange(({ id, replyId, body }: { id: string; replyId: string; body: string }) => communityApi.editReply(id, replyId, body));
  const removeReply = usePostChange(({ id, replyId }: { id: string; replyId: string }) => communityApi.removeReply(id, replyId));

  useEffect(() => {
    if (postId && isStatus(open.error, 404)) navigate("/community", { replace: true });
  }, [postId, open.error, navigate]);

  const allTags = (feed.data?.tags ?? []).map(([tag]) => tag);
  const visibleTags = showAllTags ? allTags : [...new Set([...tags, ...allTags])].slice(0, Math.max(TAG_CAP, tags.length));
  const hiddenCount = allTags.length - visibleTags.length;
  const toggleTag = (tag: string) => setTags((current) => toggle(current, tag));
  const openPost = (id: string) => navigate(`/community/${encodeURIComponent(id)}`);
  const closePost = () => navigate("/community");
  const posts = feed.data?.items ?? [];
  const current = open.data;

  return (
    <div className="route-fade wrap" style={{ paddingTop: 36, paddingBottom: 80, maxWidth: 820 }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 14, marginBottom: 14 }}>
        <div style={{ marginBottom: 0 }}>
          <span className="t-eyebrow">קהילה</span>
          <h1 className="t-h1" style={{ marginTop: 10 }}>
            קהילה
          </h1>
          <p className="t-body" style={{ fontSize: 16, color: "var(--ink-3)", maxWidth: 560, marginTop: 8 }}>
            שתפו מה עובד, שאלו שאלות ולמדו איך עמיתים באמת משתמשים ב-AI. כולם יכולים לפרסם.
          </p>
        </div>
        <button className="btn btn-primary" style={{ flex: "none" }} onClick={() => setComposing(true)}>
          <Icon name="pencil" size={15} /> פוסט חדש
        </button>
      </div>

      <div style={{ marginBottom: 14 }}>
        <SearchBar value={query} onChange={setQuery} placeholder="חיפוש פוסטים לפי טקסט, מחבר או תגית…" />
      </div>

      <div className="row" style={{ gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <div className="row" style={{ gap: 8, flexWrap: "wrap", flex: 1 }}>
          {FILTERS.map((f) => (
            <button key={f} className="chip" data-on={filter === f} aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {f}
            </button>
          ))}
        </div>
        <FeedSortMenu value={sort} onChange={setSort} />
      </div>

      {allTags.length > 0 && (
        <div className="row" style={{ gap: 8, marginBottom: 18, flexWrap: "wrap", alignItems: "center" }}>
          <span className="row t-cap" style={{ gap: 5, fontWeight: 600, color: "var(--ink-3)" }}>
            <Icon name="tag" size={13} /> סינון לפי תגית
          </span>
          {visibleTags.map((tag) => {
            const on = tags.includes(tag);
            return (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
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
                {on && <Icon name="check" size={11} stroke={3} />} {tag}
              </button>
            );
          })}
          {!showAllTags && hiddenCount > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={() => setShowAllTags(true)} style={{ color: "var(--accent)" }}>
              +{hiddenCount} נוספות
            </button>
          )}
          {showAllTags && allTags.length > TAG_CAP && (
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

      {feed.isPending ? (
        <div className="col" style={{ gap: 12 }} aria-busy="true">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={220} />
          ))}
        </div>
      ) : feed.isError ? (
        <ErrorState onRetry={() => void feed.refetch()} />
      ) : (
        <div className="col" style={{ gap: 12 }}>
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onOpen={() => openPost(post.id)}
              onRepost={() => setReposting(post)}
              onShare={() => setSharing(post)}
              onTag={toggleTag}
              activeTags={tags}
            />
          ))}
          {posts.length === 0 && (
            <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>
              <Icon name={q || tags.length ? "search" : "message"} size={26} style={{ color: "var(--faint)" }} />
              <p className="t-body" style={{ marginTop: 10 }}>
                {q || tags.length || filter !== "הכול" ? "אין פוסטים שתואמים את הסינון." : "אין עדיין פוסטים. התחילו את השיחה למעלה."}
              </p>
            </div>
          )}
        </div>
      )}

      {current && (
        <PostModal
          key={current.id}
          post={current}
          me={me}
          onClose={closePost}
          deleting={remove.isPending}
          actions={{
            onRepost: () => {
              setReposting(current);
              closePost();
            },
            onShare: () => setSharing(current),
            onReply: (body) => reply.mutateAsync({ id: current.id, body }),
            onEdit: (post) => edit.mutateAsync({ id: current.id, post }),
            onDelete: () => remove.mutate(current.id, { onSuccess: closePost }),
            onEditReply: (replyId, body) => editReply.mutate({ id: current.id, replyId, body }),
            onDeleteReply: (replyId) => removeReply.mutate({ id: current.id, replyId }),
          }}
        />
      )}
      {reposting && (
        <RepostModal
          post={reposting}
          saving={repost.isPending}
          onClose={() => setReposting(null)}
          onConfirm={(comment) => repost.mutate({ id: reposting.id, comment }, { onSuccess: () => setReposting(null) })}
        />
      )}
      {sharing && <ShareModal post={sharing} onClose={() => setSharing(null)} />}
      {composing && (
        <ComposerModal me={me} saving={publish.isPending} onPost={(post) => publish.mutate(post, { onSuccess: () => setComposing(false) })} onClose={() => setComposing(false)} />
      )}
    </div>
  );
}

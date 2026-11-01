import seedPosts from "../data/community-posts.json";
import { invalid, newId, notFound, nowIso, persisted, requireOwner, requireText, requireVisibilityAck, stringList, tagCounts, type Viewer } from "../core";
import { Reply, route } from "../router";

const CATEGORIES = ["טיפים", "שאלה", "הצג וספר", "דיון"];
const DEFAULT_REPOST_COMMENT = "שווה קריאה.";
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

interface Author {
  id: string;
  name: string;
  role: string;
  avatarColor: string;
}

interface Attachment {
  kind: "image" | "file";
  url: string;
  name: string;
  size: number | null;
}

interface Quote {
  id: string;
  author: Author;
  category: string;
  title: string;
  body: string;
  attachments: Attachment[];
}

interface ReplyRecord {
  id: string;
  author: Author;
  body: string;
  createdAt: string;
  edited: boolean;
}

interface Post {
  id: string;
  author: Author;
  category: string;
  title: string;
  body: string;
  tags: string[];
  attachments: Attachment[];
  createdAt: string;
  edited: boolean;
  helpfulCount: number;
  repostCount: number;
  repostOf: Quote | null;
  replies: ReplyRecord[];
}

interface CommunityState {
  posts: Post[]; // newest first
  helpful: string[]; // "<postId> <userId>"
}

const seedAuthor = (entry: { author: string; role: string; avatarColor: string }): Author => ({
  id: `seed:${entry.author}`,
  name: entry.author,
  role: entry.role,
  avatarColor: entry.avatarColor,
});

function seed(): CommunityState {
  const now = Date.now();
  const ago = (seconds: number) => new Date(now - seconds * 1000).toISOString();
  const posts = seedPosts
    .map(
      (entry): Post => ({
        id: entry.id,
        author: seedAuthor(entry),
        category: entry.category,
        title: entry.title,
        body: entry.body,
        tags: entry.tags,
        attachments: [],
        createdAt: ago(entry.ageSeconds),
        edited: false,
        helpfulCount: entry.helpfulCount,
        repostCount: entry.reposts,
        repostOf: null,
        replies: [...entry.replies]
          .sort((a, b) => b.ageSeconds - a.ageSeconds)
          .map((r) => ({ id: r.id, author: seedAuthor(r), body: r.body, createdAt: ago(r.ageSeconds), edited: false })),
      }),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { posts, helpful: [] };
}

const store = persisted("community", seed);
const state = () => store.get();

const authorOf = (viewer: Viewer): Author => ({ id: viewer.userId, name: viewer.displayName, role: viewer.role, avatarColor: viewer.avatarColor });
const authored = (a: Author) => ({ authorId: a.id, author: a.name, role: a.role, avatarColor: a.avatarColor });

function requirePost(id: string): Post {
  const post = state().posts.find((p) => p.id === id);
  if (!post) throw notFound("The post does not exist.");
  return post;
}

function view(post: Post, viewer: Viewer) {
  return {
    ...authored(post.author),
    id: post.id,
    category: post.category,
    title: post.title,
    body: post.body,
    tags: post.tags,
    attachments: post.attachments,
    createdAt: post.createdAt,
    edited: post.edited,
    helpfulCount: post.helpfulCount,
    viewerHelpful: state().helpful.includes(`${post.id} ${viewer.userId}`),
    reposts: post.repostCount,
    repostOf: post.repostOf && {
      ...authored(post.repostOf.author),
      id: post.repostOf.id,
      category: post.repostOf.category,
      title: post.repostOf.title,
      body: post.repostOf.body,
      attachments: post.repostOf.attachments,
    },
    replies: post.replies.map((r) => ({ ...authored(r.author), id: r.id, body: r.body, createdAt: r.createdAt, edited: r.edited, mine: r.author.id === viewer.userId })),
    mine: post.author.id === viewer.userId,
  };
}

function attachments(value: unknown): Attachment[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 12).map((a: Partial<Attachment>) => {
    if ((a.kind !== "image" && a.kind !== "file") || typeof a.url !== "string" || !a.url.startsWith("data:")) {
      throw invalid("foreign_attachment", "Attachments must be uploaded first.");
    }
    return { kind: a.kind, url: a.url, name: typeof a.name === "string" && a.name ? a.name : "file", size: typeof a.size === "number" ? a.size : null };
  });
}

function draft(body: unknown) {
  const input = (body ?? {}) as Record<string, unknown>;
  if (!CATEGORIES.includes(input.category as string)) throw invalid("invalid_input", "Unknown category.");
  return {
    category: input.category as string,
    title: requireText(input.title, "title", 300),
    body: requireText(input.body, "body", 20_000),
    tags: stringList(input.tags).slice(0, 20),
    attachments: attachments(input.attachments),
  };
}

function ownReply(post: Post, replyId: string, viewer: Viewer): ReplyRecord {
  const reply = post.replies.find((r) => r.id === replyId);
  if (!reply) throw notFound("The reply does not exist.");
  requireOwner(viewer, reply.author.id, "Only the author can change this reply.");
  return reply;
}

const readAsDataUrl = (file: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error ?? new Error("Could not read the file"));
    reader.readAsDataURL(file);
  });

export const communityRoutes = [
  route("GET", "/posts", ({ query, viewer }) => {
    const all = state().posts;
    const category = query.get("category");
    const tags = query.getAll("tag");
    const text = (query.get("q") ?? "").trim().toLowerCase();
    const matches = all.filter(
      (p) =>
        (!category || p.category === category) &&
        tags.every((t) => p.tags.includes(t)) &&
        (!text || [p.title, p.body, p.author.name, p.author.role, ...p.tags].join(" ").toLowerCase().includes(text)),
    );
    if (query.get("sort") === "top") matches.sort((a, b) => b.helpfulCount - a.helpfulCount);
    return { items: matches.map((p) => view(p, viewer)), tags: tagCounts(all.map((p) => p.tags)) };
  }),

  route("POST", "/posts", ({ body, viewer }) => {
    const { post: input, visibilityAck } = (body ?? {}) as { post?: unknown; visibilityAck?: unknown };
    requireVisibilityAck(visibilityAck);
    const post: Post = {
      id: newId("p"),
      author: authorOf(viewer),
      ...draft(input),
      createdAt: nowIso(),
      edited: false,
      helpfulCount: 0,
      repostCount: 0,
      repostOf: null,
      replies: [],
    };
    state().posts.unshift(post);
    store.save();
    return new Reply(201, view(post, viewer));
  }),

  route("GET", "/posts/:id", ({ params, viewer }) => view(requirePost(params.id ?? ""), viewer)),

  route("PATCH", "/posts/:id", ({ params, body, viewer }) => {
    const post = requirePost(params.id ?? "");
    requireOwner(viewer, post.author.id, "Only the author can change this post.");
    Object.assign(post, draft(body), { edited: true });
    store.save();
    return view(post, viewer);
  }),

  route("DELETE", "/posts/:id", ({ params, viewer }) => {
    const post = requirePost(params.id ?? "");
    requireOwner(viewer, post.author.id, "Only the author can change this post.");
    const s = state();
    s.posts = s.posts.filter((p) => p.id !== post.id);
    s.helpful = s.helpful.filter((k) => !k.startsWith(`${post.id} `));
    store.save();
    return new Reply(204, undefined);
  }),

  route("PUT", "/posts/:id/helpful", ({ params, viewer }) => {
    const post = requirePost(params.id ?? "");
    const key = `${post.id} ${viewer.userId}`;
    if (!state().helpful.includes(key)) {
      state().helpful.push(key);
      post.helpfulCount += 1;
      store.save();
    }
    return { helpfulCount: post.helpfulCount, viewerHelpful: true };
  }),

  route("DELETE", "/posts/:id/helpful", ({ params, viewer }) => {
    const post = requirePost(params.id ?? "");
    const key = `${post.id} ${viewer.userId}`;
    if (state().helpful.includes(key)) {
      state().helpful = state().helpful.filter((k) => k !== key);
      post.helpfulCount -= 1;
      store.save();
    }
    return { helpfulCount: post.helpfulCount, viewerHelpful: false };
  }),

  route("POST", "/posts/:id/replies", ({ params, body, viewer }) => {
    const post = requirePost(params.id ?? "");
    const text = requireText((body as { body?: unknown } | undefined)?.body, "body", 5_000);
    post.replies.push({ id: newId("r"), author: authorOf(viewer), body: text, createdAt: nowIso(), edited: false });
    store.save();
    return new Reply(201, view(post, viewer));
  }),

  route("PATCH", "/posts/:id/replies/:replyId", ({ params, body, viewer }) => {
    const post = requirePost(params.id ?? "");
    const reply = ownReply(post, params.replyId ?? "", viewer);
    reply.body = requireText((body as { body?: unknown } | undefined)?.body, "body", 5_000);
    reply.edited = true;
    store.save();
    return view(post, viewer);
  }),

  route("DELETE", "/posts/:id/replies/:replyId", ({ params, viewer }) => {
    const post = requirePost(params.id ?? "");
    const reply = ownReply(post, params.replyId ?? "", viewer);
    post.replies = post.replies.filter((r) => r !== reply);
    store.save();
    return view(post, viewer);
  }),

  // Reposting shares content that is already public, so it needs no new visibility confirmation.
  route("POST", "/posts/:id/repost", ({ params, body, viewer }) => {
    const original = requirePost(params.id ?? "");
    const raw = (body as { comment?: unknown } | undefined)?.comment;
    const comment = typeof raw === "string" ? raw.trim() : "";
    const repost: Post = {
      id: newId("p"),
      author: authorOf(viewer),
      category: original.category,
      title: original.title,
      body: comment || DEFAULT_REPOST_COMMENT,
      tags: [],
      attachments: [],
      createdAt: nowIso(),
      edited: false,
      helpfulCount: 0,
      repostCount: 0,
      repostOf: original.repostOf ?? {
        id: original.id,
        author: original.author,
        category: original.category,
        title: original.title,
        body: original.body,
        attachments: original.attachments,
      },
      replies: [],
    };
    original.repostCount += 1;
    state().posts.unshift(repost);
    store.save();
    return new Reply(201, view(repost, viewer));
  }),

  // Files are kept inline as data URLs so they survive a reload with the rest of the demo state.
  route("POST", "/uploads", async ({ body }) => {
    const file = body instanceof FormData ? body.get("file") : null;
    if (!(file instanceof Blob)) throw invalid("invalid_input", "No file was sent.");
    if (file.size > MAX_UPLOAD_BYTES) throw invalid("file_too_large", "Files are limited to 10 MB.");
    if (!file.size) throw invalid("file_empty", "The file is empty.");
    const name = file instanceof File ? file.name : "file";
    return new Reply(201, { kind: file.type.startsWith("image/") ? "image" : "file", url: await readAsDataUrl(file), name, size: file.size });
  }),
];

import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { http } from "@/shared/api/http";
import { confirmedVisibility } from "@/shared/ui/OrgVisibility";

export type PostCategory = "טיפים" | "שאלה" | "הצג וספר" | "דיון";
export type FeedSort = "new" | "top";

export interface Attachment {
  kind: "image" | "file";
  url: string;
  name: string;
  size: number | null;
}

interface Authored {
  authorId: string;
  author: string;
  role: string;
  avatarColor: string;
}

export interface Reply extends Authored {
  id: string;
  body: string;
  createdAt: string;
  edited: boolean;
  mine: boolean;
}

export interface QuotedPost extends Authored {
  id: string;
  category: PostCategory;
  title: string;
  body: string;
  attachments: Attachment[];
}

export interface Post extends Authored {
  id: string;
  category: PostCategory;
  title: string;
  body: string;
  tags: string[];
  attachments: Attachment[];
  createdAt: string;
  edited: boolean;
  helpfulCount: number;
  viewerHelpful: boolean;
  reposts: number;
  repostOf: QuotedPost | null;
  replies: Reply[];
  mine: boolean;
}

export interface Feed {
  items: Post[];
  tags: [tag: string, count: number][];
}

export interface FeedFilters {
  category: PostCategory | null;
  tags: string[];
  q: string;
  sort: FeedSort;
}

export interface PostInput {
  category: PostCategory;
  title: string;
  body: string;
  tags: string[];
  attachments: Attachment[];
}

const path = (id: string, rest = "") => `/posts/${encodeURIComponent(id)}${rest}`;

export const communityKeys = {
  all: ["community"] as const,
  feeds: ["community", "feed"] as const,
  feed: (filters: FeedFilters) => ["community", "feed", filters] as const,
  post: (id: string) => ["community", "post", id] as const,
};

export const communityApi = {
  feed: (f: FeedFilters, signal?: AbortSignal) => http.get<Feed>("/posts", { category: f.category, tag: f.tags, q: f.q.trim(), sort: f.sort }, signal),
  post: (id: string, signal?: AbortSignal) => http.get<Post>(path(id), undefined, signal),
  publish: (post: PostInput) => http.post<Post>("/posts", { post, visibilityAck: confirmedVisibility }),
  revise: (id: string, post: PostInput) => http.patch<Post>(path(id), post),
  remove: (id: string) => http.delete<undefined>(path(id)),
  helpful: (id: string, on: boolean) =>
    on ? http.put<{ helpfulCount: number; viewerHelpful: boolean }>(path(id, "/helpful")) : http.delete<{ helpfulCount: number; viewerHelpful: boolean }>(path(id, "/helpful")),
  reply: (id: string, body: string) => http.post<Post>(path(id, "/replies"), { body }),
  editReply: (id: string, replyId: string, body: string) => http.patch<Post>(path(id, `/replies/${encodeURIComponent(replyId)}`), { body }),
  removeReply: (id: string, replyId: string) => http.delete<Post>(path(id, `/replies/${encodeURIComponent(replyId)}`)),
  repost: (id: string, comment: string) => http.post<Post>(path(id, "/repost"), { comment }),
  upload: (file: Blob, name: string) => {
    const form = new FormData();
    form.append("file", file, name);
    return http.post<Attachment>("/uploads", form);
  },
};

export const useFeed = (filters: FeedFilters) =>
  useQuery({ queryKey: communityKeys.feed(filters), queryFn: ({ signal }) => communityApi.feed(filters, signal), placeholderData: keepPreviousData });

export const usePost = (id: string | null) =>
  useQuery({ queryKey: communityKeys.post(id ?? ""), queryFn: ({ signal }) => communityApi.post(id ?? "", signal), enabled: id !== null });

function patchPost(client: QueryClient, id: string, patch: (post: Post) => Post): void {
  client.setQueriesData<Feed>({ queryKey: communityKeys.feeds }, (feed) => feed && { ...feed, items: feed.items.map((p) => (p.id === id ? patch(p) : p)) });
  client.setQueryData<Post>(communityKeys.post(id), (post) => post && patch(post));
}

/** Server-confirmed post state replaces the cached copy everywhere. */
const replacePost = (client: QueryClient, post: Post) => patchPost(client, post.id, () => post);

export function useToggleHelpful(post: Pick<Post, "id" | "helpfulCount" | "viewerHelpful">) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => communityApi.helpful(post.id, !post.viewerHelpful),
    onMutate: async () => {
      await client.cancelQueries({ queryKey: communityKeys.all });
      const before = { helpfulCount: post.helpfulCount, viewerHelpful: post.viewerHelpful };
      patchPost(client, post.id, (p) => ({ ...p, helpfulCount: p.helpfulCount + (p.viewerHelpful ? -1 : 1), viewerHelpful: !p.viewerHelpful }));
      return before;
    },
    onError: (_error, _vars, before) => before && patchPost(client, post.id, (p) => ({ ...p, ...before })),
    onSuccess: (state) => patchPost(client, post.id, (p) => ({ ...p, ...state })),
  });
}

/** Mutations that answer with the whole post (edit, replies). */
export function usePostChange<V>(change: (variables: V) => Promise<Post>) {
  const client = useQueryClient();
  return useMutation({ mutationFn: change, onSuccess: (post) => replacePost(client, post) });
}

export function useFeedChange<V, R>(change: (variables: V) => Promise<R>) {
  const client = useQueryClient();
  return useMutation({ mutationFn: change, onSuccess: () => client.invalidateQueries({ queryKey: communityKeys.all }) });
}

export const useUploadAttachment = () => useMutation({ mutationFn: ({ file, name }: { file: Blob; name: string }) => communityApi.upload(file, name) });

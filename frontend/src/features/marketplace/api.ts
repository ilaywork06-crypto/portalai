import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { http } from "@/shared/api/http";
import { saveBlob } from "@/shared/lib/download";
import { confirmedVisibility } from "@/shared/ui/OrgVisibility";

export type ItemType = "Skill" | "MCP" | "Agent" | "Plugin" | "App";
export type Category = "מערכות ארגוניות" | "מערכות מבצעיות" | "תוכנה" | "מכניקה" | "חומרה";
export type McpAuth = "SSO (מחובר מראש)" | "נדרש מפתח API" | "אין צורך באימות";
export type CodingTool = "Claude Code" | "OpenCode" | "Roo Code";
export type SortOrder = "new" | "installs" | "stars";
export type InstallMethod = "cli-global" | "cli-project" | "zip" | "claude-code" | "desktop" | "npx";
export type PluginPartKey = "skills" | "agents" | "commands" | "hooks" | "mcps";
export type PluginParts = Record<PluginPartKey, string[]>;

export interface ItemCard {
  id: string;
  type: ItemType;
  name: string;
  blurb: string;
  icon: string;
  category: Category;
  tags: string[];
  ownerName: string;
  publisher: string;
  verifiedBy: string | null;
  installs: number;
  stars: number;
  mine: boolean;
  viewerStarred: boolean;
  includes: PluginParts | null;
}

export interface ItemDetail extends ItemCard {
  description: string;
  publishedAt: string;
  updatedAt: string | null;
  edited: boolean;
  viewerInstalled: boolean;
  repo: string | null;
  content: string | null;
  mdName: string | null;
  audience: string[] | null;
  requiredTools: string[] | null;
  serverUrl: string | null;
  auth: McpAuth | null;
  explanation: string | null;
  version: string | null;
  compat: CodingTool[] | null;
  platforms: string[] | null;
  worksWith: string[] | null;
  runCmd: string | null;
  downloads: Record<string, string> | null;
}

export interface Catalog {
  items: ItemCard[];
  facets: { categories: Category[]; tags: [tag: string, count: number][] };
  mineCount: number;
}

export interface CatalogFilters {
  type: ItemType | null;
  categories: Category[];
  tags: string[];
  q: string;
  sort: SortOrder;
}

interface ItemFields {
  name: string;
  blurb: string;
  description: string;
  icon: string;
  category: Category;
  tags: string[];
}
export type ItemInput = ItemFields &
  (
    | { type: "Skill"; content: string; repo: string; mdName: string }
    | { type: "Agent"; content: string; repo: string; mdName: string; audience: string[]; requiredTools: string[] }
    | { type: "MCP"; serverUrl: string; auth: McpAuth; explanation: string; repo: string; publisher: string }
    | { type: "Plugin"; repo: string; version: string; compat: CodingTool[]; includes: PluginParts }
  );

interface StarState {
  stars: number;
  viewerStarred: boolean;
}
interface InstallState {
  installs: number;
  viewerInstalled: boolean;
}

const path = (id: string, rest = "") => `/market/${encodeURIComponent(id)}${rest}`;

export const marketKeys = {
  all: ["market"] as const,
  catalogs: ["market", "catalog"] as const,
  catalog: (filters: CatalogFilters) => ["market", "catalog", filters] as const,
  mine: ["market", "mine"] as const,
  item: (id: string) => ["market", "item", id] as const,
};

export const marketApi = {
  catalog: (f: CatalogFilters, signal?: AbortSignal) =>
    http.get<Catalog>("/market", { type: f.type, category: f.categories, tag: f.tags, q: f.q.trim(), sort: f.sort }, signal),
  mine: (signal?: AbortSignal) => http.get<Catalog>("/market", { mine: true }, signal),
  item: (id: string, signal?: AbortSignal) => http.get<ItemDetail>(path(id), undefined, signal),
  publish: (item: ItemInput) => http.post<ItemDetail>("/market", { item, visibilityAck: confirmedVisibility }),
  revise: (id: string, item: ItemInput) => http.patch<ItemDetail>(path(id), item),
  remove: (id: string) => http.delete<undefined>(path(id)),
  star: (id: string, starred: boolean) => (starred ? http.put<StarState>(path(id, "/star")) : http.delete<StarState>(path(id, "/star"))),
  install: (id: string, method: InstallMethod) => http.post<InstallState>(path(id, "/install"), { method }),
  zip: (id: string) => http.blob(path(id, "/zip")),
};

export const useCatalog = (filters: CatalogFilters, enabled = true) =>
  useQuery({
    queryKey: marketKeys.catalog(filters),
    queryFn: ({ signal }) => marketApi.catalog(filters, signal),
    placeholderData: keepPreviousData,
    enabled,
  });

export const useMyUploads = (enabled: boolean) =>
  useQuery({ queryKey: marketKeys.mine, queryFn: ({ signal }) => marketApi.mine(signal), enabled });

export const useItem = (id: string | null) =>
  useQuery({ queryKey: marketKeys.item(id ?? ""), queryFn: ({ signal }) => marketApi.item(id ?? "", signal), enabled: id !== null });

/** Applies a change to one item wherever it is cached: catalog pages, my uploads, and its detail. */
function patchItem(client: QueryClient, id: string, patch: Partial<ItemDetail>): void {
  const patchList = (data: Catalog | undefined) =>
    data && { ...data, items: data.items.map((item) => (item.id === id ? { ...item, ...patch } : item)) };
  client.setQueriesData<Catalog>({ queryKey: marketKeys.catalogs }, patchList);
  client.setQueryData<Catalog>(marketKeys.mine, patchList);
  client.setQueryData<ItemDetail>(marketKeys.item(id), (item) => item && { ...item, ...patch });
}

export function useToggleStar(item: Pick<ItemCard, "id" | "stars" | "viewerStarred">) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => marketApi.star(item.id, !item.viewerStarred),
    onMutate: async () => {
      await client.cancelQueries({ queryKey: marketKeys.all });
      const before = { stars: item.stars, viewerStarred: item.viewerStarred };
      patchItem(client, item.id, { stars: item.stars + (item.viewerStarred ? -1 : 1), viewerStarred: !item.viewerStarred });
      return before;
    },
    onError: (_error, _vars, before) => before && patchItem(client, item.id, before),
    onSuccess: (state) => patchItem(client, item.id, state),
  });
}

export function useRecordInstall(item: Pick<ItemDetail, "id" | "viewerInstalled">) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (method: InstallMethod) => marketApi.install(item.id, method),
    onSuccess: (state) => patchItem(client, item.id, state),
    meta: { silent: true },
  });
}

export function useDownloadZip(item: Pick<ItemDetail, "id">) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { blob, filename } = await marketApi.zip(item.id);
      saveBlob(blob, filename ?? "skill.zip");
    },
    onSuccess: () => client.invalidateQueries({ queryKey: marketKeys.all }),
  });
}

export function useSaveItem() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string | null; input: ItemInput }) =>
      id === null ? marketApi.publish(input) : marketApi.revise(id, input),
    onSuccess: (item) => {
      client.setQueryData(marketKeys.item(item.id), item);
      return client.invalidateQueries({ queryKey: marketKeys.all });
    },
  });
}

export function useRemoveItem() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => marketApi.remove(id),
    onSuccess: (_result, id) => {
      client.removeQueries({ queryKey: marketKeys.item(id) });
      return client.invalidateQueries({ queryKey: marketKeys.all });
    },
  });
}

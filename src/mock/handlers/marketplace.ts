import seedItems from "../data/market-items.json";
import { invalid, newId, notFound, nowIso, persisted, requireOwner, requireText, requireVisibilityAck, stringList, tagCounts, type Viewer } from "../core";
import { Reply, route } from "../router";
import { zipArchive } from "../zip";

type ItemType = "Skill" | "MCP" | "Agent" | "Plugin" | "App";
const TYPES: ItemType[] = ["Skill", "MCP", "Agent", "Plugin", "App"];
const CATEGORIES = ["מערכות ארגוניות", "מערכות מבצעיות", "תוכנה", "מכניקה", "חומרה"];
const AUTH = ["SSO (מחובר מראש)", "נדרש מפתח API", "אין צורך באימות"];
const TOOLS = ["Claude Code", "OpenCode", "Roo Code"];
const METHODS = ["cli-global", "cli-project", "zip", "claude-code", "desktop", "npx"];
const PART_KEYS = ["skills", "agents", "commands", "hooks", "mcps"] as const;
type Parts = Record<(typeof PART_KEYS)[number], string[]>;

interface Spec {
  content?: string;
  repo?: string | null;
  mdName?: string;
  audience?: string[];
  requiredTools?: string[];
  serverUrl?: string;
  auth?: string;
  explanation?: string;
  version?: string;
  compat?: string[];
  includes?: Parts;
  platforms?: string[];
  worksWith?: string[];
  runCmd?: string;
  downloads?: Record<string, string>;
}

interface Item {
  id: string;
  type: ItemType;
  name: string;
  blurb: string;
  description: string;
  icon: string;
  category: string;
  tags: string[];
  ownerId: string;
  ownerName: string;
  publisher: string;
  verifiedBy: string | null;
  spec: Spec;
  publishedAt: string;
  listedAt: string;
  updatedAt: string | null;
  edited: boolean;
  installs: number;
  stars: number;
}

interface MarketState {
  items: Item[]; // newest listing first
  stars: string[]; // "<itemId> <userId>"
  installs: string[];
}

const parts = (raw: Partial<Parts> | undefined): Parts =>
  Object.fromEntries(PART_KEYS.map((key) => [key, stringList(raw?.[key])])) as Parts;

function seed(): MarketState {
  const now = Date.now();
  const items = seedItems.map((entry, position): Item => {
    const spec = { ...entry.spec } as Spec;
    if (entry.type === "Skill" && !spec.mdName) spec.mdName = "SKILL.md";
    if (entry.type === "Agent" && !spec.mdName) spec.mdName = "README.md";
    if (entry.type === "Plugin") {
      spec.version = spec.version?.trim() ? spec.version : "1.0.0";
      spec.includes = parts(spec.includes);
    }
    return {
      id: entry.id,
      type: entry.type as ItemType,
      name: entry.name,
      blurb: entry.blurb,
      description: entry.description,
      icon: entry.icon,
      category: entry.category,
      tags: entry.tags,
      ownerId: `team:${entry.ownerName}`,
      ownerName: entry.ownerName,
      publisher: entry.publisher,
      verifiedBy: entry.verifiedBy,
      spec,
      publishedAt: `${entry.publishedAt}T12:00:00Z`,
      listedAt: new Date(now - (position + 1) * 3_600_000).toISOString(),
      updatedAt: null,
      edited: false,
      installs: entry.installs,
      stars: entry.stars,
    };
  });
  return { items, stars: [], installs: [] };
}

const store = persisted("market", seed);
const state = () => store.get();

function requireItem(id: string): Item {
  const item = state().items.find((i) => i.id === id);
  if (!item) throw notFound("The item does not exist.");
  return item;
}

const mark = (item: Item, viewer: Viewer) => `${item.id} ${viewer.userId}`;

function card(item: Item, viewer: Viewer) {
  return {
    id: item.id,
    type: item.type,
    name: item.name,
    blurb: item.blurb,
    icon: item.icon,
    category: item.category,
    tags: item.tags,
    ownerName: item.ownerName,
    publisher: item.publisher,
    verifiedBy: item.verifiedBy,
    installs: item.installs,
    stars: item.stars,
    mine: item.ownerId === viewer.userId,
    viewerStarred: state().stars.includes(mark(item, viewer)),
    includes: item.type === "Plugin" ? parts(item.spec.includes) : null,
  };
}

function specFields(item: Item) {
  const s = item.spec;
  switch (item.type) {
    case "Skill":
      return { content: s.content, repo: s.repo, mdName: s.mdName };
    case "Agent":
      return { content: s.content, repo: s.repo, mdName: s.mdName, audience: s.audience ?? [], requiredTools: s.requiredTools ?? [] };
    case "MCP":
      return { serverUrl: s.serverUrl, auth: s.auth, explanation: s.explanation, repo: s.repo ?? null };
    case "Plugin":
      return { repo: s.repo, version: s.version, compat: s.compat ?? [] };
    case "App":
      return { repo: s.repo, version: s.version, platforms: s.platforms ?? [], worksWith: s.worksWith ?? [], runCmd: s.runCmd, downloads: s.downloads ?? {} };
  }
}

const EMPTY_DETAIL = {
  repo: null,
  content: null,
  mdName: null,
  audience: null,
  requiredTools: null,
  serverUrl: null,
  auth: null,
  explanation: null,
  version: null,
  compat: null,
  platforms: null,
  worksWith: null,
  runCmd: null,
  downloads: null,
};

const detail = (item: Item, viewer: Viewer) => ({
  ...card(item, viewer),
  ...EMPTY_DETAIL,
  ...specFields(item),
  description: item.description,
  publishedAt: item.publishedAt,
  updatedAt: item.updatedAt,
  edited: item.edited,
  viewerInstalled: state().installs.includes(mark(item, viewer)),
});

function facets(items: readonly Item[]) {
  return {
    categories: [...new Set(items.map((i) => i.category))].sort(),
    tags: tagCounts(items.map((i) => i.tags)),
  };
}

const searchable = (item: Item) => [item.name, item.blurb, item.description, item.ownerName, item.publisher, item.type, ...item.tags].join(" ").toLowerCase();

/** Validates a publish/edit body and returns the fields it sets. */
function draft(body: unknown, viewer: Viewer, owner: { name: string } | null) {
  const input = (body ?? {}) as Record<string, unknown>;
  const type = input.type as ItemType;
  if (!TYPES.includes(type)) throw invalid("invalid_input", "Unknown item type.");
  if (type === "App") throw invalid("type_not_publishable", "App items cannot be published from the portal yet.");
  const category = input.category as string;
  if (!CATEGORIES.includes(category)) throw invalid("invalid_input", "Unknown category.");
  const common = {
    type,
    name: requireText(input.name, "name", 120),
    blurb: requireText(input.blurb, "blurb", 300),
    description: requireText(input.description, "description", 10_000),
    icon: requireText(input.icon, "icon", 40),
    category,
    tags: stringList(input.tags).slice(0, 30),
  };
  const ownerName = owner?.name ?? viewer.displayName;
  let spec: Spec;
  let publisher = ownerName;
  switch (type) {
    case "Skill":
      spec = { content: requireText(input.content, "content"), repo: requireText(input.repo, "repo"), mdName: (input.mdName as string) || "SKILL.md" };
      break;
    case "Agent":
      spec = {
        content: requireText(input.content, "content"),
        repo: requireText(input.repo, "repo"),
        mdName: (input.mdName as string) || "README.md",
        audience: stringList(input.audience),
        requiredTools: stringList(input.requiredTools),
      };
      break;
    case "MCP": {
      if (!AUTH.includes(input.auth as string)) throw invalid("invalid_input", "Unknown auth mode.");
      spec = {
        serverUrl: requireText(input.serverUrl, "serverUrl"),
        auth: input.auth as string,
        explanation: requireText(input.explanation, "explanation", 5_000),
        repo: typeof input.repo === "string" && input.repo.trim() ? input.repo.trim() : null,
      };
      publisher = (typeof input.publisher === "string" && input.publisher.trim()) || ownerName;
      break;
    }
    case "Plugin": {
      const compat = stringList(input.compat).filter((t) => TOOLS.includes(t));
      const includes = parts(input.includes as Partial<Parts>);
      if (!compat.length) throw invalid("missing_fields", "Missing required fields: compat.");
      if (!PART_KEYS.some((key) => includes[key].length)) throw invalid("missing_fields", "Missing required fields: includes.");
      spec = { repo: requireText(input.repo, "repo"), version: (typeof input.version === "string" && input.version.trim()) || "1.0.0", compat, includes };
      break;
    }
  }
  return { ...common, spec, publisher };
}

function countInstall(item: Item, viewer: Viewer): void {
  const key = mark(item, viewer);
  if (!state().installs.includes(key)) {
    state().installs.push(key);
    item.installs += 1;
  }
}

const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "skill";

export const marketRoutes = [
  route("GET", "/market", ({ query, viewer }) => {
    const all = state().items;
    if (query.get("mine") === "true") {
      const mine = all.filter((i) => i.ownerId === viewer.userId);
      return { items: mine.map((i) => card(i, viewer)), facets: facets(mine), mineCount: mine.length };
    }
    const type = query.get("type");
    const base = type ? all.filter((i) => i.type === type) : all;
    const categories = query.getAll("category");
    const tags = query.getAll("tag");
    const text = (query.get("q") ?? "").trim().toLowerCase();
    const sort = query.get("sort") ?? "new";
    const matches = base.filter(
      (i) => (!categories.length || categories.includes(i.category)) && tags.every((t) => i.tags.includes(t)) && (!text || searchable(i).includes(text)),
    );
    if (sort === "installs") matches.sort((a, b) => b.installs - a.installs);
    if (sort === "stars") matches.sort((a, b) => b.stars - a.stars);
    return {
      items: matches.map((i) => card(i, viewer)),
      facets: facets(base),
      mineCount: all.filter((i) => i.ownerId === viewer.userId).length,
    };
  }),

  route("POST", "/market", ({ body, viewer }) => {
    const { item: input, visibilityAck } = (body ?? {}) as { item?: unknown; visibilityAck?: unknown };
    requireVisibilityAck(visibilityAck);
    const fields = draft(input, viewer, null);
    const now = nowIso();
    const item: Item = {
      id: newId("mk"),
      ...fields,
      ownerId: viewer.userId,
      ownerName: viewer.displayName,
      verifiedBy: null,
      publishedAt: now,
      listedAt: now,
      updatedAt: null,
      edited: false,
      installs: 0,
      stars: 0,
    };
    state().items.unshift(item);
    store.save();
    return new Reply(201, detail(item, viewer));
  }),

  route("GET", "/market/:id", ({ params, viewer }) => detail(requireItem(params.id ?? ""), viewer)),

  route("PATCH", "/market/:id", ({ params, body, viewer }) => {
    const item = requireItem(params.id ?? "");
    requireOwner(viewer, item.ownerId, "Only the publisher can change this item.");
    Object.assign(item, draft(body, viewer, { name: item.ownerName }), { updatedAt: nowIso(), edited: true });
    store.save();
    return detail(item, viewer);
  }),

  route("DELETE", "/market/:id", ({ params, viewer }) => {
    const item = requireItem(params.id ?? "");
    requireOwner(viewer, item.ownerId, "Only the publisher can change this item.");
    const s = state();
    s.items = s.items.filter((i) => i.id !== item.id);
    s.stars = s.stars.filter((k) => !k.startsWith(`${item.id} `));
    s.installs = s.installs.filter((k) => !k.startsWith(`${item.id} `));
    store.save();
    return new Reply(204, undefined);
  }),

  route("PUT", "/market/:id/star", ({ params, viewer }) => {
    const item = requireItem(params.id ?? "");
    const key = mark(item, viewer);
    if (!state().stars.includes(key)) {
      state().stars.push(key);
      item.stars += 1;
      store.save();
    }
    return { stars: item.stars, viewerStarred: true };
  }),

  route("DELETE", "/market/:id/star", ({ params, viewer }) => {
    const item = requireItem(params.id ?? "");
    const key = mark(item, viewer);
    if (state().stars.includes(key)) {
      state().stars = state().stars.filter((k) => k !== key);
      item.stars -= 1;
      store.save();
    }
    return { stars: item.stars, viewerStarred: false };
  }),

  route("POST", "/market/:id/install", ({ params, body, viewer }) => {
    const item = requireItem(params.id ?? "");
    const method = (body as { method?: string } | undefined)?.method ?? "";
    if (!METHODS.includes(method)) throw invalid("invalid_input", "Unknown install method.");
    countInstall(item, viewer);
    store.save();
    return { installs: item.installs, viewerInstalled: true };
  }),

  route("GET", "/market/:id/zip", ({ params, viewer }) => {
    const item = requireItem(params.id ?? "");
    if (item.type !== "Skill" && item.type !== "Agent") throw invalid("not_downloadable", "Only Skills and Agents can be downloaded as ZIP.");
    countInstall(item, viewer);
    store.save();
    const archive = zipArchive(item.spec.mdName ?? "SKILL.md", item.spec.content ?? "");
    return new Reply(200, archive, { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${slug(item.name)}.zip"` });
  }),
];

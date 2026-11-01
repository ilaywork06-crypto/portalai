/** Building blocks of the in-browser mock API: errors, the signed-in viewer, ids, and persisted state. */

export class MockError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const invalid = (code: string, message: string) => new MockError(422, code, message);
export const notFound = (message = "Not found.") => new MockError(404, "not_found", message);
export const forbidden = (message = "Forbidden.") => new MockError(403, "forbidden", message);

export interface Viewer {
  userId: string;
  displayName: string;
  role: string;
  avatarColor: string;
  orgNodeId: string | null;
  managedNodeIds: string[];
  isAdmin: boolean;
}

export const DEMO_PASSWORD = "portal123";

/** Ids and org nodes match the usage demo dataset. */
export const DEMO_USERS: (Viewer & { username: string })[] = [
  { userId: "u364", username: "alon.cohen", displayName: "אלון כהן", role: "ראש מדור", avatarColor: "#A0612A", orgNodeId: "n91", managedNodeIds: ["n29"], isAdmin: false },
  { userId: "u1", username: "elad.biton", displayName: "אלעד ביטון", role: "מהנדס DevOps", avatarColor: "#3D6B9E", orgNodeId: "n35", managedNodeIds: [], isAdmin: false },
  { userId: "admin", username: "portal.admin", displayName: "צוות הפורטל", role: "מנהל מערכת", avatarColor: "#6B6354", orgNodeId: null, managedNodeIds: [], isAdmin: true },
];

/** The user the SSO button signs in. */
export const SSO_USERNAME = "alon.cohen";

export const VISIBILITY_TEXT_VERSION = "org-wide-v1";

export function requireVisibilityAck(ack: unknown): void {
  const value = ack as { confirmed?: unknown; textVersion?: unknown } | undefined;
  if (!value?.confirmed) throw invalid("visibility_ack_required", "Publishing requires confirming that the content is visible to the whole organization.");
  if (value.textVersion !== VISIBILITY_TEXT_VERSION) throw new MockError(409, "visibility_text_outdated", "The visibility confirmation is out of date.");
}

export function requireOwner(viewer: Viewer, ownerId: string, message: string): void {
  if (viewer.userId !== ownerId && !viewer.isAdmin) throw forbidden(message);
}

/** Short, time-ordered id: `<prefix>_<ms timestamp base36><random>`. */
export const newId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}${Math.floor(Math.random() * 0xffffffff)
    .toString(16)
    .padStart(8, "0")}`;

export const nowIso = () => new Date().toISOString();

export function requireText(value: unknown, field: string, max = 100_000): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) throw invalid("missing_fields", `Missing required fields: ${field}.`);
  if (text.length > max) throw invalid("invalid_input", `${field} is too long.`);
  return text;
}

export const stringList = (value: unknown): string[] =>
  Array.isArray(value) ? [...new Set(value.filter((v): v is string => typeof v === "string").map((v) => v.trim()).filter(Boolean))] : [];

/** Tags counted across `items`: most used first, ties in first-seen order. */
export function tagCounts(lists: readonly (readonly string[])[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const tags of lists) for (const tag of tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

// ── persistence ───────────────────────────────────────────────────────────────

const STORAGE_PREFIX = "portal-ai.mock.";

/** A slice of mock state kept in localStorage so changes survive a reload; falls back to memory. */
export function persisted<T>(name: string, seed: () => T): { get: () => T; save: () => void; reset: () => void } {
  const key = STORAGE_PREFIX + name;
  let value: T | undefined;
  const load = (): T => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw) as T;
    } catch {
      // storage blocked or corrupt: start from the seed
    }
    return seed();
  };
  return {
    get: () => (value ??= load()),
    save: () => {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        // over quota or blocked: keep the change in memory only
      }
    },
    reset: () => {
      value = undefined;
      try {
        localStorage.removeItem(key);
      } catch {
        // nothing to clear
      }
    },
  };
}

/** Clears every persisted mock slice; the next request re-seeds the demo data. */
export function resetMockData(): void {
  try {
    for (const key of Object.keys(localStorage)) if (key.startsWith(STORAGE_PREFIX)) localStorage.removeItem(key);
  } catch {
    // storage blocked: nothing persisted
  }
}

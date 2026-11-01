import type { Viewer } from "./core";

export interface MockRequest {
  method: string;
  params: Record<string, string>;
  query: URLSearchParams;
  body: unknown;
  /** Signed-in user. Routes declared `public` run without one and must not read it. */
  viewer: Viewer;
}

/** A handler returns JSON (status 200), `undefined` (204), or a full reply. */
export class Reply {
  constructor(
    readonly status: number,
    readonly body: unknown,
    readonly headers: Record<string, string> = {},
  ) {}
}

export interface Route {
  method: string;
  pattern: RegExp;
  keys: string[];
  handler: (req: MockRequest) => unknown;
  public: boolean;
}

/** `route("GET", "/market/:id", handler)` */
export function route(method: string, path: string, handler: (req: MockRequest) => unknown, options: { public?: boolean } = {}): Route {
  const keys: string[] = [];
  const pattern = new RegExp(
    `^${path.replace(/:(\w+)/g, (_, key: string) => {
      keys.push(key);
      return "([^/]+)";
    })}$`,
  );
  return { method, pattern, keys, handler, public: options.public ?? false };
}

export function match(routes: readonly Route[], method: string, path: string): { route: Route; params: Record<string, string> } | null {
  for (const r of routes) {
    if (r.method !== method) continue;
    const m = r.pattern.exec(path);
    if (!m) continue;
    const params: Record<string, string> = {};
    r.keys.forEach((key, i) => (params[key] = decodeURIComponent(m[i + 1] ?? "")));
    return { route: r, params };
  }
  return null;
}

/**
 * In-browser mock of the Portal AI API. It answers every `fetch` to `<base>/api/*` from seeded demo data,
 * so the app runs with `npm run dev` alone. Changes persist in localStorage; open any page with
 * `?reset-demo` to go back to the seed.
 */
import { MockError, resetMockData, type Viewer } from "./core";
import { authRoutes, currentViewer } from "./handlers/auth";
import { communityRoutes } from "./handlers/community";
import { marketRoutes } from "./handlers/marketplace";
import { usageRoutes } from "./handlers/usage";
import { match, Reply } from "./router";

/** Stands in for the viewer on public routes, which never read it. */
const ANONYMOUS: Viewer = { userId: "", displayName: "", role: "", avatarColor: "", orgNodeId: null, managedNodeIds: [], isAdmin: false };

const routes = [...authRoutes, ...marketRoutes, ...communityRoutes, ...usageRoutes];

/** A little latency so loading states show the way they would against a real server. */
const LATENCY_MS = 120;

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });

const failure = (status: number, code: string, message: string) => json(status, { error: { code, message } });

function parseBody(body: BodyInit | null | undefined): unknown {
  if (body instanceof FormData) return body;
  if (typeof body === "string") {
    try {
      return JSON.parse(body) as unknown;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export async function handle(method: string, url: URL, apiPrefix: string, body: unknown): Promise<Response> {
  const path = url.pathname.slice(apiPrefix.length) || "/";
  const found = match(routes, method, path);
  if (!found) return failure(404, "not_found", `No mock route for ${method} ${path}`);
  const viewer = currentViewer();
  if (!found.route.public && !viewer) return failure(401, "unauthorized", "Sign in first.");
  try {
    const result = await found.route.handler({ method, params: found.params, query: url.searchParams, body, viewer: viewer ?? ANONYMOUS });
    if (result instanceof Reply) {
      if (result.body instanceof Blob) return new Response(result.body, { status: result.status, headers: result.headers });
      return json(result.status, result.body, result.headers);
    }
    return result === undefined ? json(204, undefined) : json(200, result);
  } catch (error) {
    if (error instanceof MockError) return failure(error.status, error.code, error.message);
    console.error("[mock api]", error);
    return failure(500, "internal_error", "The mock API failed.");
  }
}

export function installMockApi(): void {
  const apiPrefix = `${import.meta.env.BASE_URL}api`;
  if (new URLSearchParams(window.location.search).has("reset-demo")) {
    resetMockData();
    const url = new URL(window.location.href);
    url.searchParams.delete("reset-demo");
    window.history.replaceState(null, "", url);
  }

  const realFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const request = input instanceof Request ? input : null;
    const url = new URL(request ? request.url : input instanceof URL ? input.href : (input as string), window.location.href);
    if (url.origin !== window.location.origin || !url.pathname.startsWith(`${apiPrefix}/`)) return realFetch(input, init);
    const method = (init?.method ?? request?.method ?? "GET").toUpperCase();
    const body = parseBody(init?.body);
    await new Promise((resolve) => setTimeout(resolve, LATENCY_MS));
    if (init?.signal?.aborted) throw new DOMException("The operation was aborted.", "AbortError");
    return handle(method, url, apiPrefix, body);
  };
}

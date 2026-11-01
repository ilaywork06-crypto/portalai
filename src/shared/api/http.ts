export const API_BASE = `${import.meta.env.BASE_URL}api`;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type QueryValue = string | number | boolean | null | undefined | readonly (string | number)[];
export type Query = Record<string, QueryValue>;

interface RequestOptions {
  query?: Query;
  body?: unknown;
  signal?: AbortSignal;
}

interface ErrorBody {
  error: { code: string; message: string };
}

const isErrorBody = (value: unknown): value is ErrorBody =>
  typeof value === "object" && value !== null && "error" in value && typeof (value as ErrorBody).error.code === "string";

export function apiUrl(path: string, query?: Query): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === null || value === undefined || value === "" || value === false) continue;
    for (const item of Array.isArray(value) ? value : [value]) params.append(key, String(item));
  }
  const search = params.toString();
  return `${API_BASE}${path}${search ? `?${search}` : ""}`;
}

async function send(method: string, path: string, { query, body, signal }: RequestOptions): Promise<Response> {
  const headers: Record<string, string> = { Accept: "application/json" };
  const init: RequestInit = { method, headers, credentials: "same-origin", signal: signal ?? null };
  if (body instanceof FormData) init.body = body;
  else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  const response = await fetch(apiUrl(path, query), init);
  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null);
    const error = isErrorBody(payload) ? payload.error : { code: "http_error", message: response.statusText };
    throw new ApiError(response.status, error.code, error.message);
  }
  return response;
}

async function json<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  const response = await send(method, path, options);
  return (response.status === 204 ? undefined : await response.json()) as T;
}

export const http = {
  get: <T>(path: string, query?: Query, signal?: AbortSignal) => json<T>("GET", path, { query, signal }),
  post: <T>(path: string, body?: unknown) => json<T>("POST", path, { body }),
  put: <T>(path: string, body?: unknown) => json<T>("PUT", path, { body }),
  patch: <T>(path: string, body?: unknown) => json<T>("PATCH", path, { body }),
  delete: <T>(path: string) => json<T>("DELETE", path),
  blob: async (path: string): Promise<{ blob: Blob; filename: string | null }> => {
    const response = await send("GET", path, {});
    const disposition = response.headers.get("Content-Disposition") ?? "";
    return { blob: await response.blob(), filename: /filename="([^"]+)"/.exec(disposition)?.[1] ?? null };
  },
};

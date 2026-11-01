import { API_BASE, ApiError, http } from "@/shared/api/http";

export interface Identity {
  userId: string;
  displayName: string;
  role: string;
  avatarColor: string;
  orgNodeId: string | null;
  managedNodeIds: string[];
  isAdmin: boolean;
}

export const sessionKey = ["session"] as const;
export const signInMethodsKey = ["auth", "methods"] as const;

export async function fetchSession(): Promise<Identity | null> {
  try {
    return await http.get<Identity>("/auth/me");
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 404)) return null;
    throw error;
  }
}

export const fetchSignInMethods = () => http.get<{ sso: boolean }>("/auth/methods");

export const loginWithPassword = (username: string, password: string) => http.post<Identity>("/auth/login", { username, password });

export const logout = () => http.post<undefined>("/auth/logout");

/** SSO is a full-page round trip through the IdP; the server sets the cookie and redirects to `appPath`. */
export function startSso(appPath: string): void {
  const next = `${import.meta.env.BASE_URL}${appPath.replace(/^\//, "")}`;
  window.location.assign(`${API_BASE}/auth/sso/start?${new URLSearchParams({ next }).toString()}`);
}

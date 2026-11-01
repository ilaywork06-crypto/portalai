import { ApiError, http } from "@/shared/api/http";

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

/** The demo has no IdP: SSO signs in the demo SSO user, then loads `appPath` as the real round trip would. */
export async function startSso(appPath: string): Promise<void> {
  await http.post<Identity>("/auth/sso");
  window.location.assign(`${import.meta.env.BASE_URL}${appPath.replace(/^\//, "")}`);
}

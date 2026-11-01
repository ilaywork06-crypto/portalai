import { useQuery } from "@tanstack/react-query";
import { createContext, useContext, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { ErrorState } from "@/shared/ui/States";
import { fetchSession, sessionKey, type Identity } from "./api";

const IdentityContext = createContext<Identity | null>(null);

export const useSession = () => useQuery({ queryKey: sessionKey, queryFn: fetchSession, staleTime: Infinity, retry: false });

/** Every app route requires a session; without one, go to /login and come back afterwards. */
export function RequireSession({ children }: { children: ReactNode }) {
  const session = useSession();
  const location = useLocation();
  if (session.isPending) return null;
  if (session.isError) {
    return (
      <div className="wrap" style={{ paddingTop: 40 }}>
        <ErrorState onRetry={() => void session.refetch()} />
      </div>
    );
  }
  if (!session.data) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <IdentityContext.Provider value={session.data}>{children}</IdentityContext.Provider>;
}

export function useIdentity(): Identity {
  const identity = useContext(IdentityContext);
  if (!identity) throw new Error("useIdentity must be used inside <RequireSession>");
  return identity;
}

export interface Author {
  id: string;
  author: string;
  role: string;
  avatar: string;
}

/** The signed-in user, shaped as the Marketplace and Community screens show an author. */
export function useMe(): Author {
  const { userId, displayName, role, avatarColor } = useIdentity();
  return { id: userId, author: displayName, role, avatar: avatarColor };
}

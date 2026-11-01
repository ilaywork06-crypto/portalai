import { DEMO_PASSWORD, DEMO_USERS, MockError, persisted, SSO_USERNAME, type Viewer } from "../core";
import { Reply, route } from "../router";

const session = persisted<{ userId: string | null }>("session", () => ({ userId: null }));

const identity = ({ userId, displayName, role, avatarColor, orgNodeId, managedNodeIds, isAdmin }: Viewer): Viewer => ({
  userId,
  displayName,
  role,
  avatarColor,
  orgNodeId,
  managedNodeIds,
  isAdmin,
});

export function currentViewer(): Viewer | null {
  const user = DEMO_USERS.find((u) => u.userId === session.get().userId);
  return user ? identity(user) : null;
}

function signIn(username: string): Viewer {
  const user = DEMO_USERS.find((u) => u.username === username);
  if (!user) throw new MockError(401, "invalid_credentials", "Wrong username or password.");
  session.get().userId = user.userId;
  session.save();
  return identity(user);
}

export const authRoutes = [
  route("GET", "/auth/methods", () => ({ sso: true }), { public: true }),
  route(
    "POST",
    "/auth/login",
    ({ body }) => {
      const { username, password } = (body ?? {}) as { username?: string; password?: string };
      if (password !== DEMO_PASSWORD) throw new MockError(401, "invalid_credentials", "Wrong username or password.");
      return signIn((username ?? "").trim());
    },
    { public: true },
  ),
  // Stand-in for the IdP round trip: signs in the demo SSO user at once.
  route("POST", "/auth/sso", () => signIn(SSO_USERNAME), { public: true }),
  route(
    "POST",
    "/auth/logout",
    () => {
      session.get().userId = null;
      session.save();
      return new Reply(204, undefined);
    },
    { public: true },
  ),
  route("GET", "/auth/me", ({ viewer }) => viewer),
];

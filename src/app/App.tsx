import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { LoginPage } from "@/features/auth/LoginPage";
import { RequireSession } from "@/features/auth/session";
import { CommunityPage } from "@/features/community/CommunityPage";
import { MarketplacePage } from "@/features/marketplace/MarketplacePage";
import { UsagePage } from "@/features/usage/UsagePage";
import { ErrorBoundary } from "@/shared/ui/ErrorBoundary";
import { ErrorState } from "@/shared/ui/States";
import { AppShell } from "./AppShell";
import { Providers } from "./providers";

const basename = import.meta.env.BASE_URL.replace(/\/$/, "");
const future = { v7_startTransition: true, v7_relativeSplatPath: true };

const reload = () => {
  window.location.reload();
};

export function App() {
  return (
    <ErrorBoundary
      fallback={() => (
        <div className="wrap" style={{ paddingTop: 80, maxWidth: 720 }}>
          <ErrorState onRetry={reload} />
        </div>
      )}
    >
      <Providers>
        <BrowserRouter basename={basename} future={future}>
          <Routes>
            <Route path="login" element={<LoginPage />} />
            <Route
              element={
                <RequireSession>
                  <AppShell />
                </RequireSession>
              }
            >
              <Route index element={<Navigate to="/marketplace" replace />} />
              <Route path="marketplace/:itemId?" element={<MarketplacePage />} />
              <Route path="community/:postId?" element={<CommunityPage />} />
              <Route path="usage" element={<UsagePage />} />
              <Route path="*" element={<Navigate to="/marketplace" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </Providers>
    </ErrorBoundary>
  );
}

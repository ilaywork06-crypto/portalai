import { useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { ErrorBoundary } from "@/shared/ui/ErrorBoundary";
import { ErrorState } from "@/shared/ui/States";
import { Footer } from "./Footer";
import { TopNav } from "./TopNav";
import type { Section } from "./nav";

export function AppShell() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const section = pathname.split("/")[1] ?? "marketplace";

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [section]);
  useEffect(() => {
    document.title = "Portal AI — Leg 1";
  }, []);

  const go = (id: Section) => navigate(`/${id}`);
  return (
    <div>
      <TopNav active={section} go={go} />
      <main key={section}>
        <ErrorBoundary
          fallback={(retry) => (
            <div className="wrap" style={{ paddingTop: 20, paddingBottom: 80, maxWidth: 1280, minHeight: "50vh" }}>
              <ErrorState onRetry={retry} />
            </div>
          )}
        >
          <Outlet />
        </ErrorBoundary>
      </main>
      <Footer go={go} />
    </div>
  );
}

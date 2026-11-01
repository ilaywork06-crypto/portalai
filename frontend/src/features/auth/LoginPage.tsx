import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { errorMessage, messageFor } from "@/shared/api/errors";
import { ApiError } from "@/shared/api/http";
import "@/shared/styles/login.css";
import { fetchSignInMethods, loginWithPassword, sessionKey, signInMethodsKey, startSso } from "./api";

const EyeOpen = () => (
  <>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </>
);
const EyeOff = () => (
  <>
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c6.5 0 10 7 10 7a18 18 0 0 1-2.16 3.19M6.6 6.6A18 18 0 0 0 2 11s3.5 7 10 7a9.12 9.12 0 0 0 4.4-1.1" />
    <path d="M1 1l22 22" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
  </>
);

const isReturnTarget = (state: unknown): state is { from: string } =>
  typeof state === "object" && state !== null && typeof (state as { from?: unknown }).from === "string";

const SSO_ERRORS: Record<string, string> = { sso: "sso_failed", sso_unavailable: "sso_unavailable" };

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [redirecting, setRedirecting] = useState(false);
  const usernameRef = useRef<HTMLInputElement>(null);
  const destination = isReturnTarget(location.state) ? location.state.from : "/marketplace";
  // Until the answer arrives the SSO block keeps its place but stays hidden: no layout shift, and no click on a disabled SSO.
  const methods = useQuery({ queryKey: signInMethodsKey, queryFn: fetchSignInMethods, staleTime: Infinity });
  const ssoEnabled = methods.data?.sso !== false;
  const formOpen = open || !ssoEnabled;

  useEffect(() => {
    document.title = "התחברות — Portal AI";
  }, []);
  useEffect(() => {
    if (formOpen) usernameRef.current?.focus();
  }, [formOpen]);

  const login = useMutation({
    meta: { silent: true },
    mutationFn: () =>
      username.trim() && password
        ? loginWithPassword(username.trim(), password)
        : Promise.reject(new ApiError(401, "invalid_credentials", "Missing credentials")),
    onSuccess: (identity) => {
      queryClient.setQueryData(sessionKey, identity);
      navigate(destination, { replace: true });
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    login.mutate();
  };
  const sso = () => {
    setRedirecting(true);
    startSso(destination);
  };
  const ssoError = SSO_ERRORS[params.get("error") ?? ""];
  const error = login.isError ? errorMessage(login.error) : ssoError ? messageFor(ssoError) : null;

  return (
    <div className="auth-page">
      <main className="auth" data-screen-label="Login">
        <Link className="brand" to="/marketplace" aria-label="Portal AI">
          <svg width="28" height="28" viewBox="0 0 40 40" fill="none" aria-hidden="true">
            <defs>
              <linearGradient id="lg" x1="6" y1="3" x2="34" y2="38" gradientUnits="userSpaceOnUse">
                <stop stopColor="#F1AF61"></stop>
                <stop offset="0.55" stopColor="#E0954A"></stop>
                <stop offset="1" stopColor="#CB7C31"></stop>
              </linearGradient>
            </defs>
            <rect x="2" y="2" width="36" height="36" rx="11" fill="url(#lg)"></rect>
            <path fill="#fff" d="M19 8.5 Q20.6 19.4 31.5 21 Q20.6 22.6 19 33.5 Q17.4 22.6 6.5 21 Q17.4 19.4 19 8.5 Z"></path>
            <path fill="#fff" d="M30.5 5.5 Q31 9 34.5 9.5 Q31 10 30.5 13.5 Q30 10 26.5 9.5 Q30 9 30.5 5.5 Z"></path>
          </svg>
          <span className="word">
            Portal<span>&nbsp;AI</span>
          </span>
        </Link>

        <div className="card">
          <div className="intro">
            <span className="t-eyebrow">ברוכים הבאים</span>
            <h1>כל ה-AI במקום אחד</h1>
            <p>כלים, מודלים, מרקטפלייס ומדריכים של החברה, מחכים לכם בפנים.</p>
          </div>

          {ssoEnabled && (
            <div className="center" style={methods.isPending ? { visibility: "hidden" } : undefined}>
              <button type="button" className="sso" onClick={sso} disabled={redirecting}>
                לחצו כאן להתחברות אוטומטית
                <span className="tag">SSO</span>
              </button>
              <p className="sso-note">בלי סיסמה. מתחברים עם חשבון החברה שכבר פתוח אצלכם.</p>

              <div className="divider-or">או</div>

              <button type="button" className="alt-toggle" aria-expanded={open} aria-controls="loginForm" onClick={() => setOpen(!open)}>
                התחברות עם שם משתמש וסיסמה
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m6 9 6 6 6-6"></path>
                </svg>
              </button>
            </div>
          )}

          {(formOpen || error) && (
            <form id="loginForm" noValidate onSubmit={submit}>
              <div className="field">
                <label htmlFor="username">שם משתמש</label>
                <div className="input-wrap">
                  <span className="lead" aria-hidden="true">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="8" r="4"></circle>
                      <path d="M4 21a8 8 0 0 1 16 0"></path>
                    </svg>
                  </span>
                  <input
                    ref={usernameRef}
                    id="username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    placeholder="שם.משתמש"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>
              </div>
              <div className="field">
                <label htmlFor="password">סיסמה</label>
                <div className="input-wrap">
                  <span className="lead" aria-hidden="true">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="4" y="11" width="16" height="10" rx="2"></rect>
                      <path d="M8 11V7a4 4 0 0 1 8 0v4"></path>
                    </svg>
                  </span>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="הזינו את הסיסמה שלכם"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button type="button" className="toggle-pw" aria-label={showPassword ? "הסתר סיסמה" : "הצג סיסמה"} onClick={() => setShowPassword(!showPassword)}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      {showPassword ? <EyeOff /> : <EyeOpen />}
                    </svg>
                  </button>
                </div>
              </div>
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <button type="submit" className={`btn ${ssoEnabled ? "btn-secondary" : "btn-primary"} btn-block`} disabled={login.isPending}>
                התחברות
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}

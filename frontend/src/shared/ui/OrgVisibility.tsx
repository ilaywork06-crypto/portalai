import { Icon } from "./Icon";

/** Must match the server's `CURRENT_TEXT_VERSION`; bump both when the confirmation copy changes. */
export const VISIBILITY_TEXT_VERSION = "org-wide-v1";

export const confirmedVisibility = { confirmed: true, textVersion: VISIBILITY_TEXT_VERSION } as const;

interface OrgVisibilityConfirmProps {
  name: string;
  body: string;
  checks: readonly string[];
  agree: boolean;
  setAgree: (value: boolean) => void;
}

export function OrgVisibilityConfirm({ name, body, checks, agree, setAgree }: OrgVisibilityConfirmProps) {
  return (
    <div style={{ padding: 28 }}>
      <div className="row" style={{ gap: 12, alignItems: "flex-start", marginBottom: 18 }}>
        <span
          style={{
            width: 42,
            height: 42,
            borderRadius: 12,
            background: "var(--c-50)",
            border: "1px solid var(--c-200)",
            display: "grid",
            placeItems: "center",
            flex: "none",
          }}
        >
          <Icon name="globe" size={20} style={{ color: "var(--accent)" }} />
        </span>
        <div style={{ minWidth: 0 }}>
          <div className="t-h3" style={{ fontSize: 19 }}>
            לפני שמפרסמים: זה יהיה גלוי לכל הארגון
          </div>
          <p className="t-sm" style={{ color: "var(--ink-3)", margin: "6px 0 0", textWrap: "pretty", lineHeight: 1.6 }}>
            {name ? (
              <>
                <b style={{ color: "var(--ink)" }}>״{name}״</b> יופיע{" "}
              </>
            ) : (
              "התוכן יופיע "
            )}
            לכל העובדים בארגון. עדיין אין אפשרות להגביל את החשיפה לצוות או ליחידה. {body}
          </p>
        </div>
      </div>
      <div style={{ padding: 16, borderRadius: "var(--r-md)", background: "var(--n-25)", border: "1px solid var(--border-soft)", marginBottom: 18 }}>
        <div style={{ fontWeight: 650, fontSize: 14, marginBottom: 8 }}>ודאו שאין בתוכן:</div>
        <ul className="t-sm" style={{ margin: 0, paddingInlineStart: 18, display: "flex", flexDirection: "column", gap: 4 }}>
          {checks.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      </div>
      <label
        className="row"
        style={{
          gap: 10,
          alignItems: "flex-start",
          cursor: "pointer",
          padding: "12px 14px",
          borderRadius: "var(--r-md)",
          border: `1.5px solid ${agree ? "var(--accent)" : "var(--border-strong)"}`,
          background: agree ? "var(--c-50)" : "var(--surface)",
        }}
      >
        <input
          type="checkbox"
          checked={agree}
          onChange={(e) => setAgree(e.target.checked)}
          style={{ marginTop: 3, width: 16, height: 16, accentColor: "var(--accent)", flex: "none" }}
        />
        <span className="t-sm" style={{ color: "var(--ink)", lineHeight: 1.55 }}>
          בדקתי את התוכן ואני מאשר/ת שאפשר לחשוף אותו לכל הארגון.
        </span>
      </label>
    </div>
  );
}

export function OrgVisibilityNote({ text = "מה שתפרסמו כאן יהיה גלוי לכל העובדים בארגון." }: { text?: string }) {
  return (
    <div
      className="row"
      style={{ gap: 8, padding: "9px 12px", borderRadius: "var(--r-sm)", background: "var(--n-25)", border: "1px solid var(--border-soft)", marginBottom: 18 }}
    >
      <Icon name="globe" size={15} style={{ color: "var(--ink-3)", flex: "none" }} />
      <span className="t-cap" style={{ color: "var(--ink-2)" }}>
        {text}
      </span>
    </div>
  );
}

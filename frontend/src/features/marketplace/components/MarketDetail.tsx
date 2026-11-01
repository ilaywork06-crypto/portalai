import { useState, type CSSProperties, type ReactNode } from "react";
import { useCopy } from "@/shared/lib/useCopy";
import { Icon, iconOr } from "@/shared/ui/Icon";
import { IconTile } from "@/shared/ui/IconTile";
import { Modal } from "@/shared/ui/Modal";
import { useDownloadZip, useRecordInstall, type InstallMethod, type ItemDetail } from "../api";
import { fmtK, fmtPublished, PLUGIN_PARTS, TYPE_LABEL, VERIFIED_BY } from "../constants";
import { MarketStarButton } from "./MarketCard";

const capLabel: CSSProperties = { textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700, color: "var(--ink-3)" };
const meta: CSSProperties = { gap: 5, fontSize: 13, color: "var(--ink-2)", fontWeight: 500 };

function SectionLabel({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div className="t-cap" style={{ ...capLabel, marginBottom: 10, ...style }}>
      {children}
    </div>
  );
}

function Tabs<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: readonly (readonly [T, string])[] }) {
  return (
    <div
      className="row"
      role="tablist"
      style={{ gap: 2, border: "1px solid var(--border)", borderRadius: "var(--r-sm)", padding: 3, marginBottom: 14, width: "fit-content", flexWrap: "wrap" }}
    >
      {options.map(([id, label]) => (
        <button
          key={id}
          role="tab"
          aria-selected={value === id}
          className="btn btn-sm"
          onClick={() => onChange(id)}
          style={{ background: value === id ? "var(--accent)" : "transparent", color: value === id ? "#fff" : "var(--ink-2)" }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function CommandBlock({ prompt = "$ ", cmd, copied, onCopy, style }: { prompt?: string; cmd: string; copied: boolean; onCopy: () => void; style?: CSSProperties }) {
  return (
    <div
      className="row"
      style={{ gap: 8, justifyContent: "space-between", background: "var(--ink)", borderRadius: "var(--r-md)", padding: "12px 14px", marginBottom: 22, ...style }}
    >
      <code className="t-mono" style={{ color: "#f4ede1", fontSize: 13, overflowX: "auto", whiteSpace: "nowrap", direction: "ltr" }}>
        {prompt}
        {cmd}
      </code>
      <button className="btn btn-sm" onClick={onCopy} style={{ flex: "none", background: "rgba(255,255,255,0.12)", color: "#fff" }}>
        <Icon name={copied ? "check" : "copy"} size={14} /> {copied ? "הועתק" : "העתק"}
      </button>
    </div>
  );
}

function Tags({ tags, style }: { tags: string[]; style?: CSSProperties }) {
  if (!tags.length) return null;
  return (
    <div className="row" style={{ gap: 7, flexWrap: "wrap", ...style }}>
      {tags.map((t) => (
        <span key={t} className="badge badge-mono">
          {t}
        </span>
      ))}
    </div>
  );
}

function RepoLink({ href, label = "מקור ב-GitLab", style }: { href: string; label?: string; style?: CSSProperties }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm" style={{ gap: 6, ...style }}>
      <Icon name="git" size={14} /> {label} <Icon name="external" size={13} />
    </a>
  );
}

function MdPreview({ name, content, copied, onCopy }: { name: string; content: string; copied: boolean; onCopy: () => void }) {
  return (
    <>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
        <span className="row t-cap" style={{ gap: 6, ...capLabel }}>
          <Icon name="file" size={13} /> {name}
        </span>
        <button className="btn btn-ghost btn-sm" onClick={onCopy}>
          <Icon name={copied ? "check" : "copy"} size={14} /> {copied ? "הועתק" : "העתק"}
        </button>
      </div>
      <pre
        className="t-mono"
        style={{
          background: "var(--ink)",
          color: "#f4ede1",
          padding: 16,
          borderRadius: "var(--r-md)",
          overflow: "auto",
          maxHeight: 280,
          fontSize: 12.5,
          lineHeight: 1.6,
          whiteSpace: "pre-wrap",
          marginBottom: 20,
          direction: "ltr",
          textAlign: "left",
        }}
      >
        {content}
      </pre>
    </>
  );
}

interface MarketDetailProps {
  item: ItemDetail;
  onClose: () => void;
  onEdit: (item: ItemDetail) => void;
  onDelete: (item: ItemDetail) => void;
}

export function MarketDetail({ item, onClose, onEdit, onDelete }: MarketDetailProps) {
  const [installTab, setInstallTab] = useState<"global" | "project" | "zip">("global");
  const [appTab, setAppTab] = useState<"desktop" | "cli">("desktop");
  const [pluginTab, setPluginTab] = useState<"cc" | "cli">("cc");
  const { copied, copy } = useCopy();
  const content = useCopy(1600);
  const install = useRecordInstall(item);
  const zip = useDownloadZip(item);

  const isAgent = item.type === "Agent";
  const noun = isAgent ? "Agent" : "Skill";
  const serverUrl = item.serverUrl ?? `${item.id}.portal.internal`;
  const cliCommands = {
    global: `portal ${isAgent ? "agent" : "skill"} add ${item.id} --global`,
    project: `portal ${isAgent ? "agent" : "skill"} add ${item.id}`,
  };
  const recordInstall = (method: InstallMethod) => {
    if (!item.viewerInstalled) install.mutate(method);
  };
  const copyInstall = (text: string, key: string, method: InstallMethod) => {
    copy(text, key);
    recordInstall(method);
  };

  const cliInstall = (
    <>
      <SectionLabel style={item.type === "Skill" ? { marginTop: 20 } : undefined}>התקינו את ה-{noun}</SectionLabel>
      <Tabs
        value={installTab}
        onChange={setInstallTab}
        options={[
          ["global", "CLI גלובלי"],
          ["project", "CLI פרויקטלי"],
          ["zip", "הורדת ZIP"],
        ]}
      />
      {installTab !== "zip" ? (
        <>
          <p className="t-sm" style={{ color: "var(--ink-3)", marginBottom: 8 }}>
            {installTab === "global" ? `מתקין את ה-${noun} עבור המשתמש שלכם — זמין בכל פרויקט.` : "הריצו בתוך שורש הפרויקט כדי להוסיף לפרויקט הזה בלבד."}
          </p>
          <CommandBlock
            cmd={cliCommands[installTab]}
            copied={copied === installTab}
            onCopy={() => copyInstall(cliCommands[installTab], installTab, installTab === "global" ? "cli-global" : "cli-project")}
          />
        </>
      ) : (
        <div style={{ marginBottom: 22 }}>
          <p className="t-sm" style={{ color: "var(--ink-3)", marginBottom: 12 }}>
            הורידו את ה-{noun} כ-ZIP וגררו את{" "}
            <code className="t-mono" style={{ background: "var(--n-50)", padding: "1px 6px", borderRadius: 4, direction: "ltr", display: "inline-block" }}>
              {isAgent ? "README.md" : "SKILL.md"}
            </code>{" "}
            לתיקיית ה-{noun}s שלכם.
          </p>
          <button className="btn btn-primary" onClick={() => zip.mutate()} disabled={zip.isPending}>
            <Icon name="download" size={15} /> הורדת {isAgent ? "agent" : "skill"}.zip
          </button>
        </div>
      )}
    </>
  );

  const preview = item.content?.trim() ? (
    <MdPreview
      name={item.mdName ?? (isAgent ? "README.md" : "SKILL.md")}
      content={item.content}
      copied={content.copied === "content"}
      onCopy={() => content.copy(item.content ?? "", "content")}
    />
  ) : null;

  return (
    <Modal onClose={onClose} width={680} label={item.name} cardStyle={{ animation: "routeFade .26s var(--ease) both" }}>
      <div
        className="row"
        style={{
          justifyContent: "space-between",
          padding: "16px 24px",
          borderBottom: "1px solid var(--border-soft)",
          position: "sticky",
          top: 0,
          background: "var(--surface)",
          zIndex: 1,
        }}
      >
        <span className="badge badge-mono">{TYPE_LABEL[item.type]}</span>
        <div className="row" style={{ gap: 4 }}>
          {!item.mine && <MarketStarButton item={item} />}
          {item.mine && (
            <>
              <button className="btn btn-ghost btn-sm" onClick={() => onEdit(item)}>
                <Icon name="pencil" size={14} /> עריכה
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => onDelete(item)} style={{ color: "var(--err)" }}>
                <Icon name="trash" size={14} /> מחיקה
              </button>
            </>
          )}
          <button className="btn btn-icon btn-ghost" onClick={onClose} aria-label="סגירה">
            <Icon name="x" size={18} />
          </button>
        </div>
      </div>

      <div style={{ padding: 26 }}>
        <div className="row" style={{ gap: 14, marginBottom: 14, alignItems: "center" }}>
          <IconTile name={iconOr(item.icon)} size={52} tone="neutral" />
          <div>
            <div className="row" style={{ gap: 7, flexWrap: "wrap", alignItems: "center" }}>
              <h2 className="t-h2">{item.name}</h2>
              {item.verifiedBy === VERIFIED_BY && (
                <span title="פותח ע״י קרמל">
                  <Icon name="checkCircle" size={17} style={{ color: "var(--ok)" }} />
                </span>
              )}
              {item.mine && (
                <span className="badge" style={{ gap: 3, background: "var(--n-100)", borderColor: "transparent" }}>
                  <Icon name="users" size={11} /> שלכם
                </span>
              )}
              {item.type !== "Agent" && <span className="badge">{item.category}</span>}
            </div>
            <div className="row" style={{ gap: 14, marginTop: 2, flexWrap: "wrap" }}>
              <span className="row" style={meta}>
                <Icon name="users" size={14} style={{ color: "var(--muted)" }} /> {item.publisher}
              </span>
              <span className="row" style={meta}>
                <Icon name="package" size={14} style={{ color: "var(--muted)" }} /> {fmtK(item.installs)} התקנות
              </span>
              <span className="row" style={meta}>
                <Icon name="star" size={14} style={{ color: "var(--muted)" }} /> {fmtK(item.stars)} כוכבים
              </span>
              <span className="row" style={meta}>
                <Icon name="clock" size={14} style={{ color: "var(--muted)" }} /> {fmtPublished(item.publishedAt)}
              </span>
            </div>
          </div>
        </div>

        <p className="t-body" style={{ marginBottom: 20, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>
          {item.description || item.blurb}
        </p>

        {item.type === "App" && (
          <>
            <div className="row" style={{ gap: 8, flexWrap: "wrap", marginBottom: 20, alignItems: "center" }}>
              {item.version && <span className="badge badge-mono">v{item.version}</span>}
              {(item.platforms ?? []).map((t) => (
                <span key={t} className="badge" style={{ gap: 5 }}>
                  <Icon name="check" size={11} /> {t}
                </span>
              ))}
              {item.repo && <RepoLink href={item.repo} label="קוד מקור" style={{ marginInlineStart: "auto" }} />}
            </div>
            {item.worksWith && item.worksWith.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <SectionLabel style={{ marginBottom: 8 }}>עובד עם</SectionLabel>
                <div className="row" style={{ gap: 7, flexWrap: "wrap" }}>
                  {item.worksWith.map((t) => (
                    <span key={t} className="badge badge-mono">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <SectionLabel>התקינו את האפליקציה</SectionLabel>
            <Tabs
              value={appTab}
              onChange={setAppTab}
              options={[
                ["desktop", "אפליקציית דסקטופ"],
                ["cli", "הרצה מהטרמינל"],
              ]}
            />
            {appTab === "desktop" ? (
              <div style={{ marginBottom: 22 }}>
                <p className="t-sm" style={{ color: "var(--ink-3)", marginBottom: 12 }}>
                  הורידו את הגרסה למערכת ההפעלה שלכם. נדרש סוכן קוד מותקן ומחובר.
                </p>
                <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                  {(item.platforms ?? []).map((p) => (
                    <a
                      key={p}
                      href={item.downloads?.[p] ?? item.repo ?? undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => recordInstall("desktop")}
                      className="btn btn-primary btn-sm"
                      style={{ gap: 6 }}
                    >
                      <Icon name="download" size={14} /> {p}
                    </a>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <p className="t-sm" style={{ color: "var(--ink-3)", marginBottom: 8 }}>
                  מריץ את האפליקציה בדפדפן, בלי התקנה.
                </p>
                <CommandBlock cmd={item.runCmd ?? ""} copied={copied === "app"} onCopy={() => copyInstall(item.runCmd ?? "", "app", "npx")} />
              </>
            )}
            <Tags tags={item.tags} />
          </>
        )}

        {item.type === "Plugin" && (
          <>
            <div className="row" style={{ gap: 8, flexWrap: "wrap", marginBottom: 20, alignItems: "center" }}>
              {item.version && <span className="badge badge-mono">v{item.version}</span>}
              {(item.compat ?? []).map((t) => (
                <span key={t} className="badge" style={{ gap: 5 }}>
                  <Icon name="check" size={11} /> {t}
                </span>
              ))}
              {item.repo && <RepoLink href={item.repo} style={{ marginInlineStart: "auto" }} />}
            </div>

            {PLUGIN_PARTS.some(([key]) => item.includes?.[key].length) && (
              <>
                <SectionLabel>מה בפנים</SectionLabel>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 10, marginBottom: 22 }}>
                  {PLUGIN_PARTS.filter(([key]) => item.includes?.[key].length).map(([key, label, icon, hint]) => (
                    <div key={key} className="card" style={{ padding: 14, background: "var(--n-25)" }}>
                      <div className="row" style={{ gap: 8, marginBottom: 4 }}>
                        <Icon name={icon} size={15} style={{ color: "var(--accent)" }} />
                        <span style={{ fontWeight: 650, fontSize: 14 }}>{label}</span>
                        <span className="badge" style={{ marginInlineStart: "auto" }}>
                          {item.includes?.[key].length}
                        </span>
                      </div>
                      <div className="t-cap" style={{ marginBottom: 8 }}>
                        {hint}
                      </div>
                      <div className="col" style={{ gap: 4 }}>
                        {item.includes?.[key].map((x) => (
                          <span
                            key={x}
                            className={key === "commands" ? "t-mono" : "t-sm"}
                            style={{
                              fontSize: key === "commands" ? 12.5 : 13,
                              color: "var(--ink-2)",
                              direction: key === "commands" ? "ltr" : undefined,
                              textAlign: key === "commands" ? "right" : undefined,
                            }}
                          >
                            {x}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            <SectionLabel>התקינו את ה-Plugin</SectionLabel>
            <Tabs
              value={pluginTab}
              onChange={setPluginTab}
              options={[
                ["cc", "מתוך Claude Code"],
                ["cli", "Portal CLI"],
              ]}
            />
            <p className="t-sm" style={{ color: "var(--ink-3)", marginBottom: 8 }}>
              {pluginTab === "cc"
                ? "בפעם הראשונה הוסיפו את המרקטפלייס של Portal, ואז התקינו. כל הרכיבים מותקנים יחד, ואפשר לכבות רכיב בודד דרך /plugin."
                : "מתקין את ה-Plugin לכל הכלים התואמים שמותקנים אצלכם."}
            </p>
            <div className="col" style={{ gap: 8, marginBottom: 22 }}>
              {(pluginTab === "cc" ? ["/plugin marketplace add portal.internal/plugins", `/plugin install ${item.id}@portal`] : [`portal plugin add ${item.id}`]).map(
                (cmd, i) => (
                  <CommandBlock
                    key={cmd}
                    prompt={pluginTab === "cc" ? "> " : "$ "}
                    cmd={cmd}
                    copied={copied === `p${i}`}
                    onCopy={() => copyInstall(cmd, `p${i}`, pluginTab === "cc" ? "claude-code" : "cli-global")}
                    style={{ marginBottom: 0 }}
                  />
                ),
              )}
            </div>

            <Tags tags={item.tags} />
          </>
        )}

        {item.type === "MCP" && (
          <>
            <div className="row" style={{ gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
              <span className="badge" style={{ gap: 5 }}>
                <Icon name={item.auth === "אין צורך באימות" ? "check" : "key"} size={11} /> {item.auth ?? "SSO (מחובר מראש)"}
              </span>
              {item.repo && <RepoLink href={item.repo} />}
            </div>

            {item.explanation && (
              <div className="card" style={{ padding: 16, background: "var(--c-50)", borderColor: "var(--c-200)", marginBottom: 20 }}>
                <div className="row" style={{ gap: 8, marginBottom: 8 }}>
                  <Icon name="compass" size={16} style={{ color: "var(--accent)" }} />
                  <span className="t-h4" style={{ fontSize: 14, color: "var(--accent-ink)" }}>
                    איך מתחברים?
                  </span>
                </div>
                <p className="t-sm" style={{ color: "var(--ink-2)", lineHeight: 1.65, whiteSpace: "pre-wrap" }}>
                  {item.explanation}
                </p>
              </div>
            )}

            <SectionLabel style={{ marginBottom: 6 }}>שרת MCP</SectionLabel>
            <div
              className="row"
              style={{
                gap: 8,
                justifyContent: "space-between",
                background: "var(--n-50)",
                border: "1px solid var(--border)",
                borderRadius: "var(--r-sm)",
                padding: "9px 12px",
                marginBottom: 20,
              }}
            >
              <code className="t-mono" style={{ color: "var(--ink)", overflowX: "auto", whiteSpace: "nowrap", direction: "ltr" }}>
                {serverUrl}
              </code>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => copy(serverUrl, "url")}
                style={{ flex: "none", padding: "3px 8px", color: copied === "url" ? "var(--ok)" : "var(--ink-3)" }}
              >
                <Icon name={copied === "url" ? "check" : "copy"} size={14} /> {copied === "url" ? "הועתק" : "העתק"}
              </button>
            </div>

            <SectionLabel>התקנה — שורת פקודה</SectionLabel>
            <CommandBlock cmd={`claude mcp add ${serverUrl}`} copied={copied === "mcp"} onCopy={() => copyInstall(`claude mcp add ${serverUrl}`, "mcp", "claude-code")} />

            <Tags tags={item.tags} style={{ marginBottom: 4 }} />
          </>
        )}

        {item.type === "Skill" && (
          <>
            {item.repo && <RepoLink href={item.repo} />}
            {cliInstall}
            {preview}
            <Tags tags={item.tags} />
          </>
        )}

        {item.type === "Agent" && (
          <>
            {item.audience && item.audience.length > 0 && (
              <div style={{ marginBottom: 18 }}>
                <SectionLabel style={{ marginBottom: 8 }}>קהל יעד</SectionLabel>
                <div className="row" style={{ gap: 7, flexWrap: "wrap" }}>
                  {item.audience.map((a) => (
                    <span key={a} className="badge">
                      {a}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {item.requiredTools && item.requiredTools.length > 0 && (
              <div style={{ marginBottom: 18 }}>
                <SectionLabel style={{ marginBottom: 8 }}>כלים נדרשים</SectionLabel>
                <div className="row" style={{ gap: 7, flexWrap: "wrap" }}>
                  {item.requiredTools.map((t) => (
                    <span key={t} className="badge badge-mono">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {item.repo && <RepoLink href={item.repo} style={{ marginBottom: 20, display: "inline-flex" }} />}
            {cliInstall}
            {preview}
            <Tags tags={item.tags} />
          </>
        )}
      </div>
    </Modal>
  );
}

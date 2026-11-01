import { useRef, useState, type ChangeEvent, type CSSProperties, type ReactNode } from "react";
import { Icon } from "@/shared/ui/Icon";
import { Modal } from "@/shared/ui/Modal";
import { OrgVisibilityConfirm, OrgVisibilityNote } from "@/shared/ui/OrgVisibility";
import type { Category, CodingTool, ItemDetail, ItemInput, McpAuth, PluginParts } from "../api";
import { AUDIENCE_OPTIONS, AUTH_METHODS, CATEGORIES, COMPAT_OPTIONS, ICON_CHOICES, PLUGIN_PARTS, TYPE_LABEL, UPLOAD_TYPES, type UploadType } from "../constants";

const NAME_PLACEHOLDERS: Record<UploadType, string> = {
  Skill: "למשל מסכם סטנדאפ",
  MCP: "למשל Notion MCP",
  Agent: "למשל סוכן בדיקות",
  Plugin: "למשל ערכת פיתוח לצוות",
};
const field: CSSProperties = {
  width: "100%",
  border: "1.5px solid var(--border)",
  borderRadius: "var(--r-sm)",
  padding: "10px 12px",
  fontSize: 14,
  outline: "none",
  background: "var(--surface)",
  color: "var(--ink)",
  resize: "vertical",
  fontFamily: "inherit",
};
const prefixedBox: CSSProperties = {
  gap: 0,
  marginBottom: 16,
  border: "1.5px solid var(--border)",
  borderRadius: "var(--r-sm)",
  background: "var(--surface)",
  overflow: "hidden",
};
const prefix: CSSProperties = {
  padding: "0 10px",
  color: "var(--muted)",
  flex: "none",
  alignSelf: "stretch",
  background: "var(--n-25)",
  borderInlineEnd: "1px solid var(--border)",
};
const prefixedInput: CSSProperties = {
  flex: 1,
  border: 0,
  outline: "none",
  background: "transparent",
  color: "var(--ink)",
  fontSize: 14,
  padding: "10px 12px",
  fontFamily: "inherit",
  minWidth: 0,
  direction: "ltr",
};

const splitList = (value: string) =>
  value
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
const isUploadType = (type: string): type is UploadType => (UPLOAD_TYPES as readonly string[]).includes(type);

function Label({ text, sub }: { text: string; sub?: string }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <span className="t-sm" style={{ fontWeight: 600 }}>
        {text}
      </span>
      {sub && (
        <span className="t-cap" style={{ marginInlineStart: 8 }}>
          {sub}
        </span>
      )}
    </div>
  );
}

function Chips<T extends string>({ options, isOn, onPick }: { options: readonly T[]; isOn: (v: T) => boolean; onPick: (v: T) => void }) {
  return (
    <div className="row" style={{ gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
      {options.map((option) => (
        <button key={option} type="button" className="chip" data-on={isOn(option)} aria-pressed={isOn(option)} onClick={() => onPick(option)}>
          {option}
        </button>
      ))}
    </div>
  );
}

function PrefixedInput({ icon, value, onChange, placeholder, mono }: { icon: "git" | "terminal"; value: string; onChange: (v: string) => void; placeholder: string; mono?: boolean }) {
  return (
    <div className="row" style={prefixedBox}>
      <span className="row" style={prefix}>
        <Icon name={icon} size={15} />
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={mono ? { ...prefixedInput, fontFamily: "var(--mono, monospace)" } : prefixedInput}
      />
    </div>
  );
}

interface UploadModalProps {
  initial: ItemDetail | null;
  defaultPublisher: string;
  saving: boolean;
  onClose: () => void;
  onSave: (input: ItemInput) => void;
}

export function UploadModal({ initial, defaultPublisher, saving, onClose, onSave }: UploadModalProps) {
  const isEdit = initial !== null;
  const [type, setType] = useState<UploadType>(initial && isUploadType(initial.type) ? initial.type : "Skill");
  const [name, setName] = useState(initial?.name ?? "");
  const [blurb, setBlurb] = useState(initial?.blurb ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [tags, setTags] = useState((initial?.tags ?? []).join(", "));
  const [icon, setIcon] = useState(initial?.icon ?? "sparkles");
  const [audience, setAudience] = useState<string[]>(initial?.audience ?? []);
  const [requiredTools, setRequiredTools] = useState((initial?.requiredTools ?? []).join(", "));
  const [category, setCategory] = useState<Category | null>(initial?.category ?? null);
  const [repo, setRepo] = useState(initial?.repo ?? "");
  const [mdName, setMdName] = useState(initial?.mdName ?? "");
  const [serverUrl, setServerUrl] = useState(initial?.serverUrl ?? "");
  const [auth, setAuth] = useState<McpAuth>(initial?.auth ?? "SSO (מחובר מראש)");
  const [explanation, setExplanation] = useState(initial?.explanation ?? "");
  const [publisher, setPublisher] = useState(initial?.publisher ?? defaultPublisher);
  const [version, setVersion] = useState(initial?.version ?? "1.0.0");
  const [compat, setCompat] = useState<CodingTool[]>(initial?.compat ?? ["Claude Code"]);
  const [parts, setParts] = useState<Record<keyof PluginParts, string>>(() => {
    const includes = initial?.includes;
    return { skills: includes?.skills.join(", ") ?? "", agents: includes?.agents.join(", ") ?? "", commands: includes?.commands.join(", ") ?? "", hooks: includes?.hooks.join(", ") ?? "", mcps: includes?.mcps.join(", ") ?? "" };
  });
  const [confirming, setConfirming] = useState(false);
  const [agree, setAgree] = useState(false);
  const mdRef = useRef<HTMLInputElement>(null);

  const isSkill = type === "Skill";
  const isAgent = type === "Agent";
  const isMcp = type === "MCP";
  const isPlugin = type === "Plugin";
  const includes: PluginParts = { skills: splitList(parts.skills), agents: splitList(parts.agents), commands: splitList(parts.commands), hooks: splitList(parts.hooks), mcps: splitList(parts.mcps) };
  const partsCount = Object.values(includes).reduce((sum, list) => sum + list.length, 0);
  const valid =
    Boolean(name.trim() && blurb.trim() && description.trim() && category) &&
    (!(isSkill || isAgent) || Boolean(content.trim() && repo.trim())) &&
    (!isMcp || Boolean(serverUrl.trim() && explanation.trim())) &&
    (!isPlugin || Boolean(repo.trim() && partsCount > 0 && compat.length > 0));

  function onMarkdown(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    void file.text().then((text) => {
      setContent(text);
      setMdName(file.name);
    });
    e.target.value = "";
  }

  function build(): ItemInput | null {
    if (!category) return null;
    const common = { name: name.trim(), blurb: blurb.trim(), description: description.trim(), icon, category, tags: splitList(tags) };
    switch (type) {
      case "Skill":
        return { ...common, type, content: content.trim(), repo: repo.trim(), mdName: mdName || "SKILL.md" };
      case "Agent":
        return { ...common, type, content: content.trim(), repo: repo.trim(), mdName: mdName || "README.md", audience, requiredTools: splitList(requiredTools) };
      case "MCP":
        return { ...common, type, serverUrl: serverUrl.trim(), auth, explanation: explanation.trim(), repo: repo.trim(), publisher: publisher.trim() || defaultPublisher };
      case "Plugin":
        return { ...common, type, repo: repo.trim(), version: version.trim() || "1.0.0", compat, includes };
    }
  }

  function submit() {
    if (!valid) return;
    if (!isEdit && !confirming) {
      setConfirming(true);
      setAgree(false);
      return;
    }
    if (!isEdit && !agree) return;
    const input = build();
    if (input) onSave(input);
  }

  const categoryChips = <Chips options={CATEGORIES} isOn={(c) => category === c} onPick={setCategory} />;
  let typeFields: ReactNode;
  if (isPlugin) {
    typeFields = (
      <>
        <div className="card" style={{ padding: 14, background: "var(--n-25)", marginBottom: 16 }}>
          <p className="t-sm" style={{ margin: 0, color: "var(--ink-2)" }}>
            Plugin מאגד כמה רכיבים להתקנה אחת: Skills, Agents, פקודות, Hooks ו-Connectors. כתבו את שמות הרכיבים בכל סוג, מופרדים בפסיקים. צריך לפחות רכיב אחד.
          </p>
        </div>
        {PLUGIN_PARTS.map(([key, label, partIcon, hint]) => (
          <div key={key} style={{ marginBottom: 12 }}>
            <div className="row" style={{ gap: 6, marginBottom: 6 }}>
              <Icon name={partIcon} size={14} style={{ color: "var(--accent)" }} />
              <span className="t-sm" style={{ fontWeight: 600 }}>
                {label}
              </span>
              <span className="t-cap">{hint}</span>
            </div>
            <input
              value={parts[key]}
              onChange={(e) => setParts({ ...parts, [key]: e.target.value })}
              placeholder={key === "commands" ? "/review, /test" : key === "mcps" ? "Jira MCP, אינטגרציית GitLab" : "אופציונלי"}
              style={{ ...field, direction: key === "commands" ? "ltr" : undefined }}
            />
          </div>
        ))}
        <div style={{ height: 4 }} />
        <Label text="עובד עם" sub="חובה — לפחות כלי אחד" />
        <Chips options={COMPAT_OPTIONS} isOn={(t) => compat.includes(t)} onPick={(t) => setCompat((cur) => toggle(cur, t))} />
        <Label text="קטגוריה" sub="חובה" />
        {categoryChips}
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 140px", gap: 12, marginBottom: 16 }}>
          <div>
            <Label text="ריפו GitLab" sub="חובה" />
            <input value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="https://gitlab.portal.internal/team/plugin" style={{ ...field, direction: "ltr" }} />
          </div>
          <div>
            <Label text="גרסה" />
            <input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="1.0.0" style={{ ...field, direction: "ltr", fontFamily: "var(--mono, monospace)" }} />
          </div>
        </div>
      </>
    );
  } else if (isSkill || isAgent) {
    typeFields = (
      <>
        {isAgent && (
          <>
            <Label text="קהל יעד" sub="בחרו למי הסוכן מיועד" />
            <Chips options={AUDIENCE_OPTIONS} isOn={(a) => audience.includes(a)} onPick={(a) => setAudience((cur) => toggle(cur, a))} />
            <Label text="כלים נדרשים" sub="אופציונלי — מופרדים בפסיקים" />
            <input value={requiredTools} onChange={(e) => setRequiredTools(e.target.value)} placeholder="למשל Claude Code, Slack MCP" style={{ ...field, marginBottom: 16 }} />
          </>
        )}

        <Label text={isAgent ? "קובץ README" : "קובץ SKILL.md"} sub={isAgent ? "חובה — תיאור הסוכן" : "חובה — זו המיומנות"} />
        <input ref={mdRef} type="file" accept=".md,text/markdown,text/plain" hidden onChange={onMarkdown} />
        {!mdName ? (
          <button
            type="button"
            onClick={() => mdRef.current?.click()}
            className="row"
            style={{
              width: "100%",
              justifyContent: "center",
              gap: 10,
              padding: 22,
              border: "1.5px dashed var(--border-strong)",
              borderRadius: "var(--r-md)",
              background: "var(--n-25)",
              color: "var(--ink-2)",
              marginBottom: 16,
              cursor: "pointer",
              fontWeight: 500,
            }}
          >
            <Icon name="file" size={18} style={{ color: "var(--accent)" }} /> העלו SKILL.md
          </button>
        ) : (
          <div className="card" style={{ padding: 0, marginBottom: 16, overflow: "hidden" }}>
            <div className="row" style={{ justifyContent: "space-between", padding: "10px 14px", borderBottom: "1px solid var(--border-soft)", background: "var(--n-25)" }}>
              <span className="row t-sm" style={{ gap: 8, fontWeight: 600, minWidth: 0 }}>
                <Icon name="file" size={15} style={{ color: "var(--accent)", flex: "none" }} />{" "}
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", direction: "ltr" }}>{mdName}</span>
              </span>
              <div className="row" style={{ gap: 4, flex: "none" }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => mdRef.current?.click()}>
                  <Icon name="pencil" size={13} /> החלפה
                </button>
                <button
                  type="button"
                  className="btn btn-icon btn-ghost btn-sm"
                  onClick={() => {
                    setContent("");
                    setMdName("");
                  }}
                  style={{ color: "var(--err)" }}
                  aria-label="הסרת הקובץ"
                >
                  <Icon name="x" size={14} />
                </button>
              </div>
            </div>
            <div className="t-cap" style={{ padding: "9px 14px 0", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700, color: "var(--ink-3)" }}>
              תצוגה מקדימה
            </div>
            <pre
              className="t-mono"
              style={{ margin: 0, padding: "6px 14px 14px", maxHeight: 220, overflow: "auto", fontSize: 12, lineHeight: 1.6, whiteSpace: "pre-wrap", color: "var(--ink-2)", direction: "ltr", textAlign: "left" }}
            >
              {content || "(קובץ ריק)"}
            </pre>
          </div>
        )}

        <Label text="קטגוריה" sub="חובה" />
        {categoryChips}

        <Label text="ריפו GitLab" sub="חובה — כדי שאחרים יוכלו לצפות, לפצל ולתרום" />
        <PrefixedInput icon="git" value={repo} onChange={setRepo} placeholder="https://gitlab.portal.internal/team/skill" />
      </>
    );
  } else {
    typeFields = (
      <>
        <Label text="שרת MCP" sub="חובה — נקודת הקצה הפנימית" />
        <PrefixedInput icon="terminal" value={serverUrl} onChange={setServerUrl} placeholder="confluence-mcp.portal.internal" mono />

        <Label text="שיטת אימות" sub="חובה" />
        <Chips options={AUTH_METHODS} isOn={(a) => auth === a} onPick={setAuth} />

        <Label text="איך מתחברים" sub="חובה — הערה קצרה לעמיתים לא-טכניים (Markdown)" />
        <textarea
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          rows={5}
          placeholder={"למשל\n1. פתחו את הגדרות ה-**Connectors** בלקוח ה-AI שלכם.\n2. הוסיפו את כתובת השרת מלמעלה.\n3. התחברו עם Portal SSO — וזהו."}
          style={{ ...field, marginBottom: 16, fontSize: 13.5, lineHeight: 1.6 }}
        />

        <Label text="קטגוריה" sub="חובה" />
        {categoryChips}

        <Label text="ריפו GitLab" sub="אופציונלי — אם ה-MCP קוד-פתוח פנימית" />
        <PrefixedInput icon="git" value={repo} onChange={setRepo} placeholder="https://gitlab.portal.internal/team/mcp" />

        <Label text="מפרסם" sub="מתמלא אוטומטית — שנו אם מפרסמים בשם ספק" />
        <input value={publisher} onChange={(e) => setPublisher(e.target.value)} placeholder="למשל Anthropic" style={{ ...field, marginBottom: 16 }} />
      </>
    );
  }

  const title = isEdit ? "עריכת ההעלאה שלכם" : "שתפו עם הצוות";
  return (
    <Modal onClose={onClose} width={640} label={title}>
      <div className="row" style={{ justifyContent: "space-between", padding: "16px 24px", borderBottom: "1px solid var(--border-soft)" }}>
        <div className="row" style={{ gap: 9 }}>
          <Icon name="plus" size={18} style={{ color: "var(--accent)" }} />
          <span className="t-h3" style={{ fontSize: 18 }}>
            {title}
          </span>
        </div>
        <button className="btn btn-icon btn-ghost" onClick={onClose} aria-label="סגירה">
          <Icon name="x" size={18} />
        </button>
      </div>
      {confirming ? (
        <OrgVisibilityConfirm
          name={name.trim()}
          agree={agree}
          setAgree={setAgree}
          body="כל אחד יוכל לראות את התוכן, להעתיק ולהתקין אותו."
          checks={["סיסמאות, טוקנים או מפתחות API", "מידע מסווג או מידע שמיועד רק לצוות שלכם", "מידע אישי על עובדים או לקוחות"]}
        />
      ) : (
        <div style={{ padding: 24 }}>
          <OrgVisibilityNote />
          <Label text="מה אתם משתפים?" />
          <div className="row" style={{ gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            {UPLOAD_TYPES.map((t) => (
              <button
                key={t}
                className="chip"
                data-on={type === t}
                aria-pressed={type === t}
                onClick={() => {
                  setType(t);
                  setCategory(CATEGORIES[0] ?? null);
                }}
              >
                {TYPE_LABEL[t]}
              </button>
            ))}
          </div>

          <Label text="שם" />
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={NAME_PLACEHOLDERS[type]} style={{ ...field, marginBottom: 16, fontWeight: 600, fontSize: 15 }} />

          <Label text="תקציר בשורה אחת" sub="מוצג על הכרטיס" />
          <input value={blurb} onChange={(e) => setBlurb(e.target.value)} placeholder="משפט אחד על מה שזה עושה." style={{ ...field, marginBottom: 16 }} />

          <Label text="תיאור" sub="במילים ובהסבר שלכם" />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder={
              isPlugin
                ? "מה הערכה פותרת, למי היא מיועדת ואיך הרכיבים עובדים יחד."
                : isAgent
                  ? "תארו לאיזה מקרי שימוש הסוכן הכי מתאים, מה הוא יודע לעשות ואיך הוא עובד."
                  : "הסבירו למה זה מיועד, מתי להשתמש ומה כדאי שאנשים ידעו. זה המרחב שלכם לספר את הסיפור."
            }
            style={{ ...field, marginBottom: 16 }}
          />

          {typeFields}

          <Label text="תגיות" sub="מופרדות בפסיקים, אופציונלי" />
          <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="למשל פרודוקטיביות, כתיבה" style={{ ...field, marginBottom: 16 }} />

          <Label text={isSkill ? "אייקון כרטיס" : "אייקון"} />
          <div className="row" style={{ gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            {ICON_CHOICES.map((choice) => (
              <button
                key={choice}
                onClick={() => setIcon(choice)}
                className="row"
                aria-label={choice}
                aria-pressed={icon === choice}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "var(--r-sm)",
                  justifyContent: "center",
                  border: `1.5px solid ${icon === choice ? "var(--accent)" : "var(--border)"}`,
                  background: icon === choice ? "var(--accent-tint)" : "var(--surface)",
                  color: icon === choice ? "var(--accent)" : "var(--ink-3)",
                }}
              >
                <Icon name={choice} size={18} />
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="row" style={{ justifyContent: "space-between", gap: 10, padding: "16px 24px", borderTop: "1px solid var(--border-soft)" }}>
        <span className="t-cap" style={{ color: "var(--ink-3)", maxWidth: 320 }}>
          {confirming ? "אפשר לערוך או למחוק את הפרסום בכל זמן." : isEdit ? "השינויים יופיעו לכל הארגון." : "בשלב הבא תאשרו שהתוכן מתאים לכל הארגון."}
        </span>
        <div className="row" style={{ gap: 10 }}>
          <button className="btn btn-ghost" onClick={confirming ? () => setConfirming(false) : onClose}>
            {confirming ? "חזרה לעריכה" : "ביטול"}
          </button>
          {confirming ? (
            <button className="btn btn-primary" disabled={!agree || saving} onClick={submit} style={{ opacity: agree ? 1 : 0.5 }}>
              <Icon name="globe" size={15} /> פרסום לכל הארגון
            </button>
          ) : (
            <button className="btn btn-primary" disabled={!valid || saving} onClick={submit} style={{ opacity: valid ? 1 : 0.5 }}>
              {isEdit ? (
                <>
                  <Icon name="check" size={15} /> שמרו שינויים
                </>
              ) : (
                <>
                  המשך <Icon name="chevronLeft" size={15} />
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

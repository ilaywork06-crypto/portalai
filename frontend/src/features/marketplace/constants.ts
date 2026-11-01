import type { IconName } from "@/shared/ui/Icon";
import type { Category, CodingTool, ItemType, McpAuth, PluginPartKey, SortOrder } from "./api";

export const TYPE_FILTERS: readonly (readonly [label: string, type: ItemType | null])[] = [
  ["הכול", null],
  ["Connectors", "MCP"],
  ["Skills", "Skill"],
  ["Agents", "Agent"],
  ["Plugins", "Plugin"],
  ["Apps", "App"],
];
export const UPLOAD_TYPES = ["Skill", "MCP", "Agent", "Plugin"] as const satisfies readonly ItemType[];
export type UploadType = (typeof UPLOAD_TYPES)[number];

export const PLUGIN_PARTS: readonly (readonly [key: PluginPartKey, label: string, icon: IconName, hint: string])[] = [
  ["skills", "Skills", "sparkles", "יכולות מומחה שה-AI טוען לפי הצורך"],
  ["agents", "Agents", "bolt", "סוכנים למשימות ארוכות"],
  ["commands", "פקודות", "terminal", "קיצורי / מוכנים"],
  ["hooks", "Hooks", "zap", "פעולות שרצות אוטומטית באירועים"],
  ["mcps", "Connectors", "package", "חיבורים למערכות"],
];
export const COMPAT_OPTIONS: readonly CodingTool[] = ["Claude Code", "OpenCode", "Roo Code"];
export const SORTS: readonly (readonly [SortOrder, string])[] = [
  ["new", "הכי חדשים"],
  ["installs", "הכי מותקנים"],
  ["stars", "הכי הרבה כוכבים"],
];
export const ICON_CHOICES: readonly IconName[] = ["sparkles", "zap", "message", "pencil", "code", "mic", "database", "book", "compass", "bolt", "package", "git"];
export const CATEGORIES: readonly Category[] = ["מערכות ארגוניות", "מערכות מבצעיות", "תוכנה", "מכניקה", "חומרה"];
export const AUTH_METHODS: readonly McpAuth[] = ["SSO (מחובר מראש)", "נדרש מפתח API", "אין צורך באימות"];
export const AUDIENCE_OPTIONS = ["כולם", "מהנדסים", "מנהלי מוצר", "אנליסטים", "תמיכה", "תפעול", "שיווק", "QA", "מנהלים"] as const;
export const TYPE_LABEL: Record<ItemType, string> = { MCP: "Connector", Skill: "Skill", Agent: "Agent", Plugin: "Plugin", App: "App" };
export const VERIFIED_BY = "צוות קרמל";
export const TAG_CAP = 5;

export const fmtK = (n: number): string => (n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k` : String(n));

export const fmtPublished = (iso: string): string =>
  new Date(iso).toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" });

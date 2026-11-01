// Regenerates the dev usage dataset from the seeded generator used by the Leg 1 design file.
// Usage: node services/usage/seed/generate-dataset.mjs
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

function rng(seed) { return function () { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const R = rng(20261028);
const pick = (a) => a[Math.floor(R() * a.length)];

const DAYS = 180;
const today = new Date(2026, 9, 28);
const dates = [], dow = [];
for (let i = 0; i < DAYS; i++) { const d = new Date(today); d.setDate(today.getDate() - (DAYS - 1 - i)); dates.push(d); dow.push(d.getDay()); }

const MODELS = [
  { id: "claude-opus-4-1", name: "Claude Opus 4.1", provider: "Anthropic", tier: 3, in: 15, out: 75 },
  { id: "claude-sonnet-4-5", name: "Claude Sonnet 4.5", provider: "Anthropic", tier: 2, in: 3, out: 15 },
  { id: "claude-haiku-4", name: "Claude Haiku 4", provider: "Anthropic", tier: 1, in: 0.8, out: 4 },
];
MODELS.forEach((m) => { m.blended = 0.85 * m.in + 0.15 * m.out; }); // $ למיליון טוקנים, תמהיל טיפוסי של כלי קוד
const TIERS = { 3: { label: "פרימיום", sign: "$$$", hint: "למשימות קשות: ארכיטקטורה, באגים עמוקים" }, 2: { label: "סטנדרט", sign: "$$", hint: "ברירת מחדל לרוב עבודת הקוד" }, 1: { label: "חסכוני", sign: "$", hint: "השלמות, טסטים, תיעוד, שינויים קטנים" } };

const TOOLS = [
  { id: "claude-code", name: "Claude Code", icon: "terminal" },
  { id: "opencode", name: "OpenCode", icon: "code" },
  { id: "roo-code", name: "Roo Code", icon: "bolt" },
  { id: "other", name: "כלי קוד אחר", icon: "key" },
];
const RPM = [{ model: 0, limit: 15 }, { model: 1, limit: 25 }]; // בקשות לדקה, לכל משתמש

const LEVELS = ["ארגון", "יחידה", "מרכז", "ענף", "מדור", "צוות", "יוזר"];
const LEVELS_PL = ["ארגונים", "יחידות", "מרכזים", "ענפים", "מדורים", "צוותים", "משתמשים"];

const nodes = {};
let nid = 0;
function node(name, level, parent) { const id = "n" + (nid++); nodes[id] = { id, name, level, parent: parent ? parent.id : null, children: [], users: [] }; if (parent) parent.children.push(id); return nodes[id]; }

const TREE = {
  "יחידת טכנולוגיה": {
    "מרכז תשתיות": { "ענף ענן": ["מדור Kubernetes", "מדור אחסון", "מדור FinOps"], "ענף רשתות ואבטחה": ["מדור אבטחת מידע", "מדור תקשורת"] },
    "מרכז פיתוח": { "ענף פלטפורמות": ["מדור Backend", "מדור API Gateway", "מדור כלי פיתוח"], "ענף אפליקציות": ["מדור Web", "מדור מובייל"] },
  },
  "יחידת מוצר ועסקים": {
    "מרכז מוצר דיגיטלי": { "ענף חוויית משתמש": ["מדור מחקר משתמשים", "מדור Design System"], "ענף מוצרי ליבה": ["מדור תשלומים", "מדור חשבונות", "מדור התראות"] },
    "מרכז נתונים ואנליטיקה": { "ענף הנדסת נתונים": ["מדור פלטפורמות נתונים", "מדור ETL", "מדור Streaming"], "ענף מדע נתונים": ["מדור מודלים", "מדור BI"] },
  },
};
const TEAM_NAMES = ["ליבה", "אינטגרציות", "תשתית", "אוטומציה", "ניטור", "שירותים", "כלים", "איכות", "ביצועים", "חוויית מפתח", "נתונים", "API"];
const FIRST = ["נועה", "יונתן", "מאיה", "איתי", "שירה", "עומר", "תמר", "דניאל", "רוני", "אורי", "ליה", "גיל", "הדר", "עידו", "יעל", "אביב", "נגה", "אלעד", "מיכל", "רועי", "ענבר", "טל", "שקד", "יואב", "דנה", "אסף", "רותם", "ניר", "קרן", "עמית", "אלה", "בן", "הילה", "ליאור", "סהר", "נדב", "מור", "אריאל", "שני", "תומר"];
const LAST = ["לוי", "כהן", "מזרחי", "פרץ", "ביטון", "אברהם", "פרידמן", "שפירא", "גבאי", "אזולאי", "דהן", "אשכנזי", "קליין", "רוזן", "בן דוד", "חדד", "גולן", "שגיא", "ברק", "נחום", "סגל", "וקנין", "עמר", "אלון", "טל", "הורוביץ", "יוסף", "מלכה", "זילברמן", "קורן"];

const root = node("החברה", 0, null);
const sections = [];
for (const [u, cs] of Object.entries(TREE)) { const un = node(u, 1, root); for (const [c, bs] of Object.entries(cs)) { const cn = node(c, 2, un); for (const [b, ss] of Object.entries(bs)) { const bn = node(b, 3, cn); ss.forEach((s) => sections.push(node(s, 4, bn))); } } }

const PROFILES = {
  opus: [0.76, 0.18, 0.06],
  balanced: [0.15, 0.62, 0.23],
  thrifty: [0.04, 0.5, 0.46],
  heavy: [0.48, 0.42, 0.1],
};
const ARCH = { // [p פעילות ביום חול, בקשות ממוצעות ביום]
  occasional: [0.12, 18], weekly: [0.42, 45], daily: [0.88, 95], power: [0.97, 190],
};

const users = [];
let used = new Set();
function uniqName() { let n; do { n = pick(FIRST) + " " + pick(LAST); } while (used.has(n)); used.add(n); return n; }

const ME_SECTION = sections.find((s) => s.name === "מדור פלטפורמות נתונים");
let oi = 0;
sections.forEach((sec, si) => {
  const culture = sec === ME_SECTION ? 1.05 : 0.55 + R() * 0.8; // נטיית אימוץ
  const thrift = R(); // תרבות בחירת מודלים
  const nightOwls = R(); // תרבות שעות שפל
  const teamSizes = sec === ME_SECTION ? [6, 6, 6, 6] : (() => { const k = oi++; return k === 18 || k % 2 ? (k % 4 === 1 ? [7, 7, 6] : [5, 5, 5, 5]) : [7, 7, 7, 7]; })();
  const tNames = TEAM_NAMES.slice().sort(() => R() - 0.5);
  teamSizes.forEach((size, ti) => {
    const team = node("צוות " + tNames[ti], 5, sec);
    for (let k = 0; k < size; k++) {
      const isMe = sec === ME_SECTION && ti === 0 && k === 0;
      const name = isMe ? "אלון כהן" : uniqName();
      const r = R() / culture;
      let arch = r < 0.08 ? "noaccess" : r < 0.18 ? "noinstall" : r < 0.25 ? "idle" : r < 0.42 ? "occasional" : r < 0.62 ? "weekly" : r < 0.88 ? "daily" : "power";
      if (isMe) arch = "daily";
      const pr = R();
      let prof = pr < 0.12 + (1 - thrift) * 0.2 ? "opus" : pr < 0.25 + (1 - thrift) * 0.2 ? "heavy" : pr < 0.75 ? "balanced" : "thrifty";
      if (isMe) prof = "opus";
      const tools = [];
      if (!["noaccess", "noinstall"].includes(arch)) {
        if (R() < 0.78) tools.push(0); if (R() < 0.26) tools.push(1); if (R() < 0.32) tools.push(2); if (R() < 0.14) tools.push(3);
        if (!tools.length) tools.push(Math.floor(R() * 3));
      }
      if (isMe) tools.splice(0, tools.length, 0, 2, 3);
      const tw = tools.map((t, i) => (i === 0 ? 2 + R() * 3 : 0.4 + R())); const tws = tw.reduce((a, b) => a + b, 0) || 1;
      const toolShare = [0, 0, 0, 0]; tools.forEach((t, i) => { toolShare[t] = tw[i] / tws; });
      if (isMe) { toolShare[0] = 0.68; toolShare[2] = 0.22; toolShare[3] = 0.1; }
      const ms = PROFILES[prof].map((v) => v * (0.7 + R() * 0.6)); const mss = ms.reduce((a, b) => a + b, 0); const modelShare = ms.map((v) => v / mss);
      const blended = modelShare.reduce((s, v, i) => s + v * MODELS[i].blended, 0);
      const u = {
        id: "u" + users.length, name, isMe, arch, prof, teamId: team.id, sectionId: sec.id,
        role: k === 0 ? (ti === 0 && sec === ME_SECTION ? "ראש מדור" : "ראש צוות") : pick(["מפתח/ת", "מפתח/ת", "מפתח/ת", "מהנדס/ת DevOps", "מהנדס/ת נתונים", "QA"]),
        access: true, tools, toolShare, modelShare, blended,
        tpr: 11000 + R() * 18000, pk: isMe ? 0.56 : 0.3 + R() * 0.26, off: isMe ? 0.26 : Math.min(0.6, R() * (0.15 + nightOwls * 0.45)),
        W: new Float32Array(DAYS), P: new Float32Array(DAYS), O: new Float32Array(DAYS), RL: new Uint8Array(DAYS), first: -1,
      };
      if (ARCH[arch]) {
        const [pAct, base] = ARCH[arch];
        const intensity = base * (0.6 + R() * 0.8) * (isMe ? 1.1 : 1);
        const join = isMe ? 20 : Math.floor(Math.pow(R(), 1.6) * 150);
        const weekendF = 0.06 + u.off * 0.5;
        const rlProb = blended > 10 || intensity > 140 ? 0.25 : intensity > 80 ? 0.08 : 0.02;
        for (let d = join; d < DAYS; d++) {
          const we = dow[d] === 5 || dow[d] === 6;
          const ramp = Math.min(1, 0.55 + (0.45 * (d - join)) / 45) * (0.72 + (0.28 * d) / DAYS);
          if (R() > (we ? pAct * weekendF : pAct) * ramp) continue;
          let req = intensity * (0.4 + R() * 1.2) * ramp;
          if (we) { u.O[d] = req; }
          else { const o = req * Math.min(0.9, u.off * (0.5 + R())); const rest = req - o; u.O[d] = o; u.W[d] = rest * (0.78 + R() * 0.12); u.P[d] = rest - u.W[d]; }
          if (u.first < 0) u.first = d;
          if (!we && R() < rlProb * (req / intensity)) u.RL[d] = 1 + Math.floor(R() * (rlProb > 0.2 ? 6 : 2));
        }
      }
      users.push(u); team.users.push(u.id);
    }
  });
});

// אירועים חריגים לסיפור הנתונים
const me = users.find((u) => u.isMe);
[176, 177].forEach((d) => { me.W[d] *= 3.2; me.RL[d] = 7 + (d - 176) * 3; });
const meTeamMate = users.find((u) => u.sectionId === ME_SECTION.id && !u.isMe && u.arch === "daily");
if (meTeamMate) { [174, 175, 176].forEach((d) => { meTeamMate.W[d] = 1400; meTeamMate.P[d] = 300; meTeamMate.RL[d] = 9; }); meTeamMate.modelShare = [0.85, 0.1, 0.05]; meTeamMate.blended = meTeamMate.modelShare.reduce((s, v, i) => s + v * MODELS[i].blended, 0); }
const spikeSec = sections.find((s) => s.name === "מדור תשלומים");
users.filter((u) => u.sectionId === spikeSec.id && u.first >= 0).slice(0, 4).forEach((u) => { for (let d = 172; d < DAYS; d++) if (dow[d] < 5) { u.W[d] += 220; u.P[d] += 60; } });

// צבירה לעלות
users.forEach((u) => { u.costPerReq = (u.tpr / 1e6) * u.blended; });

// הורים לכל יוזר
users.forEach((u) => { let n = nodes[u.teamId]; while (n) { if (n.id !== u.teamId) n.users = n.users || []; n = n.parent ? nodes[n.parent] : null; } });
Object.values(nodes).forEach((n) => { if (n.level < 5) n.users = []; });
users.forEach((u) => { let n = nodes[nodes[u.teamId].parent]; while (n) { n.users.push(u.id); n = n.parent ? nodes[n.parent] : null; } });

const userById = Object.fromEntries(users.map((u) => [u.id, u]));
function pathOf(id) { const p = []; let n = nodes[id]; while (n) { p.unshift(n); n = n.parent ? nodes[n.parent] : null; } return p; }



const TOOL_IDS = TOOLS.map((t) => t.id);
const MODEL_IDS = MODELS.map((m) => m.id);
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const dataset = {
  version: 1,
  start: iso(dates[0]),
  days: DAYS,
  nodes: Object.values(nodes).sort((a, b) => +a.id.slice(1) - +b.id.slice(1)).map((n) => ({ id: n.id, name: n.name, level: n.level, parent: n.parent })),
  users: users.map((u) => ({
    id: u.id, name: u.name, role: u.role, teamId: u.teamId,
    tools: u.tools.map((i) => TOOL_IDS[i]),
    modelShare: Object.fromEntries(u.modelShare.map((v, i) => [MODEL_IDS[i], v])),
    tokensPerRequest: u.tpr, peakShare: u.pk, firstDay: u.first,
    daily: Array.from({ length: DAYS }, (_, d) => [d, u.W[d] + u.P[d], u.O[d]]).filter(([, w, q]) => w || q),
  })),
  demo: { meUserId: me.id, meSectionId: ME_SECTION.id, rootId: root.id },
};

const out = new URL("../src/portal_usage/infrastructure/dataset.json.gz", import.meta.url);
writeFileSync(out, gzipSync(JSON.stringify(dataset)));
console.log(`users=${dataset.users.length} nodes=${dataset.nodes.length} start=${dataset.start}`, dataset.demo);

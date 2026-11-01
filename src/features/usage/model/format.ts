export const iNum = (n: number): string => Math.round(n).toLocaleString("en-US");

export const iMoney = (n: number): string =>
  n >= 100000
    ? `$${(n / 1000).toFixed(0)}K`
    : n >= 10000
      ? `$${(n / 1000).toFixed(1)}K`
      : `$${n >= 100 ? Math.round(n).toLocaleString("en-US") : n.toFixed(n < 10 ? 2 : 0)}`;

export const iTok = (n: number): string =>
  n >= 1e9 ? `${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e8 ? 0 : 1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : `${Math.round(n)}`;

export const iShort = (n: number): string => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e4 ? `${Math.round(n / 1e3)}K` : iNum(n));

export const iPct = (x: number): string => `${Math.round(x * 100)}%`;

/** "2026-10-28" → "28.10" */
export const dayLabel = (iso: string): string => {
  const [, month = "0", day = "0"] = iso.split("-");
  return `${Number(day)}.${Number(month)}`;
};

export const pad2 = (n: number): string => String(n).padStart(2, "0");

export const metricFormat = { req: iNum, tok: iTok, cost: iMoney } as const;

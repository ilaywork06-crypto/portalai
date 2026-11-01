import type { CSSProperties } from "react";
import { ICON_PATHS, isIconName, type IconName } from "./iconPaths";

export type { IconName };

const MIRRORED_IN_RTL = new Set<IconName>(["arrowRight", "arrowUpRight", "chevronRight", "chevronLeft", "send"]);

interface IconProps {
  name: IconName;
  size?: number;
  stroke?: number;
  className?: string;
  style?: CSSProperties;
}

export function Icon({ name, size = 18, stroke = 2, className = "", style = {} }: IconProps) {
  const mirrored = MIRRORED_IN_RTL.has(name)
    ? { ...style, transform: `scaleX(-1)${style.transform ? ` ${String(style.transform)}` : ""}` }
    : style;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ flex: "none", ...mirrored }}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: ICON_PATHS[name] }}
    />
  );
}

/** Icons named by data (catalog items, tools) fall back to a neutral glyph if unknown. */
export const iconOr = (value: string, fallback: IconName = "package"): IconName => (isIconName(value) ? value : fallback);

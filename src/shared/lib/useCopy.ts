import { useEffect, useRef, useState } from "react";

/** Copies text and remembers which control did it for `ms`, so it can show "הועתק". */
export function useCopy<K extends string = string>(ms = 1500) {
  const [copied, setCopied] = useState<K | null>(null);
  const timer = useRef<number>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = (text: string, key: K) => {
    copyText(text);
    setCopied(key);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(null), ms);
  };
  return { copied, copy };
}

export function copyText(text: string): void {
  if (window.isSecureContext && "clipboard" in navigator) {
    navigator.clipboard.writeText(text).catch(() => {
      legacyCopy(text);
    });
  } else {
    legacyCopy(text);
  }
}

// The Clipboard API exists only in secure contexts, so the app opened over plain HTTP by IP or host name needs this.
function legacyCopy(text: string): void {
  const focused = document.activeElement;
  const area = Object.assign(document.createElement("textarea"), { value: text, readOnly: true });
  area.style.cssText = "position:fixed;inset-block-start:0;opacity:0;pointer-events:none";
  document.body.appendChild(area);
  area.select();
  try {
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- the only way to copy outside a secure context
    document.execCommand("copy");
  } finally {
    area.remove();
    if (focused instanceof HTMLElement) focused.focus({ preventScroll: true });
  }
}

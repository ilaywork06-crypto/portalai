import { useEffect, useRef } from "react";

// Only the most recently opened layer reacts, so a confirmation on top of a modal closes first.
const layers: (() => void)[] = [];

export function useEscape(onEscape: () => void, active = true): void {
  const handler = useRef(onEscape);
  handler.current = onEscape;

  useEffect(() => {
    if (!active) return;
    const layer = () => handler.current();
    layers.push(layer);
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || layers.at(-1) !== layer) return;
      event.stopPropagation();
      layer();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      layers.splice(layers.lastIndexOf(layer), 1);
    };
  }, [active]);
}

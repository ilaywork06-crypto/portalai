import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { UsageConfig } from "./api";
import { createCalendar, type Calendar } from "./model/calendar";

interface UsageSettings {
  config: UsageConfig;
  calendar: Calendar;
  modelById: (id: string) => UsageConfig["models"][number] | undefined;
  toolById: (id: string) => UsageConfig["tools"][number] | undefined;
}

const Context = createContext<UsageSettings | null>(null);

export function UsageSettingsProvider({ config, children }: { config: UsageConfig; children: ReactNode }) {
  const value = useMemo<UsageSettings>(
    () => ({
      config,
      calendar: createCalendar(config),
      modelById: (id) => config.models.find((m) => m.id === id),
      toolById: (id) => config.tools.find((t) => t.id === id),
    }),
    [config],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useUsageSettings(): UsageSettings {
  const value = useContext(Context);
  if (!value) throw new Error("useUsageSettings must be used inside <UsageSettingsProvider>");
  return value;
}

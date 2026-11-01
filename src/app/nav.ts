import type { IconName } from "@/shared/ui/Icon";

export type Section = "marketplace" | "community" | "usage";

export const NAV: readonly { id: Section; label: string; icon: IconName }[] = [
  { id: "marketplace", label: "מרקטפלייס", icon: "package" },
  { id: "community", label: "קהילה", icon: "users" },
  { id: "usage", label: "נתוני שימוש", icon: "chart" },
];

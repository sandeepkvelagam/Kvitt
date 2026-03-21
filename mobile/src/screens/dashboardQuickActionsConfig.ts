/**
 * Quick actions when the dashboard FAB opens the actions sheet.
 * Pure data for tests and the Dashboard screen.
 */
export type QuickActionId = "schedule" | "startGame" | "ai" | "settlements";

export type QuickActionDef = {
  id: QuickActionId;
  screen: "Scheduler" | "Groups" | "AIAssistant" | "SettlementHistory";
  icon: string;
};

export const QUICK_ACTIONS: readonly QuickActionDef[] = [
  { id: "schedule", screen: "Scheduler", icon: "calendar-outline" },
  { id: "startGame", screen: "Groups", icon: "play-circle-outline" },
  { id: "ai", screen: "AIAssistant", icon: "sparkles-outline" },
  { id: "settlements", screen: "SettlementHistory", icon: "receipt-outline" },
] as const;

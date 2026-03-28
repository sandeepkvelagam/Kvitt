/**
 * Quick actions when the dashboard FAB opens the actions sheet.
 * Pure data for tests and the Dashboard screen.
 */
import type { IconName } from "../components/icons";

export type QuickActionId = "schedule" | "startGame" | "ai" | "settlements";

export type QuickActionDef = {
  id: QuickActionId;
  /** `null` for startGame — opens StartGameModal, not a stack route */
  screen: "Scheduler" | "Groups" | "PokerAI" | "SettlementHistory" | null;
  icon: IconName;
};

export const QUICK_ACTIONS: readonly QuickActionDef[] = [
  { id: "schedule", screen: "Scheduler", icon: "quickActionCalendar" },
  { id: "startGame", screen: null, icon: "quickActionPlay" },
  { id: "ai", screen: "PokerAI", icon: "quickActionSparkles" },
  { id: "settlements", screen: "SettlementHistory", icon: "quickActionReceipt" },
] as const;

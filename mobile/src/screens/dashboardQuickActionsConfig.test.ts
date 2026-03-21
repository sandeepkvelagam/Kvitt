import { QUICK_ACTIONS } from "./dashboardQuickActionsConfig";

describe("dashboardQuickActionsConfig", () => {
  it("defines four quick actions", () => {
    expect(QUICK_ACTIONS).toHaveLength(4);
  });

  it("uses unique screens for each action", () => {
    const screens = QUICK_ACTIONS.map((a) => a.screen);
    expect(new Set(screens).size).toBe(4);
  });

  it("includes scheduler, groups, AI, and settlement history", () => {
    const screens = QUICK_ACTIONS.map((a) => a.screen);
    expect(screens).toContain("Scheduler");
    expect(screens).toContain("Groups");
    expect(screens).toContain("AIAssistant");
    expect(screens).toContain("SettlementHistory");
  });
});

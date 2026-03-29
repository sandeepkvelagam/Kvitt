import { QUICK_ACTIONS } from "./dashboardQuickActionsConfig";

describe("dashboardQuickActionsConfig", () => {
  it("defines four quick actions", () => {
    expect(QUICK_ACTIONS).toHaveLength(4);
  });

  it("uses unique stack targets for navigable actions", () => {
    const screens = QUICK_ACTIONS.map((a) => a.screen).filter((s): s is NonNullable<typeof s> => s != null);
    expect(new Set(screens).size).toBe(screens.length);
  });

  it("includes scheduler, AI, settlement history, and startGame as modal", () => {
    const byId = Object.fromEntries(QUICK_ACTIONS.map((a) => [a.id, a]));
    expect(byId.schedule?.screen).toBe("Scheduler");
    expect(byId.startGame?.screen).toBeNull();
    expect(byId.ai?.screen).toBe("AIAssistant");
    expect(byId.settlements?.screen).toBe("SettlementHistory");
  });
});

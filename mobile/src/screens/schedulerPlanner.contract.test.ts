/**
 * Lightweight contract check: Scheduler calls the plan endpoint expected by the backend.
 */
import * as fs from "fs";
import * as path from "path";

describe("Scheduler planner API contract", () => {
  it("SchedulerScreen posts to /scheduler/plan", () => {
    const file = path.join(__dirname, "SchedulerScreen.tsx");
    const src = fs.readFileSync(file, "utf8");
    expect(src).toContain('"/scheduler/plan"');
    expect(src).toContain("confirmProposal");
  });
});

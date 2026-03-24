# Agent-native Scheduler (design + implementation reference)

This document mirrors the product plan for the intelligent Scheduler surface. Implementation in the repo:

- **Backend:** `POST /api/scheduler/plan` — [backend/routers/scheduler_plan.py](backend/routers/scheduler_plan.py), heuristics in [backend/scheduling_planner.py](backend/scheduling_planner.py)
- **Mobile:** [mobile/src/screens/SchedulerScreen.tsx](mobile/src/screens/SchedulerScreen.tsx) — V3 chrome, intent grid, proposal card, `POST /api/events` on confirm
- **Tests:** [backend/tests/test_scheduling_planner.py](backend/tests/test_scheduling_planner.py), [backend/tests/test_scheduler_plan_router.py](backend/tests/test_scheduler_plan_router.py)

## Product framing

Turn Scheduler into an **agent-style planning surface**: **intent → proposal → confirm → execute**. Intelligence before the full form; **Adjust** opens the existing customize flow.

## Phases (as shipped in this change)

1. **V3 visual baseline** — `COLORS.jetDark` / `colors.contentBg`, hero gradient, `appleCardShadowResting`, `APPLE_TYPO`, 44pt targets, `RADIUS.sheet` modals, `Pressable` feedback, template tiles without negative-margin header hacks.
2. **Plan API + UI** — Five intents; proposal card with **Confirm & Send** and **Adjust**; execution via existing events API.
3. **Default group + draft** — `AsyncStorage` last group id; draft persisted on successful plan for **Resume draft**.
4. **Automations** — Row navigates to **Automations** (Smart flows).

## Apple HIG alignment (UI)

- Context first (group row), then time-relevant content (Upcoming), then primary actions (Plan).
- Minimum touch targets 44pt on chips, list rows, and CTAs.
- One clear primary per surface (Confirm & Send on proposal card).
- Grouped cards with consistent padding (`LAYOUT.screenPadding`) and resting shadows.

## Orchestrator note

The MVP planner uses **deterministic heuristics** plus the **last scheduled event** for the group. It can later call **GamePlannerAgent** or the assistant orchestrator without changing the mobile contract.

# Mobile tests (Jest)

## Where tests live

- **Config:** [`jest.config.cjs`](jest.config.cjs)
- **React Native stub:** [`jest/react-native-mock.js`](jest/react-native-mock.js) (only `Platform` + `StyleSheet` for node tests)
- **Tests:** colocated as `*.test.ts` under `src/` (not a separate `__tests__` folder right now)

Current files:

| File | What it checks |
|------|----------------|
| [`src/styles/appleShadows.test.ts`](src/styles/appleShadows.test.ts) | Apple-style shadow helpers |
| [`src/screens/dashboardQuickActionsConfig.test.ts`](src/screens/dashboardQuickActionsConfig.test.ts) | Quick-action config shape |

They run in **Node** (not a device/simulator). No Expo dev server required.

## Commands

From the `mobile/` directory:

```bash
# One-off run (uses local Jest from node_modules — prefer this over npx)
yarn test

# Watch mode (keeps running; use when iterating on tests)
yarn test:watch

# CI-style
yarn test:ci
```

Avoid `npx jest` if it feels stuck: `npx` can add startup delay or hit network. Use **`yarn test`** so the project’s installed `jest` runs directly.

## If tests feel “running forever”

1. **Watch mode** — `jest --watch` never exits until you press `q`. Use `yarn test` for a single run.
2. **Windows + workers** — config uses **`maxWorkers: 1`** locally so Jest doesn’t spawn many child processes (which sometimes hang with no output).
3. **First run** — `ts-jest` still has a compile step; later runs use Jest’s cache and are quicker.
4. **Type-check** — `tsconfig.json` has `isolatedModules: true` so `ts-jest` compiles quickly; run `npx tsc --noEmit` when you want a full project type-check.

## Adding tests

1. Add `something.test.ts` next to the code (or under the same feature folder).
2. Keep imports light; mock `react-native` via `jest.config.cjs` if you only need `Platform` / `StyleSheet`.
3. For components/screens, consider **React Native Testing Library** + **jest-expo** later — not set up yet.

---
name: Groups tab Apple refresh
overview: Refresh GroupsScreen with Apple-oriented patterns (theme tokens, Typography, hero gradient, cards, bottom dock). Restore the trailing FAB next to the tab bar on Groups—currently suppressed in BottomTabBar; recommended fix is hoisting quick actions so the FAB matches Home behavior app-wide.
todos:
  - id: shell-header
    content: Add hero gradient + Title1 header row + Invites trailing control; align root background with Chats pattern
  - id: cards-list
    content: Refactor section cards and group rows to colors + tokens + Typography + appleCardShadowResting; ScrollView + RefreshControl
  - id: bottom-dock
    content: Restyle bottom dock (tab bar clearance) and Create Group modal (RADIUS.sheet, colors.surface, BUTTON_SIZE)
  - id: tab-fab-groups
    content: Show trailing FAB on Groups tab; wire press so quick actions work (hoist overlay to MainTabNavigator) or document fallback
  - id: skeleton
    content: Update GroupsSkeleton to tokens + screen padding / card radii consistent with new layout
isProject: true
---

# Groups tab — Apple design + token alignment + tab-bar FAB

## Scope

- **In scope:** [mobile/src/screens/GroupsScreen.tsx](mobile/src/screens/GroupsScreen.tsx) (tab **Groups**), and **tab bar** behavior in [mobile/src/components/BottomTabBar.tsx](mobile/src/components/BottomTabBar.tsx) for the missing FAB.
- **Likely shared change:** [mobile/src/navigation/MainTabNavigator.tsx](mobile/src/navigation/MainTabNavigator.tsx) if quick actions overlay is **hoisted** (recommended).
- **Out of scope unless requested:** [mobile/src/screens/GroupHubScreen.tsx](mobile/src/screens/GroupHubScreen.tsx), [mobile/src/screens/GroupChatScreen.tsx](mobile/src/screens/GroupChatScreen.tsx).

## Why the FAB is missing on Groups

In [mobile/src/components/BottomTabBar.tsx](mobile/src/components/BottomTabBar.tsx), trailing slot is chosen as:

- **Chats** → `"search"`
- **Home** → `"fab"` (opens quick actions via `onQuickActionsToggle`)
- **Everything else** (including **Groups**) → `"none"` → renders `fabPlaceholder` (empty space)

So the **+ FAB** never appears on Groups by design today.

**Important constraint:** Quick actions **UI** is implemented **inside** [mobile/src/screens/DashboardScreenV3.tsx](mobile/src/screens/DashboardScreenV3.tsx) (`quickOverlayRoot`, full-screen dim + grid). When **Groups** is the active tab, that overlay is **behind** the Groups screen in the tab stack, so simply setting `trailingMode === "fab"` for Groups and calling `onQuickActionsToggle()` would **not** reliably show the sheet above Groups.

## FAB fix — recommended vs minimal

### Recommended: hoist quick actions overlay

1. **Extract** the quick-actions overlay block (dim + `Pressable` dismiss + animated panel + grid) from `DashboardScreenV3` into a dedicated component, e.g. `QuickActionsOverlay.tsx`, driven by **`useHomeQuickActions()`** and `navigation` for tile presses.
2. **Render** that component in [mobile/src/navigation/MainTabNavigator.tsx](mobile/src/navigation/MainTabNavigator.tsx) as a **sibling above** the tab navigator content (same provider tree as today — `HomeQuickActionsContext` already wraps the navigator).
3. **Remove** the duplicate overlay from `DashboardScreenV3` (keep `quickActionsMounted` / animation hooks only if still needed for perf, or move hooks into the extracted component).
4. **Update** `trailingMode` so **`activeTab === "Home" || activeTab === "Groups"`** uses `"fab"` (and keep Chats as `"search"`).
5. **`onTrailingPress`:** unchanged for `fab` — still `onQuickActionsToggle()`; overlay is now global so it appears on top of whichever tab is active.

### Minimal (not recommended)

- Set Groups to `"fab"` without hoisting: **broken UX** (toggle state changes but overlay stays hidden under Groups).
- **Alternative minimal:** Groups FAB performs a **different** action (e.g. navigate to `AIAssistant` or open create-group via **navigation params** + `GroupsScreen` listener). That restores a **button** but **does not** match Home’s quick-actions menu unless product accepts that.

## Groups screen refresh (design system)

### Current gaps

- Heavy **`getThemedColors` (`lc`)** + liquid-glass double frames; many **magic numbers** instead of [mobile/src/styles/tokens.ts](mobile/src/styles/tokens.ts).
- Raw **`Text`** instead of **Typography** ([mobile/src/components/ui/Typography.tsx](mobile/src/components/ui/Typography.tsx)).
- No **hero gradient** / **Title1** row like [mobile/src/screens/ChatsScreen.tsx](mobile/src/screens/ChatsScreen.tsx).
- Ad-hoc shadows vs [mobile/src/styles/appleShadows.ts](mobile/src/styles/appleShadows.ts).
- Create modal: align **top radius** with **`RADIUS.sheet`**, **`colors.surface`**.

### Target patterns

| Area | Reference | Apply on Groups |
|------|-----------|-----------------|
| Root + gradient | `ChatsScreen` | `LinearGradient` + `PAGE_HERO_GRADIENT` / `pageHeroGradientColors` |
| Title row | `ChatsScreen` | `Title1` + `t.nav.groups`; **Invites** as trailing pill (`colors.inputBg`, `colors.border`, `LAYOUT.touchTarget`) |
| Cards | Dashboard / Chats cards | `colors.surface` / `surfaceBackground`, `colors.border`, `RADIUS.lg`/`xl`, `appleCardShadowResting(isDark)` |
| Typography | UI components | `Label` / `Headline` / `Subhead` / `Caption` for sections and rows |
| Bottom CTAs | `ChatsScreen` `bottomDock` | `TAB_BAR_RESERVE_BASE`, frosted dock + hairline; after FAB hoist, avoid duplicating “AI Chat” if quick actions covers it — **reconcile** with existing labeled FABs on `GroupsScreen` |

### Scroll / refresh

- Prefer **one** `ScrollView` + `RefreshControl` (or single list with header) instead of nested `FlatList` with `scrollEnabled={false}`.

### Skeleton

- [mobile/src/components/ui/GroupsSkeleton.tsx](mobile/src/components/ui/GroupsSkeleton.tsx): use **`LAYOUT.screenPadding`**, **`RADIUS`** from tokens, theme-aligned surfaces so it matches the new cards.

## Files to touch (summary)

| File | Changes |
|------|---------|
| [mobile/src/components/BottomTabBar.tsx](mobile/src/components/BottomTabBar.tsx) | `trailingMode` includes Groups for `fab` |
| [mobile/src/navigation/MainTabNavigator.tsx](mobile/src/navigation/MainTabNavigator.tsx) | Mount hoisted `QuickActionsOverlay` (if recommended path) |
| New: `QuickActionsOverlay.tsx` (under `mobile/src/components/`) | Extracted overlay + hooks from Dashboard |
| [mobile/src/screens/DashboardScreenV3.tsx](mobile/src/screens/DashboardScreenV3.tsx) | Remove overlay JSX; keep grid config import or move |
| [mobile/src/screens/GroupsScreen.tsx](mobile/src/screens/GroupsScreen.tsx) | Full visual/token pass + bottom dock reconciliation |
| [mobile/src/components/ui/GroupsSkeleton.tsx](mobile/src/components/ui/GroupsSkeleton.tsx) | Tokens + layout parity |

## Verification

- **Groups** tab: trailing **+** FAB visible and **opens quick actions** above Groups (after hoist).
- Light/dark, create-group sheet, pull-to-refresh, empty/error/loaded, favorites block.
- **Home** tab: FAB still opens/closes quick actions; no regression to Chats search pill.

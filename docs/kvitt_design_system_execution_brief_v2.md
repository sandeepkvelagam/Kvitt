# Kvitt Mobile Design System Execution Brief v2

## Purpose

This is the final Claude-ready execution brief for the Kvitt mobile design system rollout.

This version replaces the earlier implementation draft and resolves the key architectural risks.

The goal is to implement a production-grade mobile design system in a controlled way, without creating new inconsistency or introducing parallel systems.

This brief is focused on execution.

---

# 1. Executive Direction

Claude must implement a full mobile design system migration for Kvitt based on the approved mobile design spec.

This work must follow these confirmed decisions:

* navTitle = 18 / 600
* cardTitle = 18 / 500
* 17 is removed entirely from the approved type scale
* GlassButton must be updated directly, not replaced with a wrapper
* GlassButton must support legacy size mapping during migration
* GlassSurface radius = outer 24 / inner 16
* GlassModal radius = 24
* rollout must be phased
* Stage A = foundation + high-traffic screens
* Stage B = remaining screens tracked and migrated later

This is not a random cleanup.
This is a controlled design system rollout.

---

# 2. Critical Architectural Rules

## Rule 1 — One canonical token source only

Canonical file: `mobile/src/styles/tokens.ts`

This file is the single source of truth for:

* typography
* spacing
* layout spacing semantics
* radius
* button sizes
* avatar sizes
* action colors
* touch target rules

`liquidGlass.ts` must:

* import and consume values from `tokens.ts`, or
* be reduced to visual-effect constants only (blur, shadows, gradients, animation, springs, glass effects)

It must not remain a second source of truth for typography, spacing, radius, or sizing.

---

## Rule 2 — Semantic mapping, not blind numeric replacement

Do not replace values only by nearest number.

Every off-scale value must be mapped by semantic role.

Examples:

* `13` does not always become `14`
* `22` does not always become `24`
* `20` does not always become `18`

Each replacement must map to:

* an approved token
* a semantic text role
* an approved component variant
* or a documented exception

No blind search-and-replace across the codebase.

---

## Rule 3 — No parallel button systems

Do not create `AppButton` or any second button component.

Update `GlassButton` directly so it becomes the canonical button primitive.

Legacy size names may be supported temporarily through mapping.

---

## Rule 4 — Canonical dashboard decision

`DashboardScreenV2.tsx` is the canonical live dashboard.

Other dashboard files (`DashboardScreen.tsx`, `DashboardLiquidGlassScreen.tsx`) are legacy/experimental.

Stage A migrates canonical dashboard only. Others are Stage B.

---

# 3. Final Approved Design Tokens

## Typography

```ts
export const FONT = {
  screenTitle:  { size: 24, weight: '700' as const },
  navTitle:     { size: 18, weight: '600' as const },
  cardTitle:    { size: 18, weight: '500' as const },
  body:         { size: 16, weight: '400' as const },
  bodyStrong:   { size: 16, weight: '600' as const },
  secondary:    { size: 14, weight: '400' as const },
  sectionLabel: { size: 12, weight: '600' as const },
  meta:         { size: 12, weight: '500' as const },
  micro:        { size: 11, weight: '500' as const },
} as const;
```

### Section label rule

Section headers must use one pattern only:

* size: 12
* weight: 600
* letterSpacing: 1
* uppercase: yes

### Banned font sizes

`9, 10, 13, 15, 17, 19, 20, 22`

Exception rule: Hero/KPI/game-specific values may exist only if explicitly documented.

---

## Spacing

```ts
export const SPACE = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;
```

```ts
export const LAYOUT = {
  screenPadding: 20,
  sectionGap: 24,
  cardPadding: 16,
  elementGap: 12,
  touchTarget: 44,
} as const;
```

### Banned spacing values

`14, 18, 22, 28`

---

## Radius

```ts
export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;
```

### Radius hierarchy

* chips = 8
* buttons and inputs = 12
* cards = 16
* surfaces and modals = 24

### Banned radius values

`14, 18, 20, 28, 32`

---

## Button sizes

```ts
export const BUTTON_SIZE = {
  compact: { height: 44 },
  regular: { height: 52 },
  large:   { height: 56 },
} as const;
```

Legacy mapping: small -> compact, medium -> regular, large -> large

---

## Avatar sizes

```ts
export const AVATAR_SIZE = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 56,
  xl: 72,
} as const;
```

---

## Action colors

```ts
export const ACTION_COLOR = {
  primary: '#C45A22',          // orangeDark
  primaryPressed: '#A34B1B',   // orangeDark darkened
  secondary: '#3B82F6',        // trustBlue
  secondaryPressed: '#2563EB', // trustBlue darkened
  tertiary: 'transparent',
  destructive: '#EF4444',      // status.danger
} as const;
```

### Color hierarchy

* primary button = dark orange
* secondary button = blue or blue-tinted style
* tertiary = neutral / glass / text treatment
* destructive = red only when semantically required

---

# 4. Primitive Component Architecture

## 4.1 AppText — `mobile/src/components/ui/AppText.tsx`

Supported variants: screenTitle, navTitle, cardTitle, body, bodyStrong, secondary, sectionLabel, meta, micro

Maps directly to `FONT` tokens. Do not allow arbitrary `fontSize` in migrated files.

## 4.2 SectionHeader — `mobile/src/components/ui/SectionHeader.tsx`

Locked pattern: 12 / 600 / letterSpacing=1 / uppercase

## 4.3 GlassButton — `mobile/src/components/ui/GlassButton.tsx`

Variants: primary, secondary, tertiary, destructive
Sizes: compact (44), regular (52), large (56)
borderRadius: 12 (RADIUS.md)
Colors mapped to ACTION_COLOR

## 4.4 GlassSurface — `mobile/src/components/ui/GlassSurface.tsx`

outer radius = 24 (RADIUS.xl), inner radius = 16 (RADIUS.lg), inner padding = 16 (LAYOUT.cardPadding)

## 4.5 GlassModal — `mobile/src/components/ui/GlassModal.tsx`

borderRadius = 24 (RADIUS.xl)

## 4.6 GlassInput — `mobile/src/components/ui/GlassInput.tsx`

borderRadius = 12 (RADIUS.md)

## 4.7 LiquidGlassPopup — `mobile/src/components/ui/LiquidGlassPopup.tsx`

borderRadius = RADIUS.lg (16), padding = LAYOUT.cardPadding / SPACE tokens

## 4.8 PageHeader — `mobile/src/components/ui/PageHeader.tsx`

title = FONT.navTitle, subtitle = FONT.meta, touch targets = LAYOUT.touchTarget

---

# 5. Migration Rules Per File

Every migrated screen must:

1. Import and use `FONT`, `SPACE`, `LAYOUT`, `RADIUS`, or semantic primitives
2. Avoid new raw `fontSize`, `padding`, `borderRadius`, and control heights unless documented exception
3. Map values by semantic role, not by nearest number
4. Replace raw text styling with `AppText` where appropriate
5. Replace raw spacing with token references
6. Replace raw radius with token references
7. Use semantic component variants where possible
8. Document exceptions (hero stats, poker/game visuals, emoji, special badges)

---

# 6. Stage A — Complete (Foundation + Core Screens)

### Foundation (Done)
- tokens.ts created
- liquidGlass.ts refactored to consume tokens
- AppText.tsx created
- SectionHeader.tsx created
- GlassButton, GlassSurface, GlassModal, GlassInput updated
- LiquidGlassPopup wired to tokens
- PageHeader wired to tokens
- ThemeContext cleaned up

### Core Screen Migration (Done)
- DashboardScreenV2.tsx — canonical dashboard, migrated with token references
- GroupsScreen.tsx — migrated with token references
- ChatsScreen.tsx — migrated with token references
- SettingsScreen.tsx — migrated with token references
- ProfileScreen.tsx — clean (no violations)

---

# 7. Stage B — Remaining Screens

## Batch 1 — Medium Priority (high-traffic secondary screens)

| Screen | Status |
|--------|--------|
| GameNightScreen.tsx | Migrated |
| GroupHubScreen.tsx | Migrated |
| NotificationsScreen.tsx | Pending |
| RequestAndPayScreen.tsx | Pending |
| SettlementScreen.tsx | Pending |
| SettlementHistoryScreen.tsx | Pending |

## Batch 2 — Medium Priority (feature screens)

| Screen | Status |
|--------|--------|
| AIAssistantScreen.tsx | Pending |
| AutomationsScreen.tsx | Pending |
| BillingScreen.tsx | Pending |
| LanguageScreen.tsx | Pending |
| PrivacyScreen.tsx | Pending |
| PendingRequestsScreen.tsx | Pending |
| WalletScreen.tsx | Pending |

## Batch 3 — Low Priority (legacy/experimental + components)

| Screen | Status |
|--------|--------|
| DashboardScreen.tsx (legacy) | Pending |
| DashboardLiquidGlassScreen.tsx (experimental) | Pending |
| CreateAutomationSheet.tsx | Pending |
| OnboardingAgent.tsx | Pending |
| AppDrawer.tsx | Migrated |
| RightDrawer.tsx | Migrated |
| Screen.tsx | Migrated |

---

# 8. Stage B Migration Mapping Rules

### Typography
* `9` or `10` -> `micro(11)` or `meta(12)` by role
* `13` -> `sectionLabel(12)` or `secondary(14)` by role
* `15` -> `body(16)` or `secondary(14)` by role
* `17` -> `navTitle/cardTitle(18)` by role
* `20` -> `18` only if not hero/stat exception
* `22` -> `screenTitle(24)` or documented hero/stat exception

### Spacing
* `14` -> `SPACE.md(12)` or `SPACE.lg(16)` by semantic role
* `18` -> `SPACE.lg(16)` or `SPACE.xl(20)` by semantic role
* `22` -> `SPACE.xxl(24)`
* `28` -> `SPACE.xxl(24)` or `SPACE.xxxl(32)` by semantic role

### Radius
* `14` -> `RADIUS.md(12)`
* `20` -> `RADIUS.lg(16)`
* `28` -> `RADIUS.xl(24)`
* `32` -> `RADIUS.xl(24)`

### Buttons and controls
* `40` -> `44` (LAYOUT.touchTarget)
* `48` -> `52` (BUTTON_SIZE.regular)

---

# 9. Verification Requirements

After each batch:

1. `cd mobile && npx tsc --noEmit` — zero type errors
2. Search for banned spacing values in migrated files
3. Search for raw `fontSize:` not using FONT tokens in migrated files
4. Confirm token imports present in every migrated file
5. No broken layouts
6. Before/after screenshots of migrated screens

---

# 10. Success Criteria

This rollout is successful only if:

* `tokens.ts` is the one source of truth
* no parallel styling systems remain active
* `GlassButton` is the only button primitive
* action color hierarchy is consistent across screens
* core screens feel like one product
* Stage B is clearly tracked and ready
* banned raw values no longer appear in migrated files
* every migrated file uses actual token references, not raw numbers
* the app feels cleaner, calmer, and more premium

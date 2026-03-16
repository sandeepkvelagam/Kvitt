# Mobile Design System Audit & Apple-Inspired Migration Plan

## Context

The Kvitt mobile app has grown organically, resulting in inconsistent visual styling across screens. The current design system mixes brand orange (#EE6C29), trust blue (#3B82F6), neon accents, and random grays — creating a UI that feels unfocused. The goal is to migrate toward a disciplined, Apple-inspired grayscale-first design system where same role = same size/weight/color on every screen, accent colors are restricted to semantic states only, and light/dark modes are parallel systems.

**Key insight**: The `OnboardingShell` (`OB` palette) already implements the target Apple style — black text, white backgrounds, black CTA buttons, gray secondary text, zero accent colors. This is our reference point inside the codebase.

**User decisions**:
- Brand orange (#EE6C29): **Logo SVG only** — remove from all UI elements (buttons, glows, accents, avatars)
- Glass morphism: **Keep** blur effects and LiquidGlass native support — shift all tint/glow colors to neutral grayscale

---

## 1. Executive Summary of Current State

### What exists today
| File | Role | Status |
|------|------|--------|
| `mobile/src/styles/tokens.ts` | Canonical FONT, SPACE, RADIUS, BUTTON_SIZE, ACTION_COLOR | Good foundation but ACTION_COLOR uses orange/blue |
| `mobile/src/styles/liquidGlass.ts` | COLORS, SHADOWS, TYPOGRAPHY (legacy), SPACING (legacy), component styles | **Two competing systems** — TYPOGRAPHY/SPACING duplicate tokens.ts |
| `mobile/src/context/ThemeContext.tsx` | Light/dark color definitions, useTheme() hook | Cream background (#F5F3EF), needs shift to cleaner white |
| `mobile/src/components/ui/` | AppText, GlassButton, GlassSurface, GlassInput, GlassListItem, etc. | Well-structured but colors are orange/blue-heavy |
| `mobile/src/components/ui/OnboardingShell.tsx` | OB palette with clean black/white Apple style | **This IS the target** — should become the app-wide pattern |

### Critical problems
1. **Two typography systems**: `FONT` (tokens.ts) vs `TYPOGRAPHY` (liquidGlass.ts) — screens use both
2. **Two spacing systems**: `SPACE` (tokens.ts) vs `SPACING` (liquidGlass.ts) — same problem
3. **Color explosion**: orange, blue, moonstone, AI pinks, purple (#7C3AED, #7848FF), cyan (#06B6D4) scattered across screens
4. **DashboardScreenV3**: 80+ hardcoded violations, zero theme support, own CARD constant
5. **ACTION_COLOR.primary = orange** (#C45A22) — buttons are orange instead of black/white
6. **Light theme background is cream** (#F5F3EF) not clean off-white
7. **GlassListItem uses COLORS.text (dark-only values)** in StyleSheet.create — broken in light mode unless overridden

---

## 2. Typography Audit

### Current inventory (all font sizes found)

| Size | Weight | Where defined | Where used | Token name |
|------|--------|---------------|------------|------------|
| 56 | 800 | Hardcoded | DashboardScreenV3 heroNum | — (banned) |
| 40 | 800 | Hardcoded | DashboardScreenV3 splitBig | — (banned) |
| 28 | — | liquidGlass.ts TYPOGRAPHY.heading1 | Not widely used | heading1 |
| 26 | 800 | Hardcoded | DashboardScreenV3 logoText/logoEmoji | — (banned) |
| 24 | 700 | tokens.ts FONT.screenTitle | AppText, multiple screens | screenTitle |
| 22 | 800 | Hardcoded | DashboardScreenV3 triVal | — (banned) |
| 21 | 700 | Hardcoded | DashboardScreenV3 welcomeH1 | — (banned) |
| 20 | 800 | Hardcoded | DashboardScreenV3 sectionH2 | — (banned) |
| 18 | 600/500 | tokens.ts FONT.navTitle/cardTitle | AppText, headers, list items | navTitle/cardTitle |
| 17 | 600/700 | Hardcoded | OnboardingShell CTA, DashboardScreenV3 | — (banned) |
| 16 | 400/600 | tokens.ts FONT.body/bodyStrong | AppText, inputs, many screens | body/bodyStrong |
| 15 | 500 | Hardcoded | DashboardScreenV3 heroLabel | — (banned) |
| 14 | 400/600 | tokens.ts FONT.secondary | AppText, list items, game rows | secondary |
| 13 | 600/700 | Hardcoded | DashboardScreenV3 aiBarBtnText, heroStatText | — (banned) |
| 12 | 600/500 | tokens.ts FONT.sectionLabel/meta | Section headers, labels, captions | sectionLabel/meta |
| 11 | 500/700/800 | tokens.ts FONT.micro + hardcoded | Micro text, overlines, badges | micro |
| 10 | — | Hardcoded | BottomTabBar tab labels | — (banned) |
| 9 | 800 | Hardcoded | DashboardScreenV3 liveBadgeText | — (banned) |

### Proposed unified typography system

| Token | Size | Weight | Line Height | Letter Spacing | Use |
|-------|------|--------|-------------|----------------|-----|
| `displayLg` | 34 | 700 | 1.15 | -0.5 | Hero numbers, large stats |
| `displayMd` | 28 | 700 | 1.2 | -0.3 | Dashboard headlines |
| `headingXl` | 24 | 700 | 1.25 | -0.2 | Screen titles |
| `headingLg` | 20 | 600 | 1.3 | 0 | Section headings |
| `headingMd` | 18 | 600 | 1.3 | 0 | Nav titles, card headers |
| `titleLg` | 18 | 500 | 1.35 | 0 | Card titles |
| `titleMd` | 16 | 600 | 1.4 | 0 | Emphasized body, strong labels |
| `bodyLg` | 16 | 400 | 1.5 | 0 | Primary body text |
| `bodyMd` | 14 | 400 | 1.45 | 0 | Secondary body text |
| `bodySm` | 12 | 400 | 1.4 | 0 | Small body text |
| `caption` | 12 | 500 | 1.35 | 0.3 | Metadata, timestamps |
| `button` | 16 | 600 | 1 | 0 | Button labels |
| `label` | 12 | 600 | 1 | 1 | Section labels (uppercase) |
| `tabLabel` | 11 | 500 | 1 | 0.2 | Tab bar labels |

---

## 3. Color Audit

### Every color currently used

#### Brand / Primary
| Color | Hex | Where | Classification | Action |
|-------|-----|-------|---------------|--------|
| Kvitt Orange | #EE6C29 | ThemeContext, liquidGlass, buttons, glows | Brand primary | **Remove from UI** — logo SVG only |
| Orange Dark | #C45A22 | ACTION_COLOR.primary, button bg | Action primary | **Replace** with grayscale button |
| Trust Blue | #3B82F6 | ACTION_COLOR.secondary, links, scheduler | Brand accent | **Remove** — use semantic.info (#007AFF) for info states only |
| Moonstone | #7AA6B3 | ThemeContext, labels | Decorative | **Remove** |

#### Status / Semantic
| Color | Hex | Where | Action |
|-------|-----|-------|--------|
| Success Green | #22C55E | Positive values, active states | **Keep** — semantic only |
| Danger Red | #EF4444 | Errors, negative values | **Keep** — semantic only |
| Warning Amber | #F59E0B | Warnings | **Keep** — semantic only |
| Info Blue | #3B82F6 | Same as trustBlue | **Keep** — semantic only |

#### One-off / Rogue colors
| Color | Hex | Where | Action |
|-------|-----|-------|--------|
| AI Purple | #7C3AED | DashboardScreenV3 AI icon | **Remove** |
| Confetti Purple | #7848FF | PokerAIScreen confetti | **Remove** |
| Hot Pink | #FF6EA8 | AI gradient | **Remove** from UI, keep for AI-only |
| Warm Orange | #FF8C42 | AI gradient | **Remove** from UI, keep for AI-only |
| Cyan | #06B6D4 | FeedbackScreen status | **Replace** with gray |
| Dark Purple | #9333EA | FeedbackScreen status | **Replace** with gray |
| Avatar Blue | #5B8DEF | ReferralScreen avatars | **Replace** with grayscale |
| Avatar Green | #4ADE80 | ReferralScreen avatars | **Replace** with grayscale |
| Light Purple bg | #F3F0FF, #EEECF4 | DashboardScreenV3 rings | **Replace** with gray |
| Cream bg | #F5F3EF | ThemeContext light bg | **Replace** with #F8F8FA |

### Proposed grayscale color token system

```
LIGHT THEME                          DARK THEME
─────────────────────────────────    ─────────────────────────────────
bg.primary:       #FFFFFF            bg.primary:       #000000
bg.secondary:     #F8F8FA            bg.secondary:     #1C1C1E
bg.tertiary:      #F2F2F7            bg.tertiary:      #2C2C2E

surface.primary:  #FFFFFF            surface.primary:  #1C1C1E
surface.secondary:#F2F2F7            surface.secondary:#2C2C2E
surface.elevated: #FFFFFF            surface.elevated: #2C2C2E

text.primary:     #1A1A1A            text.primary:     #F5F5F7
text.secondary:   #6E6E73            text.secondary:   #98989F
text.tertiary:    #AEAEB2            text.tertiary:    #636366
text.inverse:     #FFFFFF            text.inverse:     #1A1A1A

border.subtle:    rgba(0,0,0,0.04)   border.subtle:    rgba(255,255,255,0.06)
border.default:   rgba(0,0,0,0.08)   border.default:   rgba(255,255,255,0.10)
border.strong:    rgba(0,0,0,0.15)   border.strong:    rgba(255,255,255,0.18)

fill.primary:     #1A1A1A            fill.primary:     #F5F5F7
fill.secondary:   #E5E5EA            fill.secondary:   #3A3A3C
fill.disabled:    #D1D1D6            fill.disabled:    #48484A

button.primary.bg:     #1A1A1A       button.primary.bg:     #F5F5F7
button.primary.text:   #FFFFFF       button.primary.text:   #1A1A1A
button.secondary.bg:   transparent   button.secondary.bg:   transparent
button.secondary.text: #1A1A1A       button.secondary.text: #F5F5F7
button.secondary.border: #D1D1D6    button.secondary.border: #48484A

input.bg:         #F2F2F7            input.bg:         #2C2C2E
input.border:     #D1D1D6            input.border:     #48484A
input.text:       #1A1A1A            input.text:       #F5F5F7
input.placeholder:#AEAEB2            input.placeholder:#636366

icon.primary:     #1A1A1A            icon.primary:     #F5F5F7
icon.secondary:   #8E8E93            icon.secondary:   #636366

── SEMANTIC (SAME BOTH THEMES) ──
semantic.success:    #34C759
semantic.warning:    #FF9F0A
semantic.error:      #FF3B30
semantic.info:       #007AFF
```

---

## 4. Component Consistency Audit

### GlassButton (`components/ui/GlassButton.tsx`)
- **Problem**: Primary variant = orange (#C45A22), secondary = blue (#3B82F6). Target wants black/white.
- **Fix**: primary → `colors.button.primary.bg` (black in light, white in dark), text → `colors.button.primary.text`. Secondary → outlined with border. Keep `destructive` as red.
- **Keep**: Spring animation system, size tokens, border radius.

### GlassInput (`components/ui/GlassInput.tsx`)
- **Problem**: Focus border = orange (#EE6C29). Static StyleSheet uses `COLORS.input.bg` (dark-only).
- **Fix**: Focus border → `colors.fill.primary` (black in light, white in dark). Move all colors to theme-aware values.

### GlassSurface (`components/ui/GlassSurface.tsx`)
- **Problem**: Static `COLORS.glass.*` values in StyleSheet. Works with blur overlay but base colors are dark-only.
- **Fix**: Inner bg should use theme colors. Glass border opacity is fine.
- **Keep**: Blur system, LiquidGlass native support, two-layer architecture.

### GlassListItem (`components/ui/GlassListItem.tsx`)
- **Problem**: Uses `COLORS.text.primary` (hardcoded #F5F5F5 dark), `TYPOGRAPHY.sizes.*`, `SPACING.*` — all from liquidGlass.ts legacy system.
- **Fix**: Switch to `FONT` from tokens.ts. Make colors theme-aware.

### AppText (`components/ui/AppText.tsx`)
- **Problem**: Missing variants (displayLg, displayMd, headingLg, caption, button, label, tabLabel). No default color from theme.
- **Fix**: Add all 14 typography variants. Add default theme-aware color per variant.

### BottomTabBar (`components/BottomTabBar.tsx`)
- **Problem**: Hardcoded colors (#8E8E93, #000000, #EE6C29 avatar, #1C1C1E FAB). Not theme-aware.
- **Fix**: Use theme tokens. Tab inactive = `icon.secondary`, active = `icon.primary`. FAB = `button.primary.bg`.

### OnboardingShell (`components/ui/OnboardingShell.tsx`)
- **Status**: Already implements target style. Use as reference.
- **Action**: Extract OB palette into the main theme system.

### Card (`components/ui/Card.tsx`)
- **Problem**: Uses `colors.glassBorder` — fine for dark mode but border might be too subtle in light.
- **Fix**: Use `colors.border.default` from new token system.

---

## 5. Screen Audit — Priority Ranking

### Top 15 screens to fix (ranked by visual impact)

| # | Screen | Issues | Effort |
|---|--------|--------|--------|
| 1 | **DashboardScreenV3** | 80+ hardcoded values, no theme, own CARD constant, banned font sizes | High |
| 2 | **SettingsScreen** | Uses theme but inline colors, hardcoded icon colors | Medium |
| 3 | **ProfileScreen** | Hardcoded danger zone colors, inline opacity concatenation | Medium |
| 4 | **GroupHubScreen** | Mixed token usage, orange accents | Medium |
| 5 | **WalletScreen** | Custom `tc` object duplicating theme, inline glass colors | Medium |
| 6 | **GameNightScreen** | Orange glow, status colors, mixed font sizes | Medium |
| 7 | **PokerAIScreen** | Confetti colors (#7848FF), card suit colors, AI gradients | Medium |
| 8 | **FeedbackScreen** | Custom STATUS_META with purple/cyan, mixed token usage | Low |
| 9 | **SchedulerScreen** | Quick tile colors (orange/green/blue per game type) | Medium |
| 10 | **AIAssistantScreen** | AI gradient orb, inline styles | Medium |
| 11 | **ChatsScreen** | Mostly compliant but uses getThemedColors indirection | Low |
| 12 | **GroupsScreen** | Mostly compliant, some inline color usage | Low |
| 13 | **ReferralScreen** | Custom avatar colors (#5B8DEF, #4ADE80), inline styles | Low |
| 14 | **NotificationsScreen** | Minor inline colors | Low |
| 15 | **BillingScreen** | Mixed styling patterns | Low |

---

## 6. Dark Mode / Light Mode Audit

### What changes today
- ThemeContext provides LIGHT_COLORS vs DARK_COLORS — 40+ color tokens swap
- `getThemedColors(isDark, colors)` in liquidGlass.ts maps glass/liquid colors per theme
- GlassSurface blur tint and overlay changes per theme
- GlassHeader background opacity changes per theme
- LiquidGlassPopup glass/backdrop colors change per theme

### Where it's broken
| Issue | Screens | Fix |
|-------|---------|-----|
| `COLORS.text.primary` is #F5F5F5 (dark) used in static StyleSheets | GlassListItem, GlassInput label/error styles | Make dynamic via `colors` prop or theme hook |
| DashboardScreenV3 is light-only hardcoded | DashboardScreenV3 | Full rewrite with theme support |
| BottomTabBar colors hardcoded for light only | BottomTabBar | Use theme tokens |
| WalletScreen custom `tc` object | WalletScreen | Use theme context directly |
| `ACTION_COLOR` is static (not theme-aware) | GlassButton, any screen using ACTION_COLOR | Make button colors theme-aware |

### Proposed fix
Replace the flat color objects in ThemeContext with the structured token system above. The `useTheme()` hook returns `colors` which already swaps light/dark — we just need to restructure the shape.

---

## 7. Hardcoded Style Violations — Top 20

| # | File | Component | Violation | Replace with |
|---|------|-----------|-----------|-------------|
| 1 | DashboardScreenV3.tsx:409 | root | `backgroundColor: "#F8F8F6"` | `colors.bg.primary` |
| 2 | DashboardScreenV3.tsx:468 | heroNum | `fontSize: 56, fontWeight: "800"` | `FONT.displayLg` |
| 3 | DashboardScreenV3.tsx:423 | logoText | `color: "#1A1A1A", fontSize: 26` | `colors.text.primary`, `FONT.headingXl` |
| 4 | DashboardScreenV3.tsx:397 | CARD constant | `backgroundColor: "#FFFFFF"` | `colors.surface.primary` |
| 5 | DashboardScreenV3.tsx:493 | triVal | `color: "#000", fontSize: 22` | `colors.text.primary`, `FONT.headingLg` |
| 6 | DashboardScreenV3.tsx:546 | aiBarBtn | `backgroundColor: "#1A1A1A"` | `colors.button.primary.bg` |
| 7 | DashboardScreenV3.tsx:285 | AI icon | `color="#7C3AED"` | `colors.icon.secondary` |
| 8 | GlassButton.tsx:86 | primary variant | `ACTION_COLOR.primary` (#C45A22 orange) | `colors.button.primary.bg` |
| 9 | GlassButton.tsx:124 | text color | `return "#FFFFFF"` hardcoded | `colors.button.primary.text` |
| 10 | GlassInput.tsx:53 | focus border | `COLORS.input.focusBorder` (#EE6C29 orange) | `colors.fill.primary` |
| 11 | GlassListItem.tsx:189 | title color | `COLORS.text.primary` (#F5F5F5 static dark) | Theme-aware `colors.text.primary` |
| 12 | GlassListItem.tsx:194 | subtitle | `COLORS.text.muted` static | Theme-aware `colors.text.tertiary` |
| 13 | tokens.ts:93 | ACTION_COLOR.primary | `'#C45A22'` (orange) | Should be theme-aware grayscale |
| 14 | ThemeContext.tsx:16 | light background | `"#F5F3EF"` (cream) | `"#FFFFFF"` or `"#F8F8FA"` |
| 15 | BottomTabBar.tsx | FAB bg | `#1C1C1E` hardcoded | `colors.button.primary.bg` |
| 16 | BottomTabBar.tsx | avatar bg | `#EE6C29` | `colors.fill.primary` |
| 17 | ProfileScreen.tsx | danger zone | `"rgba(239,68,68,0.06)"` inline | `colors.semantic.errorBg` |
| 18 | WalletScreen.tsx | custom tc object | Entire conditional color logic | Use `colors` from useTheme() |
| 19 | FeedbackScreen.tsx | STATUS_META | `#9333EA`, `#06B6D4` custom | `colors.text.secondary` or semantic |
| 20 | SchedulerScreen.tsx | quick tile colors | `#EE6C29`, `#22C55E`, `#3B82F6` | `colors.fill.primary` or semantic |

---

## 8. Proposed Target Design System

### 8.1 Typography Scale
(See Section 2 above — 14 tokens from displayLg to tabLabel)

### 8.2 Grayscale Color System
(See Section 3 above — structured by role: bg, surface, text, border, fill, button, input, icon)

### 8.3 Semantic Color Rules
- Success/Warning/Error/Info only for their semantic purposes
- Never use green for "active" non-status UI — use `fill.primary` instead
- Profit positive = `semantic.success`, negative = `semantic.error`

### 8.4 Button Rules
- Primary: solid `fill.primary` bg, `text.inverse` text (black in light, white in dark)
- Secondary: transparent bg, `border.strong` border, `text.primary` text
- Tertiary: transparent bg, no border, `text.secondary` text
- Destructive: `semantic.error` bg, white text
- All buttons: borderRadius 12 (md), height 44/52/56, spring animation preserved

### 8.5 Card Rules
- GlassSurface with blur: keep architecture, shift colors to grayscale
- Flat cards: `surface.primary` bg, `border.default` border, borderRadius 16 (lg)
- No colored glows except on explicitly semantic surfaces

### 8.6 Input Rules
- Background: `input.bg` (light gray in light, dark gray in dark)
- Border: `input.border`, focus: `fill.primary` (black/white, NOT orange)
- Text: `input.text`, placeholder: `input.placeholder`

### 8.7 Icon Color Rules
- Primary icons: `icon.primary` (black in light, white in dark)
- Secondary/muted icons: `icon.secondary`
- No colored icons unless semantic (red for delete, etc.)

### 8.8 Border Radius Rules
- Keep existing: sm:8, md:12, lg:16, xl:24, full:9999
- Buttons: md (12), Cards: lg (16) or xl (24), Inputs: md (12), Pills: full

### 8.9 Spacing Rules
- Keep existing SPACE tokens: xs:4 sm:8 md:12 lg:16 xl:20 xxl:24 xxxl:32
- Keep LAYOUT semantic tokens: screenPadding:20, sectionGap:24, cardPadding:16, elementGap:12

### 8.10 Shadow/Elevation Rules
- Light mode: subtle shadows (opacity 0.04-0.08)
- Dark mode: minimal shadows, rely on surface color layering
- Keep SHADOWS.glassCard, .subtle, .button from liquidGlass.ts

### 8.11 Dark Mode Behavior
- Parallel system: same structure, inverted values
- Every color token must have both light and dark values
- No hardcoded colors in StyleSheet.create — always use theme-aware values

### 8.12 Do / Don't Guidelines
- DO: Use AppText with variant prop for all text
- DO: Use GlassButton for all interactive buttons
- DO: Use `colors.*` from useTheme() for all colors
- DON'T: Use hex values inline in JSX or StyleSheet
- DON'T: Use COLORS.* from liquidGlass.ts in new code (legacy)
- DON'T: Use TYPOGRAPHY/SPACING from liquidGlass.ts (deprecated)
- DON'T: Add new accent colors without explicit approval

---

## 9. Implementation Plan — Phased Migration

### Phase 1: Foundation — Typography & Color Tokens
**Why**: Everything else depends on having correct tokens.
**Risk**: Low (additive, no breaking changes yet)
**Effort**: ~2 hours

**Files to create/modify:**
1. **Create** `mobile/src/styles/typography.ts` — new 14-variant typography scale
2. **Create** `mobile/src/styles/colors.ts` — structured grayscale tokens for light + dark
3. **Modify** `mobile/src/context/ThemeContext.tsx` — restructure LIGHT_COLORS/DARK_COLORS to use new token shape
4. **Modify** `mobile/src/styles/tokens.ts` — update FONT to include new variants, deprecate ACTION_COLOR
5. **Modify** `mobile/src/components/ui/AppText.tsx` — add new variants (displayLg through tabLabel), add default theme-aware color per variant

### Phase 2: Core Components
**Why**: Components are used everywhere — fixing them fixes many screens at once.
**Risk**: Medium (changes propagate to all screens)
**Effort**: ~3 hours

**Files to modify:**
1. `mobile/src/components/ui/GlassButton.tsx` — primary→black, secondary→outlined, remove orange/blue
2. `mobile/src/components/ui/GlassInput.tsx` — focus→black, all colors theme-aware
3. `mobile/src/components/ui/GlassSurface.tsx` — shift glass colors to use theme tokens
4. `mobile/src/components/ui/GlassListItem.tsx` — switch from COLORS/TYPOGRAPHY/SPACING to FONT/SPACE/theme
5. `mobile/src/components/ui/GlassModal.tsx` — theme-aware colors
6. `mobile/src/components/ui/GlassHeader.tsx` — theme-aware blur colors
7. `mobile/src/components/BottomTabBar.tsx` — theme-aware, remove orange avatar bg
8. `mobile/src/components/ui/Card.tsx` — use new border tokens

### Phase 3: Screen-by-Screen Cleanup (Top Priority)
**Why**: Maximum visual impact per file changed.
**Risk**: Medium-High (screen-specific logic)
**Effort**: ~6 hours

**Order:**
1. `DashboardScreenV3.tsx` — full rewrite using design system (biggest impact)
2. `SettingsScreen.tsx` — use GlassListItem/Section consistently
3. `ProfileScreen.tsx` — remove inline danger colors
4. `GroupHubScreen.tsx` — standardize card usage
5. `WalletScreen.tsx` — remove custom `tc` object, use theme
6. `GameNightScreen.tsx` — reduce orange accents
7. `PokerAIScreen.tsx` — remove rogue colors
8. `FeedbackScreen.tsx` — replace custom status colors
9. `SchedulerScreen.tsx` — neutralize quick tile colors
10. `AIAssistantScreen.tsx` — keep AI gradient in isolated component only

### Phase 4: Dark Mode Parity & Cleanup
**Why**: Ensure both themes work identically.
**Risk**: Low
**Effort**: ~2 hours

**Tasks:**
1. Remove deprecated TYPOGRAPHY/SPACING exports from liquidGlass.ts (add console.warn first)
2. Remove unused color tokens from ThemeContext
3. Audit every screen for light+dark correctness
4. Remove `getThemedColors()` function — no longer needed with restructured theme
5. Clean up unused OnboardingShell OB palette (merge into main theme)

---

## 10. Quick Wins (Immediate High-Impact Changes)

1. **ThemeContext light background**: Change `#F5F3EF` → `#FFFFFF` (one line, instant cleaner feel)
2. **GlassButton primary color**: Change `ACTION_COLOR.primary` → `colors.buttonBg` (already #262626 in light theme!)
3. **GlassInput focus border**: Change `COLORS.input.focusBorder` → `colors.buttonBg` (black instead of orange)
4. **ACTION_COLOR in tokens.ts**: Change primary from `#C45A22` to `#1A1A1A` (affects all primary buttons app-wide)
5. **BottomTabBar avatar**: Change `#EE6C29` to `colors.buttonBg`

---

## 11. Deliverables

The implementation will produce these files:

1. **`mobile/src/styles/typography.ts`** — New 14-variant typography token file
2. **`mobile/src/styles/colors.ts`** — Structured light/dark grayscale tokens
3. **Updated `ThemeContext.tsx`** — Restructured to use new color tokens
4. **Updated `AppText.tsx`** — All 14 variants with theme-aware default colors
5. **Updated `GlassButton.tsx`** — Black/white primary buttons
6. **Updated `GlassInput.tsx`** — Grayscale focus states
7. **Updated `GlassListItem.tsx`** — Theme-aware, using canonical tokens
8. **Rewritten `DashboardScreenV3.tsx`** — Full sample screen using new system
9. **Codemod strategy** document for batch-replacing hardcoded values

---

## 12. Verification Plan

After each phase:
1. Run `npx tsc --noEmit` on all modified TypeScript files
2. Run `python -c "import ast; ast.parse(open('file.py').read())"` on any Python files (unlikely for this task)
3. Visual test on iOS simulator in both light and dark mode
4. Check accessibility contrast ratios (text.primary on bg.primary must be ≥ 4.5:1)
5. Verify BottomTabBar, DashboardScreenV3, SettingsScreen, ProfileScreen render correctly in both themes
6. Verify GlassButton primary/secondary/tertiary/destructive all look correct
7. Verify GlassInput focus state shows black border (not orange)

### Contrast Ratio Verification (WCAG AA ≥ 4.5:1)
- Light: #1A1A1A on #FFFFFF = 16.5:1 ✓
- Light: #6E6E73 on #FFFFFF = 5.1:1 ✓
- Light: #AEAEB2 on #FFFFFF = 2.7:1 (tertiary text — acceptable for non-essential)
- Dark: #F5F5F7 on #000000 = 19.3:1 ✓
- Dark: #98989F on #000000 = 5.4:1 ✓
- Dark: #636366 on #000000 = 3.2:1 (tertiary — acceptable for non-essential)

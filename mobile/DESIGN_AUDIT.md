# Simplified Design System Enforcement Plan

## Core Rule
One Apple-style grayscale system with two modes:
- **Light = dark-on-light** (dark text, dark buttons, light surfaces)
- **Dark = light-on-dark** (white text, white buttons, dark surfaces)
- Same hierarchy, same spacing, same components, opposite contrast.

Every component must look native in both themes. Do not make components permanently dark-styled.

## What We're Doing
Enforce a strict typography hierarchy and grayscale color system across the existing mobile app. Keep all existing glass morphism / Liquid Glass effects. No redesign. No new visual language. Only consistency.

## Token Source: `mobile/src/styles/tokens.ts`
Update this file. Stop relying on competing `TYPOGRAPHY`/`SPACING` from `liquidGlass.ts`.

## Typography Tokens

| Token | Size | Weight |
|-------|------|--------|
| display | 34 | 700 |
| h1 | 28 | 700 |
| h2 | 24 | 700 |
| h3 | 20 | 600 |
| title | 18 | 600 |
| body | 16 | 400 |
| secondary | 14 | 400 |
| caption | 12 | 400 |

## Color Tokens

### Light Theme
| Token | Value | Purpose |
|-------|-------|---------|
| bgPrimary | #FFFFFF | Main background |
| bgSecondary | #F5F5F7 | Secondary surfaces |
| textPrimary | #111111 | Primary text (dark on light) |
| textSecondary | #6E6E73 | Secondary text (gray) |
| textMuted | #A1A1A6 | Muted text (lighter gray) |
| border | #E5E5EA | Borders (subtle light gray) |
| buttonPrimary | #111111 | Primary button bg (dark) |
| buttonText | #FFFFFF | Primary button text (white) |

### Dark Theme
| Token | Value | Purpose |
|-------|-------|---------|
| bgPrimary | #000000 | Main background |
| bgSecondary | #1C1C1E | Secondary surfaces |
| textPrimary | #FFFFFF | Primary text (white on dark) |
| textSecondary | #98989F | Secondary text (muted gray) |
| textMuted | #636366 | Muted text (darker gray) |
| border | #2C2C2E | Borders (subtle dark gray) |
| buttonPrimary | #FFFFFF | Primary button bg (white) |
| buttonText | #000000 | Primary button text (black) |

### Semantic (both themes)
| Token | Value |
|-------|-------|
| success | #34C759 |
| warning | #FF9F0A |
| error | #FF3B30 |
| info | #007AFF |

## Files to Modify

### Phase 1: Token files
1. **`mobile/src/styles/tokens.ts`** — Replace FONT with 8-token typography, update/deprecate ACTION_COLOR
2. **`mobile/src/context/ThemeContext.tsx`** — Replace LIGHT_COLORS/DARK_COLORS with new paired grayscale. Remove orange/blue/moonstone from general theme.

### Phase 2: Core components
3. **`mobile/src/components/ui/AppText.tsx`** — Update variants to new FONT, add default theme-aware color
4. **`mobile/src/components/ui/GlassButton.tsx`** — Primary = `buttonPrimary`/`buttonText` (inverts by theme). Remove orange/blue.
5. **`mobile/src/components/ui/GlassInput.tsx`** — Focus border = `buttonPrimary`. All colors from theme.
6. **`mobile/src/components/ui/GlassSurface.tsx`** — Keep glass effects. Ensure surface/border from theme.
7. **`mobile/src/components/ui/GlassListItem.tsx`** — Replace static `COLORS.text` with theme-aware. Replace `TYPOGRAPHY`/`SPACING` from liquidGlass with `FONT`/`SPACE` from tokens.

### Phase 3: Screen cleanup
8. **`DashboardScreenV3.tsx`** — Remove all hardcoded hex colors/font sizes, support both themes
9. **Other screens** — Replace hardcoded values per violations list

## Hardcoded Violations

### tokens.ts
- `ACTION_COLOR.primary: '#C45A22'` (orange) → grayscale or deprecate
- `ACTION_COLOR.secondary: '#3B82F6'` (blue) → remove

### ThemeContext.tsx
- `background: "#F5F3EF"` (cream) → `#FFFFFF`
- `orange: "#EE6C29"` → remove from theme
- `trustBlue: "#3B82F6"` → remove from theme
- `moonstone: "#7AA6B3"` → remove from theme

### GlassButton.tsx
- Primary bg = orange (`ACTION_COLOR.primary`) → `colors.buttonPrimary`
- Text = hardcoded `"#FFFFFF"` → `colors.buttonText`
- Must invert: light=dark button/white text, dark=white button/dark text

### GlassInput.tsx
- Focus border = orange (`COLORS.input.focusBorder`) → `colors.buttonPrimary`
- Static dark-only values in StyleSheet → make theme-aware

### GlassListItem.tsx
- `COLORS.text.primary` (#F5F5F5 dark-only) → theme-aware
- `TYPOGRAPHY`/`SPACING` from liquidGlass → `FONT`/`SPACE` from tokens

### DashboardScreenV3.tsx (80+ violations)
- `backgroundColor: "#F8F8F6"` → `colors.bgPrimary`
- `color: "#1A1A1A"` (12×) → `colors.textPrimary`
- `color: "#888"`, `"#AAA"` → `colors.textSecondary`/`colors.textMuted`
- `fontSize: 56, 40, 26, 22, 21, 20, 17, 15, 13, 9` → FONT tokens
- `color: "#22C55E"`/`"#EF4444"` → `colors.success`/`colors.error`
- `color: "#EE6C29"` → remove
- No theme support at all → add `useTheme()`

### BottomTabBar.tsx
- `#EE6C29` avatar bg → `colors.buttonPrimary`
- `#1C1C1E` FAB bg → `colors.buttonPrimary`
- `#8E8E93` inactive tab → `colors.textMuted`

### Other screens
- ProfileScreen.tsx: inline danger rgba
- WalletScreen.tsx: custom conditional `tc` object
- FeedbackScreen.tsx: #9333EA, #06B6D4, #F97316
- PokerAIScreen.tsx: #7848FF, #DC2626
- ReferralScreen.tsx: #5B8DEF, #4ADE80
- SchedulerScreen.tsx: colored quick tiles

## Theme Inversion Rules
- Primary buttons: light=dark bg/white text, dark=white bg/dark text
- Text hierarchy identical both themes, opposite contrast
- Secondary/muted text stays gray both themes (theme-appropriate gray)
- Surfaces: light=white/light gray, dark=black/dark gray
- Borders: light=subtle light gray, dark=subtle dark gray
- Focus states: follow buttonPrimary (dark in light, white in dark)
- Icons: primary follows textPrimary, secondary follows textSecondary

## Verification
1. `npx tsc --noEmit` on modified files
2. Visual verify iOS simulator in BOTH themes
3. Check: light theme primary button = dark bg, white text
4. Check: dark theme primary button = white bg, dark text
5. Check: textPrimary is dark in light / white in dark
6. Check: GlassInput focus is dark in light / light in dark
7. Check: DashboardScreenV3 renders correctly both themes

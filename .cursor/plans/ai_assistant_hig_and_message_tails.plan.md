---
name: AI Assistant HIG + message tails
overview: Audit the entire AI Assistant experience (welcome, minimized bar, header, message list, suggestions, composer, in-thread chips/pills, structured cards alignment) against Apple HIG and canonical tokens in tokens.ts / ThemeContext, except frozen chat body text (14/20). Enforce 44pt touch targets, consistent padding, hairline separators, restrained shadows, and optical alignment. Add iMessage/Messages-style bubbles with a tail pointing at the avatar. Include prior chrome work (Groups back pill, neutral background, less orange, AssistantAvatar, body options menu, token Poker AI).
todos:
  - id: hig-audit-pass
    content: "Apply HIG pass on AIAssistantScreen: hierarchy, padding, separators, shadows, borders, keyboard bar, welcome — keep messageText 14/20 and touch targets"
    status: pending
  - id: bubble-tails
    content: "Implement ChatBubbleWithTail (SVG or layered views) for user/assistant; asymmetric corner radii; tail fill matches bubble"
    status: pending
  - id: chrome-from-prior-plan
    content: "Groups back pill, neutral page background, remove orange strip, AssistantAvatar, LiquidGlassPopup for new chat + visibility, GlassButton Poker AI"
    status: pending
  - id: verify-tsc
    content: Run mobile npx tsc --noEmit
    status: pending
isProject: false
---

# AI Assistant: Apple HIG audit + iMessage-style bubbles

## Scope (frozen vs flexible)

| Keep as-is (per product) | Review / align to HIG |
|--------------------------|------------------------|
| Chat **message body** `fontSize` 14 + `lineHeight` 20 | Everything else: titles, labels, composer `TextInput`, welcome hero, chips |
| Minimum **touch targets** 44pt where already applied | Spacing, alignment, optical balance, shadows |

---

## Full-page HIG checklist (implementation guide)

Reference: Apple HIG — *Layout*, *Color*, *Typography*, *Materials*, *Accessibility*, *Motion* (high level; no need to cite URLs in code).

**Token sources (single pass):** [`mobile/src/styles/tokens.ts`](mobile/src/styles/tokens.ts) (`SPACE`, `LAYOUT`, `RADIUS`, `BUTTON_SIZE`, `FONT` / `APPLE_TYPO` where applicable), [`mobile/src/context/ThemeContext.tsx`](mobile/src/context/ThemeContext.tsx) semantic colors, [`mobile/src/styles/appleShadows.ts`](mobile/src/styles/appleShadows.ts) only where elevation is intentional (prefer flat message bubbles).

**“Entire page” in scope:** `AIAssistantScreen` welcome hero, header row, optional hero gradient strip (neutral), minimized “show chat” bar, `ScrollView` message list, suggestion strip, `KeyboardAvoidingView` + composer, and **dependent in-thread UI** (follow-up chips, nav pill, agent chip, loading row). **Structured cards** ([`mobile/src/components/chat/*Card.tsx`](mobile/src/components/chat/)) already use tokens; re-check **leading alignment** once `CHAT_GUTTER` replaces magic `36`.

1. **Hierarchy and navigation**
   - **Back:** Match [`GroupsScreen`](mobile/src/screens/GroupsScreen.tsx) `backPill` (`chevron-back`, `glassBg` / `glassBorder` or `inputBg` / `border`), not a mismatched chevron-down ghost control.
   - **Title area:** Single clear title + optional subtitle; avoid crowding the nav row (prior plan: move refresh + visibility into body menu).

2. **Layout and alignment**
   - Horizontal rhythm: **`LAYOUT.screenPadding`** for screen edges; vertical rhythm **`LAYOUT.sectionGap`** / **`LAYOUT.elementGap`** between major blocks; avoid one-off magic numbers.
   - **Vertical alignment:** Header title block **optically centered** between back and trailing actions; composer row **baseline-aligned** (send control vertically centered to multiline field).
   - **Bubble column:** Assistant rows: avatar + gap + bubble; user rows: bubble + gap + avatar. **Tails point toward the avatar** (assistant: tail on bubble side facing avatar; user: tail on side facing user avatar) — same pattern as iOS Messages and typical Android chat UIs.
   - **Secondary blocks** (structured cards, follow-ups, nav pills): align to the **same leading edge** as assistant text (today `marginLeft: 36` is a magic number — replace with `avatarWidth + SPACE.sm` or exported **`CHAT_GUTTER`** constant used everywhere).

3. **Grouping and separation**
   - **Messages** vs **composer:** Use a **hairline** top border (`colors.border`) or very subtle material change — consistent with grouped list / message thread pattern.
   - **Suggestions row:** Visually secondary (`Label` / `Footnote`); enough padding so it does not collide with the composer.

4. **Materials and shadows**
   - **Messages (iOS Messages):** Bubbles are mostly **flat** (no heavy card shadow on every line). Today assistant bubbles use [`appleCardShadowResting`](mobile/src/styles/appleShadows.ts) — **remove shadow from message bubbles** as part of HIG pass; if any lift is needed, apply **only** to the **composer** bar or welcome speech card, sparingly.
   - **Borders:** Prefer **`StyleSheet.hairlineWidth`** for bubble outlines and list separators (system-consistent thin lines).
   - **Header strip:** Remove orange-tinted [`glowShadow`](mobile/src/screens/AIAssistantScreen.tsx) / gradient line if pursuing neutral HIG chrome.

5. **Color**
   - Prefer **semantic surfaces**: `contentBg`, `surface`, `inputBg`, `border`, `textPrimary` / `textSecondary` / `textMuted`.
   - **Brand orange:** Reserve for **accents** (links in rich text, one CTA, optional small icon tint) — not full header strips or every chip.

6. **Typography (chrome only)**
   - Already using [`Typography`](mobile/src/components/ui/Typography.tsx) in places — extend consistently: **Headline / Subhead / Footnote / Label** for header, welcome, suggestions, minimized bar; keep **plain `Text` + frozen style** only for message bodies.

7. **Touch targets and controls**
   - Primary and secondary actions: **`LAYOUT.touchTarget` (44)** minimum; icon buttons match **`BUTTON_SIZE`** where used (e.g. send control).
   - **Icon sizing:** Nav / toolbar icons typically **20–24pt**; keep consistent within this screen.
   - **Hit slops:** Preserve or add **`hitSlop`** only where the visible control is smaller than 44pt (prefer enlarging the touch area via padding instead).

8. **Keyboard and safe area**
   - Composer **`paddingBottom`**: `insets.bottom + SPACE.lg` (already directionally right); verify **`KeyboardAvoidingView`** behavior on notched devices; optional `keyboardVerticalOffset` if a large title or tab bar eats space.

9. **Motion**
   - Existing fades/springs are fine; optional: respect **Reduce Motion** later (out of scope unless quick `AccessibilityInfo.isReduceMotionEnabled` gate).

10. **Platform polish**
   - Where supported, **`borderCurve: 'continuous'`** on large rounded containers (sheet-style corners) for iOS 16+ consistency with other Kvitt screens.

---

## iMessage / Android-style bubble with tail

**Goal:** Each message bubble has a **small triangular or curved tail** (“pointer corner”) pointing toward the **avatar** — **assistant:** tail on the **left** side of the bubble, aimed at the bot avatar; **user:** tail on the **right** side, aimed at the user avatar — matching iOS Messages and common Android chat apps.

**Visual rules**

- **Asymmetric corner radius:** The corner **nearest the tail** stays slightly **tighter**; the **far** corners stay **`RADIUS.lg`** (or Apple-like 18–20pt equivalent) — matches how system messages read.
- **Tail fill** must **match** bubble background exactly (including user tint and error states).
- **Border:** If bubbles keep a hairline border, the tail must **continue** the outline (SVG path with stroke, or separate border triangle — avoid a “floating” triangle with wrong edge color).

**Implementation options (pick one in execution)**

1. **`react-native-svg` `Path`** — One path per variant (`AssistantBubble`, `UserBubble`) with fill + optional `stroke` for hairline; scales cleanly.
2. **Layered views** — Rounded `View` + absolutely positioned **rotated square** (same technique as welcome `speechBubbleTail`) with matching `backgroundColor`; harder to get perfect border continuity.
3. **Small reusable component** e.g. [`mobile/src/components/chat/ChatBubbleShell.tsx`](mobile/src/components/chat/ChatBubbleShell.tsx) wrapping children and exposing `role: 'user' | 'assistant' | 'error'`.

**Integration point:** [`AIAssistantScreen.tsx`](mobile/src/screens/AIAssistantScreen.tsx) message map (~686–745) — replace the flat `messageBubble` `View` with the shell; preserve inner content (`TypingText`, `RichTextRenderer`, user `Text`, instant tag).

**Loading placeholder bubble:** Apply the **same assistant shell** (tail left) with spinner inside for visual consistency.

---

## Prior chrome plan (still in scope)

Consolidated here so one execution pass covers everything:

- Groups-style **back**; **neutral** page background / hero alignment with other tabs.
- Remove **orange gradient** under header; soften **BETA**.
- **`AssistantAvatar`** (neutral, subtle animation) replacing **`AIGradientOrb`** in header (and align welcome + list avatars unless product wants orb only on welcome — default: **one consistent mark**).
- **Refresh + visibility** → **[`LiquidGlassPopup`](mobile/src/components/ui/LiquidGlassPopup.tsx)** from a body anchor (“Chat options”); optional **Alert** confirm for New chat.
- **Poker AI** → **`GlassButton`** or Groups-like **outlined pill** using tokens.

---

## Verification

- `npx tsc --noEmit` in `mobile`.
- Visual: tails point to avatars; light/dark; error bubble still readable; no double-shadow clutter.
- Regression: message body still **14/20**; tap targets **≥ 44pt** on primary actions.

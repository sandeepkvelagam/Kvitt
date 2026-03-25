---
name: Game thread UI parity
overview: Blend GameThreadChat into the app shell like other pages; refresh header typography; add location, short date/time, and settlement CTA. Leave GroupChatMessagesPanel / chat block internals unchanged—only page chrome and metadata area.
todos:
  - id: page-blend-metadata
    content: GameThreadChatScreen—remove heavy card; flat blended metadata rows on contentBg; subtle separator into chat; no changes inside GroupChatMessagesPanel
  - id: header-typography
    content: Align header fonts with Apple/token typography (e.g. Title1/Title2 + Footnote) consistent with Chats/other tab roots where appropriate
  - id: format-meta-util
    content: Add formatGameThreadMeta (ordinal date + optional time; location ellipsis)
  - id: settlement-cta
    content: Settlement button when ended/settled (optional refine via GET settlement)
  - id: i18n-tsc
    content: Translation keys + mobile tsc
isProject: true
---

# Game thread: blended page + header/meta (chat section unchanged)

## Scope constraint (per product direction)

- **Do not change** [`GroupChatMessagesPanel`](mobile/src/components/groupChat/GroupChatMessagesPanel.tsx) behavior, layout, or internal styles for this pass—**chat section stays as-is**.
- **Do** blend the **screen** so the chat area reads as part of the same page as other Kvitt screens (continuous `contentBg`, no “floating slab” separation).

## 1. Page blend (above chat only)

- Root stays **`colors.contentBg`** (same family as [`GroupChatScreen`](mobile/src/screens/GroupChatScreen.tsx)).
- Replace the elevated **surface card + shadow** on the game summary with **flat rows** on the page background (optional light `liquidGlassBg` row backgrounds + `hairline` borders—aligned with grouped lists elsewhere).
- **Transition into chat:** keep a minimal **`hairline`** divider only; **same background** behind the chat block as the rest of the page so the list/composer (unchanged) visually continues the screen—not a different “panel” color.
- **Do not** refactor or restyle the composer, FlatList, or bubbles inside the panel.

## 2. Header typography and chrome

- Refresh **header fonts** to match the **Apple HIG / token system** used on peer screens: e.g. primary title scale (**`Title1` or `Title2`** for the main title line per hierarchy you use on similar stack headers), **`Footnote` / `Caption2`** for subtitle (chat label + connection), consistent **`LAYOUT.screenPadding`**, **`LAYOUT.touchTarget`** back control—mirror patterns from [`ChatsScreen`](mobile/src/screens/ChatsScreen.tsx) / [`GroupChatScreen`](mobile/src/screens/GroupChatScreen.tsx) as appropriate.
- Trailing spacer column unchanged unless a small secondary action is already planned.

## 3. Location (short)

- From **`game.location`** on `GET /games/{gameId}`.
- Single row, **`numberOfLines={1}`**, ellipsis; hide if empty.

## 4. Date / time (short form)

- Pick datetime by **status**: `scheduled_at` → `started_at` → `ended_at` → `created_at` (same priority as prior plan).
- Display like **`Fri 12th Mar '26`** (+ **` · h:mm a`** when time is meaningful).
- New helper e.g. [`mobile/src/utils/formatGameThreadMeta.ts`](mobile/src/utils/formatGameThreadMeta.ts).

## 5. Settlement CTA

- **`navigation.navigate('Settlement', { gameId })`** when **`ended` / `settled`** (optional: confirm non-empty `GET /games/{id}/settlement`).
- Use existing tokenized button styles (`BUTTON_SIZE`, borders, `Headline`).

## 6. i18n

- Add **`chatsScreen`** strings for row labels / settlement if not reusing [`t.game.settlement`](mobile/src/i18n/translations.ts); update all locales.

## Files to touch

| File | Purpose |
|------|---------|
| [`mobile/src/screens/GameThreadChatScreen.tsx`](mobile/src/screens/GameThreadChatScreen.tsx) | Blended layout, header type scale, meta rows, settlement button |
| [`mobile/src/utils/formatGameThreadMeta.ts`](mobile/src/utils/formatGameThreadMeta.ts) (new) | Date + location helpers |
| [`mobile/src/i18n/translations.ts`](mobile/src/i18n/translations.ts) | Copy |

**Out of scope for this pass:** edits inside [`GroupChatMessagesPanel.tsx`](mobile/src/components/groupChat/GroupChatMessagesPanel.tsx).

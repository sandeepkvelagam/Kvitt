import React, { useMemo } from "react";

/**
 * Keywords highlighted in amber when they appear in assistant responses.
 * Ported from mobile/src/components/chat/RichTextRenderer.tsx
 */
const HIGHLIGHT_KEYWORDS = [
  // App concepts
  "buy-in", "buy in", "cash-out", "cash out", "settlement", "rebuy", "rebuys",
  "chips", "chip count", "group", "groups", "game", "games", "poker night",
  "host", "player", "players", "invite", "ledger",
  // Actions
  "create", "start", "join", "approve", "cash out", "settle", "mark",
  "tap", "go to", "open", "set up",
  // Financial
  "owes", "owe", "profit", "loss", "net result", "payment", "payments",
  "venmo", "paid", "pending",
  // Screens / UI
  "Groups tab", "Start Game", "Cash Out", "Create Group", "Game Night",
  "Settlement", "Settings",
  // Stats
  "stats", "badges", "level", "record", "winnings", "losses",
  // Poker terms
  "Royal Flush", "Straight Flush", "Four of a Kind", "Full House",
  "Flush", "Straight", "Three of a Kind", "Two Pair", "One Pair",
  "High Card",
];

// Sort longest-first so "cash-out" matches before "cash"
const sortedKeywords = [...HIGHLIGHT_KEYWORDS].sort((a, b) => b.length - a.length);
const KEYWORD_PATTERN = new RegExp(
  `(${sortedKeywords.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
  "gi"
);

const BULLET_PATTERN = /^(\d+\.|•)\s/;
const BOLD_PATTERN = /\*\*(.+?)\*\*/g;

function highlightKeywordsInText(text, lineIdx, partIdx) {
  if (!text) return [];
  const elements = [];
  KEYWORD_PATTERN.lastIndex = 0;

  let lastIndex = 0;
  let match;
  while ((match = KEYWORD_PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      elements.push(text.slice(lastIndex, match.index));
    }
    elements.push(
      <span key={`kw-${lineIdx}-${partIdx}-${match.index}`} className="text-amber-500 font-semibold">
        {match[0]}
      </span>
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    elements.push(text.slice(lastIndex));
  }
  return elements;
}

/**
 * RichTextRenderer — Renders AI assistant text with amber keyword highlighting.
 *
 * - Important app terms (buy-in, settlement, etc.) highlighted in amber
 * - Bullet numbers/markers highlighted in amber
 * - **Bold** text rendered bold + amber
 * - Everything else uses default text style
 */
export function RichTextRenderer({ text, className = "" }) {
  const rendered = useMemo(() => {
    if (!text) return null;

    const lines = text.split("\n");
    const elements = [];

    lines.forEach((line, lineIdx) => {
      if (lineIdx > 0) {
        elements.push(<br key={`br-${lineIdx}`} />);
      }

      // Check for bullet/number prefix
      const bulletMatch = line.match(BULLET_PATTERN);
      let restOfLine = line;

      if (bulletMatch) {
        elements.push(
          <span key={`b-${lineIdx}`} className="text-amber-500 font-bold">
            {bulletMatch[0]}
          </span>
        );
        restOfLine = line.slice(bulletMatch[0].length);
      }

      // Process **bold** markers, then keywords within each segment
      const boldParts = restOfLine.split(BOLD_PATTERN);

      boldParts.forEach((part, partIdx) => {
        const isBoldCapture = partIdx % 2 === 1;
        if (isBoldCapture) {
          elements.push(
            <span key={`bold-${lineIdx}-${partIdx}`} className="text-amber-500 font-bold">
              {part}
            </span>
          );
        } else {
          elements.push(...highlightKeywordsInText(part, lineIdx, partIdx));
        }
      });
    });

    return elements;
  }, [text]);

  return <span className={className}>{rendered}</span>;
}

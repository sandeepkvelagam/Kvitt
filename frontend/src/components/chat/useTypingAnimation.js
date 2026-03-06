import { useState, useEffect, useRef } from "react";

/**
 * useTypingAnimation — Character-by-character text reveal hook.
 * Ported from mobile AIAssistantScreen.tsx TypingText component.
 *
 * @param {string} text - Full text to reveal
 * @param {boolean} enabled - Whether to animate (false = show full text immediately)
 * @param {number} speed - Milliseconds per character (default 25ms)
 * @returns {{ displayedText: string, isTyping: boolean }}
 */
export function useTypingAnimation(text, enabled = true, speed = 25) {
  const [displayedText, setDisplayedText] = useState(enabled ? "" : text);
  const [isTyping, setIsTyping] = useState(enabled && !!text);
  const indexRef = useRef(0);

  useEffect(() => {
    if (!enabled || !text) {
      setDisplayedText(text || "");
      setIsTyping(false);
      return;
    }

    indexRef.current = 0;
    setDisplayedText("");
    setIsTyping(true);

    const interval = setInterval(() => {
      indexRef.current += 1;
      if (indexRef.current >= text.length) {
        setDisplayedText(text);
        setIsTyping(false);
        clearInterval(interval);
      } else {
        setDisplayedText(text.slice(0, indexRef.current));
      }
    }, speed);

    return () => clearInterval(interval);
  }, [text, enabled, speed]);

  return { displayedText, isTyping };
}

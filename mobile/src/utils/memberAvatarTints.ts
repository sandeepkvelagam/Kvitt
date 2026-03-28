/**
 * Distinct pastel backgrounds for member avatars (stack + list) — readable in light and dark.
 */
const LIGHT: readonly string[] = [
  "#C9E4FF",
  "#FFD6E8",
  "#C8F2D9",
  "#FFE8C4",
  "#DDD6FE",
  "#B8EBEB",
  "#F0E6D8",
  "#D4DCE8",
];

const DARK: readonly string[] = [
  "rgba(100, 165, 255, 0.38)",
  "rgba(255, 140, 185, 0.35)",
  "rgba(120, 220, 170, 0.32)",
  "rgba(255, 195, 110, 0.35)",
  "rgba(180, 160, 255, 0.35)",
  "rgba(110, 210, 220, 0.32)",
  "rgba(230, 200, 150, 0.28)",
  "rgba(160, 175, 205, 0.38)",
];

export function memberAvatarBackground(index: number, isDark: boolean): string {
  const palette = isDark ? DARK : LIGHT;
  return palette[Math.abs(index) % palette.length];
}

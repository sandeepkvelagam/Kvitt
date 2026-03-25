import { Ionicons } from "@expo/vector-icons";

/**
 * Maps game category to a consistent Ionicons glyph (Dashboard V3 upcoming + Scheduler).
 */
export function categoryIconForGame(cat: string | undefined): keyof typeof Ionicons.glyphMap {
  switch ((cat || "poker").toLowerCase()) {
    case "rummy":
      return "albums-outline";
    case "spades":
      return "leaf-outline";
    case "poker":
      return "diamond-outline";
    default:
      return "dice-outline";
  }
}

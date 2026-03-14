/**
 * UI Components Index
 * 
 * Exports all UI components including the Liquid Glass design system.
 */

// Core Liquid Glass
export {
  LiquidGlassView,
  LiquidGlassContainer,
  isNativeLiquidGlassSupported,
  getGlassSupportStatus,
  GlassPresets,
  createAnimatedGlassStyle,
  type LiquidGlassViewProps,
  type LiquidGlassContainerProps,
  type GlassStyle,
  type GlassColorScheme,
} from "./LiquidGlassView";

// Glass Components
export { GlassSurface, GlassSurfaceFlat } from "./GlassSurface";
export { GlassButton, GlassIconButton } from "./GlassButton";
export { GlassInput } from "./GlassInput";
export { GlassModal } from "./GlassModal";
export { GlassHeader } from "./GlassHeader";
export { GlassListItem } from "./GlassListItem";
export { LiquidGlassPopup, type LiquidGlassPopupItem } from "./LiquidGlassPopup";

// Glass Tile (Liquid Glass experiment)
export { GlassTile, type GlassTileProps, type GlassTileSize, type GlassTileTone } from "./GlassTile";
export { GlassTileSkia, isSkiaAvailable } from "./GlassTileSkia";

// Layout Components
export { Screen } from "./Screen";
export { Card } from "./Card";
export { PageHeader } from "./PageHeader";

// Skeleton Loaders
export { Skeleton, SkeletonCard, SkeletonListItem, SkeletonStats } from "./SkeletonLoader";
export { DashboardSkeleton } from "./DashboardSkeleton";
export { GroupsSkeleton } from "./GroupsSkeleton";
export { ChatsSkeleton } from "./ChatsSkeleton";

// Effects
export { AIGlowBorder } from "./AIGlowBorder";
export { SnakeGlowBorder } from "./SnakeGlowBorder";

// Onboarding
export { OnboardingShell } from "./OnboardingShell";

// Misc
export { KvittLogo } from "./KvittLogo";
export { StarRating } from "./StarRating";
export { QRCodeScanner } from "./QRCodeScanner";
export { QRCodeDisplay } from "./QRCodeDisplay";

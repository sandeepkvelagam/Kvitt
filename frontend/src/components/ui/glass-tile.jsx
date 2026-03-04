import React from "react";
import { cn } from "@/lib/utils";
import { TILE_CONFIG } from "@/styles/designTokens";

/**
 * GlassTile - Liquid Glass card component for web.
 *
 * Props:
 * - size: "sm" | "md" | "lg" | "hero" (controls radius/padding)
 * - tone: "purple" | "mint" | "amber" | "rose" | "slate" | "orange" | "blue" (gradient tint)
 * - glass: boolean (enable backdrop-filter blur, default true)
 * - elevated: boolean (extra shadow on hover)
 * - gradient: optional override gradient CSS string
 * - className: additional classes
 * - onClick: optional click handler
 * - children: tile content
 */

const SIZE_CLASSES = {
  sm: "p-3",
  md: "p-4",
  lg: "p-5",
  hero: "p-6",
};

export default function GlassTile({
  size = "md",
  tone,
  glass = true,
  elevated = false,
  gradient,
  className,
  onClick,
  children,
  ...props
}) {
  const config = TILE_CONFIG[size] || TILE_CONFIG.md;

  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") onClick(e); } : undefined}
      className={cn(
        // Base glass
        "relative overflow-hidden transition-all duration-250",
        glass && "glass-surface glass-noise",
        !glass && "bg-white/[0.04] border border-white/[0.06]",
        // Tone gradient overlay
        tone && `glass-tone-${tone}`,
        // Size padding
        SIZE_CLASSES[size],
        // Hover
        elevated && "glass-hover",
        onClick && "cursor-pointer glass-hover",
        // Focus
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/50",
        className
      )}
      style={{
        borderRadius: config.radius,
        ...(gradient ? { backgroundImage: gradient } : {}),
      }}
      {...props}
    >
      {/* Inner highlight line */}
      <div
        className="absolute top-0 left-[10%] right-[10%] h-px pointer-events-none"
        style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)" }}
      />
      {/* Content */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}

/**
 * GlassTileSkeleton - Loading placeholder for GlassTile
 */
export function GlassTileSkeleton({ size = "md", className }) {
  const config = TILE_CONFIG[size] || TILE_CONFIG.md;

  return (
    <div
      className={cn("glass-skeleton", SIZE_CLASSES[size], className)}
      style={{ borderRadius: config.radius, minHeight: size === "hero" ? 160 : size === "lg" ? 120 : 80 }}
    />
  );
}

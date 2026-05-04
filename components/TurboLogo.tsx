"use client";

/**
 * TurboLogo Component
 *
 * Reusable component for displaying the Turbo mascot (wizard snail)
 * throughout the website and app.
 *
 * Uses optimized image assets at different resolutions for best performance.
 */

import Image from "next/image";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type TurboSize = "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl";

interface TurboLogoProps {
  /** Size of the logo - responsive by default */
  size?: TurboSize;
  /** Additional CSS classes */
  className?: string;
  /** Custom alt text */
  alt?: string;
}

// Size configurations: [width, height, optimized image file]
const sizeConfig: Record<TurboSize, { px: number; src: string; className: string }> = {
  sm: { px: 32, src: "/images/turbo/Turbo_logo_48.png", className: "w-8 h-8" },
  md: { px: 48, src: "/images/turbo/Turbo_logo_64.png", className: "w-12 h-12" },
  lg: { px: 64, src: "/images/turbo/Turbo_logo_96.png", className: "w-16 h-16" },
  xl: { px: 96, src: "/images/turbo/Turbo_logo_128.png", className: "w-24 h-24" },
  "2xl": { px: 128, src: "/images/turbo/Turbo_logo_256.png", className: "w-32 h-32" },
  "3xl": { px: 256, src: "/images/turbo/Turbo_logo_512.png", className: "w-64 h-64" },
  "4xl": { px: 512, src: "/images/turbo/Turbo_logo.png", className: "w-96 h-96" },
};

export function TurboLogo({
  size = "md",
  className = "",
  alt = "Turbo - SprintiQ's AI Planning Analyst",
}: TurboLogoProps) {
  const config = sizeConfig[size];

  return (
    <Image
      src={config.src}
      alt={alt}
      width={config.px}
      height={config.px}
      className={cn(config.className, "object-contain", className)}
      priority
    />
  );
}

/**
 * TurboLogoWithLabel Component
 *
 * Displays Turbo with a text label, useful for branded sections.
 */
interface TurboLogoWithLabelProps extends TurboLogoProps {
  /** Label text to display */
  label?: string;
  /** Label position */
  labelPosition?: "bottom" | "right";
  /** Label CSS classes */
  labelClassName?: string;
}

export function TurboLogoWithLabel({
  size = "md",
  className = "",
  alt,
  label = "Powered by Turbo",
  labelPosition = "bottom",
  labelClassName = "",
}: TurboLogoWithLabelProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2",
        labelPosition === "bottom" && "flex-col",
        className
      )}
    >
      <TurboLogo size={size} alt={alt} />
      <span className={cn("text-xs font-medium text-emerald-400", labelClassName)}>
        {label}
      </span>
    </div>
  );
}

/**
 * TurboLoading Component
 *
 * Turbo logo for loading states with subtle pulse effect.
 */
interface TurboLoadingProps {
  /** Size of the logo */
  size?: TurboSize;
  /** Loading message */
  message?: string;
  /** Additional CSS classes */
  className?: string;
}

export function TurboLoading({
  size = "xl",
  message = "Turbo is analyzing...",
  className = "",
}: TurboLoadingProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3", className)}>
      <div className="relative">
        <TurboLogo size={size} />
        <Loader2 className="absolute -bottom-1 -right-1 h-5 w-5 animate-spin text-emerald-500" />
      </div>
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
    </div>
  );
}

export default TurboLogo;

"use client";

import Image from "next/image";
import { TurboLogo, type TurboSize } from "@/components/TurboLogo";
import { cn } from "@/lib/utils";

type LockupSize = "sm" | "md" | "lg" | "xl";

interface BrandLockupProps {
  /** Lockup scale */
  size?: LockupSize;
  /** Wordmark color variant. "light" = light wordmark for dark backgrounds; "dark" = dark wordmark for light backgrounds. */
  variant?: "light" | "dark";
  /** Additional CSS classes */
  className?: string;
}

// sprintiq-logo[-dark].png natural dimensions are roughly 1300x300 (4.3:1).
// We render at heights matched to TurboLogo size and let width auto-scale.
const wordmarkHeight: Record<LockupSize, number> = {
  sm: 20,
  md: 28,
  lg: 36,
  xl: 48,
};

const turboSize: Record<LockupSize, TurboSize> = {
  sm: "sm",
  md: "md",
  lg: "lg",
  xl: "xl",
};

const gapClass: Record<LockupSize, string> = {
  sm: "gap-1.5",
  md: "gap-2",
  lg: "gap-3",
  xl: "gap-4",
};

export function BrandLockup({
  size = "md",
  variant = "light",
  className = "",
}: BrandLockupProps) {
  const wordmarkSrc =
    variant === "dark"
      ? "/images/sprintiq-logo-dark.png"
      : "/images/sprintiq-logo.png";

  const h = wordmarkHeight[size];
  // Wordmark aspect ratio ~4.3:1
  const w = Math.round(h * 4.3);

  return (
    <div className={cn("flex items-center", gapClass[size], className)}>
      <TurboLogo size={turboSize[size]} alt="SprintiQ Turbo" />
      <Image
        src={wordmarkSrc}
        alt="SprintiQ"
        width={w}
        height={h}
        priority
        style={{ height: `${h}px`, width: "auto" }}
      />
    </div>
  );
}

/** Compact variant — Turbo icon only, for collapsed sidebar / tight spaces. */
export function BrandLockupCompact({
  size = "md",
  className = "",
}: {
  size?: LockupSize;
  className?: string;
}) {
  return <TurboLogo size={turboSize[size]} className={className} alt="SprintiQ Turbo" />;
}

export default BrandLockup;

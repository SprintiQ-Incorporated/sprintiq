/**
 * Animation Utilities
 *
 * Shared animation configurations with reduced-motion support
 */

// ============================================================================
// Reduced Motion Support
// ============================================================================

/**
 * Check if user prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Get animation duration respecting reduced motion
 */
export function getAnimationDuration(ms: number): number {
  return prefersReducedMotion() ? 0 : ms;
}

/**
 * CSS variable for reduced motion
 */
export const motionSafe = "@media (prefers-reduced-motion: no-preference)";

// ============================================================================
// Framer Motion Variants
// ============================================================================

/**
 * Standard timing for snappy animations (under 300ms)
 */
export const TIMING = {
  fast: 0.15,
  normal: 0.2,
  slow: 0.3,
} as const;

/**
 * Standard easings
 */
export const EASING = {
  easeOut: [0.25, 0.46, 0.45, 0.94],
  easeInOut: [0.645, 0.045, 0.355, 1],
  spring: { type: "spring", stiffness: 400, damping: 30 },
} as const;

/**
 * Card hover animation variants
 */
export const cardHoverVariants = {
  initial: {
    y: 0,
    boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
  },
  hover: {
    y: -2,
    boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
    transition: { duration: TIMING.fast, ease: EASING.easeOut },
  },
};

/**
 * Staggered children animation
 */
export const staggerContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.05,
    },
  },
};

/**
 * Fade in from bottom
 */
export const fadeInUpVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: TIMING.normal, ease: EASING.easeOut },
  },
  exit: {
    opacity: 0,
    x: -20,
    transition: { duration: TIMING.fast },
  },
};

/**
 * Scale in animation
 */
export const scaleInVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: TIMING.normal, ease: EASING.easeOut },
  },
};

/**
 * Slide in from right (for drawers)
 */
export const slideInRightVariants = {
  hidden: { x: "100%", opacity: 0 },
  visible: {
    x: 0,
    opacity: 1,
    transition: { duration: TIMING.slow, ease: EASING.easeOut },
  },
  exit: {
    x: "100%",
    opacity: 0,
    transition: { duration: TIMING.normal },
  },
};

/**
 * Expand/collapse height animation
 */
export const expandCollapseVariants = {
  collapsed: {
    height: 0,
    opacity: 0,
    transition: { duration: TIMING.normal, ease: EASING.easeInOut },
  },
  expanded: {
    height: "auto",
    opacity: 1,
    transition: { duration: TIMING.slow, ease: EASING.easeInOut },
  },
};

/**
 * Pulse animation for attention
 */
export const pulseVariants = {
  initial: { scale: 1 },
  pulse: {
    scale: [1, 1.02, 1],
    transition: { duration: 2, repeat: Infinity, ease: "easeInOut" },
  },
};

/**
 * Subtle pulse for ready state button
 */
export const readyPulseVariants = {
  initial: { boxShadow: "0 0 0 0 rgba(99, 102, 241, 0)" },
  pulse: {
    boxShadow: [
      "0 0 0 0 rgba(99, 102, 241, 0)",
      "0 0 0 4px rgba(99, 102, 241, 0.2)",
      "0 0 0 0 rgba(99, 102, 241, 0)",
    ],
    transition: { duration: 2, repeat: Infinity, ease: "easeInOut" },
  },
};

/**
 * Spin animation for regenerate icon
 */
export const spinVariants = {
  initial: { rotate: 0 },
  spin: {
    rotate: 360,
    transition: { duration: 0.6, ease: "linear" },
  },
};

/**
 * Success flash animation
 */
export const successFlashVariants = {
  initial: { backgroundColor: "transparent" },
  flash: {
    backgroundColor: [
      "transparent",
      "rgba(16, 185, 129, 0.15)",
      "transparent",
    ],
    transition: { duration: 0.6 },
  },
};

/**
 * Attention pulse for skill gap alert
 */
export const attentionPulseVariants = {
  initial: { scale: 1, opacity: 1 },
  attention: {
    scale: [1, 1.01, 1],
    opacity: [1, 0.9, 1],
    transition: { duration: 0.8, repeat: 2 },
  },
};

/**
 * Remove animation (fade + slide left)
 */
export const removeVariants = {
  initial: { opacity: 1, x: 0 },
  exit: {
    opacity: 0,
    x: -50,
    transition: { duration: TIMING.normal, ease: EASING.easeOut },
  },
};

// ============================================================================
// CSS Transition Classes
// ============================================================================

/**
 * Tailwind classes for common transitions
 */
export const transitionClasses = {
  /** Fast transition for hover effects */
  fast: "transition-all duration-150 ease-out",
  /** Normal transition */
  normal: "transition-all duration-200 ease-out",
  /** Slow transition for expand/collapse */
  slow: "transition-all duration-300 ease-out",
  /** Scale on focus */
  focusScale: "focus:scale-[1.01] transition-transform duration-200",
  /** Lift on hover */
  hoverLift: "hover:-translate-y-0.5 hover:shadow-md transition-all duration-150",
  /** Shadow transition */
  shadow: "transition-shadow duration-200",
} as const;

// ============================================================================
// Reduced Motion CSS
// ============================================================================

/**
 * CSS for reduced motion
 * Add this to global styles or use with cn()
 */
export const reducedMotionCSS = `
  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }
`;

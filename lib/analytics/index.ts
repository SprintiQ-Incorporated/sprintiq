/**
 * Advanced Analytics
 *
 * Exports all advanced analytics utilities and types
 */

// Predictive Analytics
export {
  type SprintHistoryData,
  predictSprintSuccess,
  calculateVelocityWithConfidence,
} from "./predictive-analytics";

// Death Spiral Detection
export {
  type DeathSpiralWarning,
  detectDeathSpiral,
} from "./death-spiral-detection";

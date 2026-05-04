/**
 * Hooks
 *
 * Barrel exports for all custom hooks
 */

// Story Generator
export { useGenerateStories, default as useGenerateStoriesDefault } from "./useGenerateStories";
export type {
  StoryGeneratorInput,
  GenerationProgress,
  UseGenerateStoriesReturn,
} from "./useGenerateStories";

// Task Save
export { useSaveGeneratedTasks } from "./useSaveGeneratedTasks";

// React Query - Analytics & Dashboard
export { useAnalyticsInsights } from "./use-analytics-insights";
export type {
  AnalyticsMetrics,
  VelocityDataPoint,
  BurndownDataPoint,
  CumulativeFlowDataPoint,
  CompletionData,
  AnalyticsInsightsData,
} from "./use-analytics-insights";

// Toast
export { useToast, toast } from "./use-toast";

// Enhanced Toast
export { useEnhancedToast } from "./use-enhanced-toast";

// Entity Renaming
export { useRenameEntity } from "./useRenameEntity";

// Cookie Consent
export { useCookieConsent } from "./use-cookie-consent";

// Browser Notifications
export { useBrowserNotifications } from "./use-browser-notifications";

// Analytics
export { useAllAdvancedAnalytics } from "./useAdvancedAnalytics";

// Performance Optimization - INP
export { useDebounce, useThrottle, useScrollHandler } from "./use-debounce";


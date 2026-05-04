/**
 * Status Type Categories and Helper Functions
 *
 * Centralized constants for categorizing status types across the application.
 * Use these constants for consistent status type checking in velocity calculations,
 * sprint metrics, and analytics.
 */

/**
 * Categorization of status types by their semantic meaning
 */
export const STATUS_TYPE_CATEGORIES = {
  /** Status types representing work not yet started */
  NOT_STARTED: ['not-started'],
  /** Status types representing work in progress */
  IN_PROGRESS: ['active'],
  /** Status types representing testing/review work */
  TESTING: ['testing'],
  /** Status types representing completed work (counts toward velocity) */
  COMPLETED: ['done'],
  /** No blocked status_type exists in DB */
  BLOCKED: [],
} as const;

/** Industry-standard conversion: 1 story point ≈ 4 hours (half a workday) */
export const HOURS_PER_STORY_POINT = 4;

/**
 * Type for status type category keys
 */
export type StatusTypeCategory = keyof typeof STATUS_TYPE_CATEGORIES;

/**
 * Check if a status type name represents completed work
 * @param statusTypeName - The name of the status type to check
 * @returns true if the status type represents completed work
 */
export function isCompletedStatusType(statusTypeName: string | null | undefined): boolean {
  if (!statusTypeName) return false;
  return STATUS_TYPE_CATEGORIES.COMPLETED.includes(statusTypeName.toLowerCase() as any);
}

/**
 * Check if a status type name represents work not started
 * @param statusTypeName - The name of the status type to check
 * @returns true if the status type represents work not started
 */
export function isNotStartedStatusType(statusTypeName: string | null | undefined): boolean {
  if (!statusTypeName) return false;
  return STATUS_TYPE_CATEGORIES.NOT_STARTED.includes(statusTypeName.toLowerCase() as any);
}

/**
 * Check if a status type name represents work in progress
 * @param statusTypeName - The name of the status type to check
 * @returns true if the status type represents work in progress
 */
export function isInProgressStatusType(statusTypeName: string | null | undefined): boolean {
  if (!statusTypeName) return false;
  return STATUS_TYPE_CATEGORIES.IN_PROGRESS.includes(statusTypeName.toLowerCase() as any);
}

/**
 * Check if a status type name represents blocked work
 * @param statusTypeName - The name of the status type to check
 * @returns true if the status type represents blocked work
 */
/**
 * Check if a status type name represents testing/review work
 * @param statusTypeName - The name of the status type to check
 * @returns true if the status type represents testing/review work
 */
export function isTestingStatusType(statusTypeName: string | null | undefined): boolean {
  if (!statusTypeName) return false;
  return STATUS_TYPE_CATEGORIES.TESTING.includes(statusTypeName.toLowerCase() as any);
}

export function isBlockedStatusType(_statusTypeName: string | null | undefined): boolean {
  // No blocked status_type exists in the DB — always returns false
  return false;
}

/**
 * Get the category for a given status type name
 * @param statusTypeName - The name of the status type to categorize
 * @returns The category name or null if not found
 */
export function getStatusTypeCategory(statusTypeName: string | null | undefined): StatusTypeCategory | null {
  if (!statusTypeName) return null;
  const lowerName = statusTypeName.toLowerCase();

  for (const [category, types] of Object.entries(STATUS_TYPE_CATEGORIES)) {
    if ((types as readonly string[]).includes(lowerName)) {
      return category as StatusTypeCategory;
    }
  }

  return null;
}

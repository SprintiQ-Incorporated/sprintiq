import type { Status, StatusType } from "@/lib/database-aliases";

export const STATUS_TYPES = {
  NOT_STARTED: "not-started",
  ACTIVE: "active",
  TESTING: "testing",
  DONE: "done",
} as const;

export type StatusTypeName = (typeof STATUS_TYPES)[keyof typeof STATUS_TYPES];

/**
 * Get or create the "not-started" status type
 */
export const getOrCreateNotStartedStatusType = async (
  supabase: any
): Promise<string | null> => {
  try {
    // First try to get existing "not-started" status type
    const { data: existingStatusType } = await supabase
      .from("status_types")
      .select("id")
      .eq("name", "not-started")
      .single();

    if (existingStatusType) {
      return existingStatusType.id;
    }

    // If not found, create it
    const { data: newStatusType, error } = await supabase
      .from("status_types")
      .insert({
        name: "not-started",
      })
      .select("id")
      .single();

    if (error) {
      console.error("Error creating not-started status type:", error);
      return null;
    }

    return newStatusType.id;
  } catch (error) {
    console.error("Error getting or creating not-started status type:", error);
    return null;
  }
};

/**
 * Get statuses by status type name
 */
export const getStatusesByType = (
  statuses: Status[],
  statusTypeName: StatusTypeName
): Status[] => {
  return statuses.filter(
    (status) =>
      status.status_type?.name.toLowerCase() === statusTypeName.toLowerCase()
  );
};

/**
 * Get completed statuses (done and closed)
 */
export const getCompletedStatuses = (statuses: Status[]): Status[] => {
  return statuses.filter(
    (status) =>
      status.status_type &&
      status.status_type.name.toLowerCase() === STATUS_TYPES.DONE
  );
};

/**
 * Get active statuses
 */
export const getActiveStatuses = (statuses: Status[]): Status[] => {
  return getStatusesByType(statuses, STATUS_TYPES.ACTIVE);
};

/**
 * Get not started statuses
 */
export const getNotStartedStatuses = (statuses: Status[]): Status[] => {
  return getStatusesByType(statuses, STATUS_TYPES.NOT_STARTED);
};

/**
 * Check if a status is completed
 */
export const isStatusCompleted = (status: Status): boolean => {
  return Boolean(
    status.status_type &&
      status.status_type.name.toLowerCase() === STATUS_TYPES.DONE
  );
};

/**
 * Check if a status is active
 */
export const isStatusActive = (status: Status): boolean => {
  return status.status_type?.name.toLowerCase() === STATUS_TYPES.ACTIVE;
};

/**
 * Check if a status is not started
 */
export const isStatusNotStarted = (status: Status): boolean => {
  return status.status_type?.name.toLowerCase() === STATUS_TYPES.NOT_STARTED;
};

/**
 * Check if a status is testing
 */
export const isStatusTesting = (status: Status): boolean => {
  return status.status_type?.name.toLowerCase() === STATUS_TYPES.TESTING;
};

/**
 * Get status type color for UI
 */
export const getStatusTypeColor = (statusTypeName: StatusTypeName): string => {
  switch (statusTypeName) {
    case STATUS_TYPES.NOT_STARTED:
      return "bg-gray-500";
    case STATUS_TYPES.ACTIVE:
      return "bg-blue-500";
    case STATUS_TYPES.TESTING:
      return "bg-orange-500";
    case STATUS_TYPES.DONE:
      return "bg-green-500";
    default:
      return "bg-gray-500";
  }
};

/**
 * Get status type icon for UI
 */
export const getStatusTypeIcon = (statusTypeName: StatusTypeName) => {
  const { Clock, Play, CheckCircle2, FlaskConical } = require("lucide-react");

  switch (statusTypeName) {
    case STATUS_TYPES.NOT_STARTED:
      return Clock;
    case STATUS_TYPES.ACTIVE:
      return Play;
    case STATUS_TYPES.TESTING:
      return FlaskConical;
    case STATUS_TYPES.DONE:
      return CheckCircle2;
    default:
      return Clock;
  }
};

/**
 * Sidebar Subscriptions Hook
 * Handles custom window events for cross-component communication.
 * Note: Supabase real-time subscriptions are in use-sidebar-data.ts
 */
import { useEffect } from "react";

export interface SidebarEventCallbacks {
  onTaskChange?: () => void;
  onProjectChange?: () => void;
  onSpaceChange?: () => void;
  onSprintChange?: () => void;
  onSprintFolderChange?: () => void;
  onEventRead?: () => void;
  onFavoritesChange?: (type: "project" | "sprint-folder") => void;
  onRefreshAll?: () => void;
}

/** Custom event names used by the sidebar */
export const SIDEBAR_EVENTS = {
  TASK_CREATED: "taskCreated",
  TASK_DELETED: "taskDeleted",
  PROJECT_CREATED: "projectCreated",
  PROJECT_RENAMED: "projectRenamed",
  PROJECT_DELETED: "projectDeleted",
  PROJECT_FAVORITED: "projectFavorited",
  SPACE_CREATED: "spaceCreated",
  SPRINT_CREATED: "sprintCreated",
  SPRINT_FOLDER_CREATED: "sprintFolderCreated",
  SPRINT_FOLDER_FAVORITED: "sprintFolderFavorited",
  EVENT_MARKED_READ: "eventMarkedAsRead",
  ALL_EVENTS_READ: "allEventsMarkedAsRead",
  REFRESH_SIDEBAR: "refreshSidebar",
} as const;

type EventName = (typeof SIDEBAR_EVENTS)[keyof typeof SIDEBAR_EVENTS];

/**
 * Subscribe to custom window events for sidebar updates.
 * All callbacks should be memoized (useCallback) in the parent.
 */
export function useSidebarSubscriptions(cbs: SidebarEventCallbacks): void {
  useEffect(() => {
    const handlers: [EventName, EventListener][] = [];
    const add = (e: EventName, fn?: () => void) => {
      if (fn) { handlers.push([e, fn as EventListener]); window.addEventListener(e, fn as EventListener); }
    };

    // Task events
    add(SIDEBAR_EVENTS.TASK_CREATED, cbs.onTaskChange);
    add(SIDEBAR_EVENTS.TASK_DELETED, cbs.onTaskChange);
    // Project events
    add(SIDEBAR_EVENTS.PROJECT_CREATED, cbs.onProjectChange);
    add(SIDEBAR_EVENTS.PROJECT_RENAMED, cbs.onProjectChange);
    add(SIDEBAR_EVENTS.PROJECT_DELETED, cbs.onProjectChange);
    // Space/Sprint events
    add(SIDEBAR_EVENTS.SPACE_CREATED, cbs.onSpaceChange);
    add(SIDEBAR_EVENTS.SPRINT_CREATED, cbs.onSprintChange);
    add(SIDEBAR_EVENTS.SPRINT_FOLDER_CREATED, cbs.onSprintFolderChange);
    // Event read
    add(SIDEBAR_EVENTS.EVENT_MARKED_READ, cbs.onEventRead);
    add(SIDEBAR_EVENTS.ALL_EVENTS_READ, cbs.onEventRead);
    // Favorites
    if (cbs.onFavoritesChange) {
      add(SIDEBAR_EVENTS.PROJECT_FAVORITED, () => cbs.onFavoritesChange!("project"));
      add(SIDEBAR_EVENTS.SPRINT_FOLDER_FAVORITED, () => cbs.onFavoritesChange!("sprint-folder"));
    }
    // Refresh all
    add(SIDEBAR_EVENTS.REFRESH_SIDEBAR, cbs.onRefreshAll);

    return () => { handlers.forEach(([e, l]) => window.removeEventListener(e, l)); };
  }, [cbs.onTaskChange, cbs.onProjectChange, cbs.onSpaceChange, cbs.onSprintChange,
      cbs.onSprintFolderChange, cbs.onEventRead, cbs.onFavoritesChange, cbs.onRefreshAll]);
}

/** Emit a sidebar event to trigger updates across components */
export function emitSidebarEvent(event: keyof typeof SIDEBAR_EVENTS, detail?: Record<string, unknown>): void {
  window.dispatchEvent(new CustomEvent(SIDEBAR_EVENTS[event], { detail }));
}

import { Role, Level } from "@/lib/database-aliases";
import { logger } from '@/lib/logger';

/**
 * Session storage for last selected role category
 */
interface CategorySession {
  categoryId: string;
  timestamp: number;
  expiresAt: number;
}

const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Role difficulty type from template_data
 */
export type RoleDifficulty = "beginner" | "intermediate" | "advanced";

/**
 * Mapping of role difficulty to applicable level names
 * - beginner: Entry-level and early career positions
 * - intermediate: Mid-career positions
 * - advanced: Senior and leadership positions
 */
export const DIFFICULTY_TO_LEVELS: Record<RoleDifficulty, string[]> = {
  beginner: ["Junior", "Mid-Level"],
  intermediate: ["Mid-Level", "Senior", "Lead"],
  advanced: ["Senior", "Lead", "Principal", "Architect", "Manager", "Director", "VP", "C-Level"],
};

/**
 * Get difficulty from role template_data
 */
export function getRoleDifficulty(role: Role | null): RoleDifficulty | null {
  if (!role?.template_data) return null;

  const templateData = role.template_data as { difficulty?: RoleDifficulty };
  return templateData.difficulty || null;
}

/**
 * Filter levels based on role difficulty
 * If no role is selected or role has no difficulty, returns all levels
 */
export function filterLevelsByRoleDifficulty(
  levels: Level[],
  role: Role | null
): Level[] {
  const difficulty = getRoleDifficulty(role);

  // If no difficulty information, return all levels
  if (!difficulty) return levels;

  const applicableLevelNames = DIFFICULTY_TO_LEVELS[difficulty];

  return levels.filter((level) =>
    applicableLevelNames.includes(level.name)
  );
}

/**
 * Get suggested level for a role based on its difficulty
 * Returns the first (lowest) level in the applicable range
 */
export function getSuggestedLevelForRole(
  levels: Level[],
  role: Role | null
): Level | null {
  const filteredLevels = filterLevelsByRoleDifficulty(levels, role);
  if (filteredLevels.length === 0) return null;

  // Define level order for sorting
  const levelOrder = [
    "Junior",
    "Mid-Level",
    "Senior",
    "Lead",
    "Principal",
    "Architect",
    "Manager",
    "Director",
    "VP",
    "C-Level",
  ];

  // Sort filtered levels by the defined order
  const sortedLevels = [...filteredLevels].sort((a, b) => {
    const aIndex = levelOrder.indexOf(a.name);
    const bIndex = levelOrder.indexOf(b.name);
    return aIndex - bIndex;
  });

  return sortedLevels[0];
}

/**
 * Get session storage key for workspace category preference
 */
export function getCategorySessionKey(workspaceId: string): string {
  return `sprintiq:lastRoleCategory:${workspaceId}`;
}

/**
 * Save last selected category to session storage
 */
export function saveLastCategory(workspaceId: string, categoryId: string): void {
  if (typeof window === "undefined") return;

  const session: CategorySession = {
    categoryId,
    timestamp: Date.now(),
    expiresAt: Date.now() + SESSION_DURATION,
  };

  try {
    sessionStorage.setItem(getCategorySessionKey(workspaceId), JSON.stringify(session));
  } catch (error) {
    logger.warn("Failed to save category preference", { error });
  }
}

/**
 * Get last selected category from session storage
 */
export function getLastCategory(workspaceId: string): string | null {
  if (typeof window === "undefined") return null;

  try {
    const stored = sessionStorage.getItem(getCategorySessionKey(workspaceId));
    if (!stored) return null;

    const session: CategorySession = JSON.parse(stored);

    // Check if expired
    if (Date.now() > session.expiresAt) {
      sessionStorage.removeItem(getCategorySessionKey(workspaceId));
      return null;
    }

    return session.categoryId;
  } catch (error) {
    logger.warn("Failed to retrieve category preference", { error });
    return null;
  }
}

/**
 * Clear category preference from session storage
 */
export function clearLastCategory(workspaceId: string): void {
  if (typeof window === "undefined") return;

  try {
    sessionStorage.removeItem(getCategorySessionKey(workspaceId));
  } catch (error) {
    logger.warn("Failed to clear category preference", { error });
  }
}

/**
 * Filter roles by category
 */
export function filterRolesByCategory(
  roles: Role[],
  categoryId: string
): Role[] {
  if (categoryId === "all") return roles;

  return roles.filter((role) => (role.category || "General") === categoryId);
}

/**
 * Sort roles: template first, then custom (both alphabetical)
 */
export function sortRoles(roles: Role[]): Role[] {
  return [...roles].sort((a, b) => {
    // Template roles come first
    if (a.is_template && !b.is_template) return -1;
    if (!a.is_template && b.is_template) return 1;

    // Within same type, sort alphabetically
    return a.name.localeCompare(b.name);
  });
}

/**
 * Split roles into template and custom groups
 */
export function splitRolesByType(roles: Role[]): {
  templateRoles: Role[];
  customRoles: Role[];
} {
  const templateRoles = roles.filter((role) => role.is_template);
  const customRoles = roles.filter((role) => !role.is_template);

  return {
    templateRoles: sortRoles(templateRoles),
    customRoles: sortRoles(customRoles),
  };
}

/**
 * Get role count by category
 */
export function getRoleCounts(roles: Role[]): Record<string, number> {
  const counts: Record<string, number> = {};

  roles.forEach((role) => {
    const category = role.category || "General";
    counts[category] = (counts[category] || 0) + 1;
  });

  return counts;
}

/**
 * Role Helpers Utility Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getRoleDifficulty,
  filterLevelsByRoleDifficulty,
  getSuggestedLevelForRole,
  getCategorySessionKey,
  saveLastCategory,
  getLastCategory,
  clearLastCategory,
  filterRolesByCategory,
  sortRoles,
  splitRolesByType,
  getRoleCounts,
  type RoleDifficulty,
} from '@/utils/role-helpers';
import type { Role, Level } from '@/lib/database-aliases';

describe('role-helpers', () => {
  const mockLevels: Level[] = [
    { id: '1', name: 'Junior', sort_order: 1, workspace_id: 'w1', created_at: '', updated_at: '' },
    { id: '2', name: 'Mid-Level', sort_order: 2, workspace_id: 'w1', created_at: '', updated_at: '' },
    { id: '3', name: 'Senior', sort_order: 3, workspace_id: 'w1', created_at: '', updated_at: '' },
    { id: '4', name: 'Lead', sort_order: 4, workspace_id: 'w1', created_at: '', updated_at: '' },
    { id: '5', name: 'Principal', sort_order: 5, workspace_id: 'w1', created_at: '', updated_at: '' },
    { id: '6', name: 'Director', sort_order: 6, workspace_id: 'w1', created_at: '', updated_at: '' },
  ];

  describe('getRoleDifficulty', () => {
    it('should return null when role is null', () => {
      expect(getRoleDifficulty(null)).toBeNull();
    });

    it('should return null when role has no template_data', () => {
      const role: Partial<Role> = {
        id: '1',
        name: 'Developer',
      };

      expect(getRoleDifficulty(role as Role)).toBeNull();
    });

    it('should return difficulty from template_data', () => {
      const role: Partial<Role> = {
        id: '1',
        name: 'Developer',
        template_data: { difficulty: 'intermediate' as RoleDifficulty },
      };

      expect(getRoleDifficulty(role as Role)).toBe('intermediate');
    });

    it('should handle all difficulty levels', () => {
      const difficulties: RoleDifficulty[] = ['beginner', 'intermediate', 'advanced'];

      difficulties.forEach((difficulty) => {
        const role: Partial<Role> = {
          id: '1',
          name: 'Developer',
          template_data: { difficulty },
        };

        expect(getRoleDifficulty(role as Role)).toBe(difficulty);
      });
    });
  });

  describe('filterLevelsByRoleDifficulty', () => {
    it('should return all levels when role is null', () => {
      const result = filterLevelsByRoleDifficulty(mockLevels, null);
      expect(result).toEqual(mockLevels);
    });

    it('should return all levels when role has no difficulty', () => {
      const role: Partial<Role> = {
        id: '1',
        name: 'Developer',
      };

      const result = filterLevelsByRoleDifficulty(mockLevels, role as Role);
      expect(result).toEqual(mockLevels);
    });

    it('should filter levels for beginner difficulty', () => {
      const role: Partial<Role> = {
        id: '1',
        name: 'Developer',
        template_data: { difficulty: 'beginner' as RoleDifficulty },
      };

      const result = filterLevelsByRoleDifficulty(mockLevels, role as Role);
      expect(result).toHaveLength(2);
      expect(result.map((l) => l.name)).toEqual(['Junior', 'Mid-Level']);
    });

    it('should filter levels for intermediate difficulty', () => {
      const role: Partial<Role> = {
        id: '1',
        name: 'Developer',
        template_data: { difficulty: 'intermediate' as RoleDifficulty },
      };

      const result = filterLevelsByRoleDifficulty(mockLevels, role as Role);
      expect(result).toHaveLength(3);
      expect(result.map((l) => l.name)).toEqual(['Mid-Level', 'Senior', 'Lead']);
    });

    it('should filter levels for advanced difficulty', () => {
      const role: Partial<Role> = {
        id: '1',
        name: 'Developer',
        template_data: { difficulty: 'advanced' as RoleDifficulty },
      };

      const result = filterLevelsByRoleDifficulty(mockLevels, role as Role);
      expect(result).toHaveLength(4);
      expect(result.map((l) => l.name)).toEqual(['Senior', 'Lead', 'Principal', 'Director']);
    });
  });

  describe('getSuggestedLevelForRole', () => {
    it('should return null when no levels available', () => {
      const role: Partial<Role> = {
        id: '1',
        name: 'Developer',
        template_data: { difficulty: 'beginner' as RoleDifficulty },
      };

      const result = getSuggestedLevelForRole([], role as Role);
      expect(result).toBeNull();
    });

    it('should return lowest level for beginner role', () => {
      const role: Partial<Role> = {
        id: '1',
        name: 'Developer',
        template_data: { difficulty: 'beginner' as RoleDifficulty },
      };

      const result = getSuggestedLevelForRole(mockLevels, role as Role);
      expect(result?.name).toBe('Junior');
    });

    it('should return lowest applicable level for intermediate role', () => {
      const role: Partial<Role> = {
        id: '1',
        name: 'Developer',
        template_data: { difficulty: 'intermediate' as RoleDifficulty },
      };

      const result = getSuggestedLevelForRole(mockLevels, role as Role);
      expect(result?.name).toBe('Mid-Level');
    });

    it('should return lowest applicable level for advanced role', () => {
      const role: Partial<Role> = {
        id: '1',
        name: 'Developer',
        template_data: { difficulty: 'advanced' as RoleDifficulty },
      };

      const result = getSuggestedLevelForRole(mockLevels, role as Role);
      expect(result?.name).toBe('Senior');
    });

    it('should return first level when role has no difficulty', () => {
      const role: Partial<Role> = {
        id: '1',
        name: 'Developer',
      };

      const result = getSuggestedLevelForRole(mockLevels, role as Role);
      expect(result?.name).toBe('Junior');
    });
  });

  describe('getCategorySessionKey', () => {
    it('should generate correct session key', () => {
      const workspaceId = 'w123456789';
      const key = getCategorySessionKey(workspaceId);
      expect(key).toBe('sprintiq:lastRoleCategory:w123456789');
    });

    it('should generate unique keys for different workspaces', () => {
      const key1 = getCategorySessionKey('workspace1');
      const key2 = getCategorySessionKey('workspace2');
      expect(key1).not.toBe(key2);
    });
  });

  describe('saveLastCategory', () => {
    beforeEach(() => {
      // Mock sessionStorage
      const store: Record<string, string> = {};
      Object.defineProperty(window, 'sessionStorage', {
        value: {
          getItem: (key: string) => store[key] || null,
          setItem: (key: string, value: string) => {
            store[key] = value;
          },
          removeItem: (key: string) => {
            delete store[key];
          },
          clear: () => {
            Object.keys(store).forEach((key) => delete store[key]);
          },
        },
        configurable: true,
      });
    });

    it('should save category to session storage', () => {
      const workspaceId = 'w123456789';
      const categoryId = 'cat-1';

      saveLastCategory(workspaceId, categoryId);

      const key = getCategorySessionKey(workspaceId);
      const stored = window.sessionStorage.getItem(key);
      expect(stored).toBeTruthy();
    });

    it('should handle SSR environment gracefully', () => {
      const originalWindow = global.window;
      // @ts-ignore
      delete global.window;

      expect(() => {
        saveLastCategory('workspace', 'category');
      }).not.toThrow();

      global.window = originalWindow;
    });
  });

  describe('getLastCategory', () => {
    beforeEach(() => {
      const store: Record<string, string> = {};
      Object.defineProperty(window, 'sessionStorage', {
        value: {
          getItem: (key: string) => store[key] || null,
          setItem: (key: string, value: string) => {
            store[key] = value;
          },
          removeItem: (key: string) => {
            delete store[key];
          },
          clear: () => {
            Object.keys(store).forEach((key) => delete store[key]);
          },
        },
        configurable: true,
      });
    });

    it('should retrieve saved category', () => {
      const workspaceId = 'w123456789';
      const categoryId = 'cat-1';
      saveLastCategory(workspaceId, categoryId);

      const retrieved = getLastCategory(workspaceId);
      expect(retrieved).toBe(categoryId);
    });

    it('should return null for non-existent category', () => {
      const retrieved = getLastCategory('non-existent');
      expect(retrieved).toBeNull();
    });

    it('should return null for invalid JSON', () => {
      const key = getCategorySessionKey('workspace');
      window.sessionStorage.setItem(key, 'invalid-json');

      const retrieved = getLastCategory('workspace');
      expect(retrieved).toBeNull();
    });
  });

  describe('clearLastCategory', () => {
    beforeEach(() => {
      const store: Record<string, string> = {};
      Object.defineProperty(window, 'sessionStorage', {
        value: {
          getItem: (key: string) => store[key] || null,
          setItem: (key: string, value: string) => {
            store[key] = value;
          },
          removeItem: (key: string) => {
            delete store[key];
          },
          clear: () => {
            Object.keys(store).forEach((key) => delete store[key]);
          },
        },
        configurable: true,
      });
    });

    it('should remove category from session storage', () => {
      const workspaceId = 'w123456789';
      const categoryId = 'cat-1';
      saveLastCategory(workspaceId, categoryId);

      clearLastCategory(workspaceId);

      const key = getCategorySessionKey(workspaceId);
      const stored = window.sessionStorage.getItem(key);
      expect(stored).toBeNull();
    });
  });

  describe('filterRolesByCategory', () => {
    const roles: Partial<Role>[] = [
      { id: '1', name: 'Developer', category: 'Engineering', is_template: true },
      { id: '2', name: 'Designer', category: 'Design', is_template: true },
      { id: '3', name: 'Manager', category: 'Management', is_template: false },
      { id: '4', name: 'Analyst', category: null, is_template: false },
    ];

    it('should return all roles when category is "all"', () => {
      const filtered = filterRolesByCategory(roles as Role[], 'all');
      expect(filtered).toHaveLength(4);
    });

    it('should filter by specific category', () => {
      const filtered = filterRolesByCategory(roles as Role[], 'Engineering');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('Developer');
    });

    it('should treat null category as "General"', () => {
      const filtered = filterRolesByCategory(roles as Role[], 'General');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('Analyst');
    });

    it('should return empty array when no roles match', () => {
      const filtered = filterRolesByCategory(roles as Role[], 'NonExistent');
      expect(filtered).toHaveLength(0);
    });
  });

  describe('sortRoles', () => {
    it('should sort template roles before custom roles', () => {
      const roles: Partial<Role>[] = [
        { name: 'Custom B', is_template: false },
        { name: 'Template A', is_template: true },
        { name: 'Custom A', is_template: false },
        { name: 'Template B', is_template: true },
      ];

      const sorted = sortRoles(roles as Role[]);

      expect(sorted[0].name).toBe('Template A');
      expect(sorted[1].name).toBe('Template B');
      expect(sorted[2].name).toBe('Custom A');
      expect(sorted[3].name).toBe('Custom B');
    });

    it('should sort alphabetically within same type', () => {
      const roles: Partial<Role>[] = [
        { name: 'Zebra', is_template: true },
        { name: 'Apple', is_template: true },
        { name: 'Mango', is_template: true },
      ];

      const sorted = sortRoles(roles as Role[]);

      expect(sorted[0].name).toBe('Apple');
      expect(sorted[1].name).toBe('Mango');
      expect(sorted[2].name).toBe('Zebra');
    });

    it('should not mutate original array', () => {
      const roles: Partial<Role>[] = [
        { name: 'B', is_template: false },
        { name: 'A', is_template: false },
      ];

      const original = [...roles];
      sortRoles(roles as Role[]);

      expect(roles).toEqual(original);
    });
  });

  describe('splitRolesByType', () => {
    it('should split roles into template and custom groups', () => {
      const roles: Partial<Role>[] = [
        { name: 'Developer', is_template: true },
        { name: 'Designer', is_template: true },
        { name: 'Custom Role', is_template: false },
        { name: 'Another Custom', is_template: false },
      ];

      const { templateRoles, customRoles } = splitRolesByType(roles as Role[]);

      expect(templateRoles).toHaveLength(2);
      expect(customRoles).toHaveLength(2);
    });

    it('should sort both groups alphabetically', () => {
      const roles: Partial<Role>[] = [
        { name: 'Zebra', is_template: true },
        { name: 'Custom Zebra', is_template: false },
        { name: 'Apple', is_template: true },
        { name: 'Custom Apple', is_template: false },
      ];

      const { templateRoles, customRoles } = splitRolesByType(roles as Role[]);

      expect(templateRoles[0].name).toBe('Apple');
      expect(templateRoles[1].name).toBe('Zebra');
      expect(customRoles[0].name).toBe('Custom Apple');
      expect(customRoles[1].name).toBe('Custom Zebra');
    });

    it('should handle all template roles', () => {
      const roles: Partial<Role>[] = [
        { name: 'A', is_template: true },
        { name: 'B', is_template: true },
      ];

      const { templateRoles, customRoles } = splitRolesByType(roles as Role[]);

      expect(templateRoles).toHaveLength(2);
      expect(customRoles).toHaveLength(0);
    });
  });

  describe('getRoleCounts', () => {
    it('should count roles by category', () => {
      const roles: Partial<Role>[] = [
        { category: 'Engineering' },
        { category: 'Engineering' },
        { category: 'Design' },
        { category: 'Management' },
      ];

      const counts = getRoleCounts(roles as Role[]);

      expect(counts['Engineering']).toBe(2);
      expect(counts['Design']).toBe(1);
      expect(counts['Management']).toBe(1);
    });

    it('should treat null category as "General"', () => {
      const roles: Partial<Role>[] = [
        { category: null },
        { category: null },
        { category: 'Engineering' },
      ];

      const counts = getRoleCounts(roles as Role[]);

      expect(counts['General']).toBe(2);
      expect(counts['Engineering']).toBe(1);
    });

    it('should handle empty array', () => {
      const counts = getRoleCounts([]);
      expect(counts).toEqual({});
    });
  });
});

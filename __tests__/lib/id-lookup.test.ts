import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isValidUUID,
  assertValidUUIDs,
  verifyWorkspaceMembership,
  resolveWorkspaceId,
  resolveSpaceId,
  resolveProjectId,
  resolveStatusId,
  batchResolveIds,
  type ResolvedWorkspaceContext,
  type ResolvedSpaceContext,
  type ResolvedProjectContext,
  type ResolvedStatusContext,
} from '@/lib/utils/id-lookup';
import { SupabaseClient } from '@supabase/supabase-js';

// Create a chainable mock builder
const createChainableMock = (mockSingle: any) => {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    single: mockSingle,
  };
  
  // Make all methods return the chain
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.is.mockReturnValue(chain);
  chain.ilike.mockReturnValue(chain);
  
  return chain;
};

// Mock Supabase client
const createMockSupabase = () => {
  const mockSingle = vi.fn();
  const mockFrom = vi.fn((tableName: string) => {
    return createChainableMock(mockSingle);
  });

  const supabase = {
    from: mockFrom,
  } as unknown as SupabaseClient;

  return {
    supabase,
    mockFrom,
    mockSingle,
  };
};

describe('ID Lookup Utilities', () => {
  describe('isValidUUID', () => {
    it('should return true for valid UUIDs', () => {
      expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
      expect(isValidUUID('6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(true);
      expect(isValidUUID('00000000-0000-0000-0000-000000000000')).toBe(true);
      expect(isValidUUID('FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF')).toBe(true);
    });

    it('should return false for invalid UUIDs', () => {
      expect(isValidUUID('not-a-uuid')).toBe(false);
      expect(isValidUUID('w123456789')).toBe(false);
      expect(isValidUUID('550e8400-e29b-41d4-a716')).toBe(false); // Too short
      expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000-extra')).toBe(false); // Too long
      expect(isValidUUID('550e8400e29b41d4a716446655440000')).toBe(false); // No hyphens
      expect(isValidUUID('')).toBe(false);
      expect(isValidUUID('550e8400-e29b-41d4-a716-44665544000g')).toBe(false); // Invalid char 'g'
    });
  });

  describe('assertValidUUIDs', () => {
    it('should not throw for valid UUIDs', () => {
      const ids = {
        workspaceId: '550e8400-e29b-41d4-a716-446655440000',
        spaceId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
      };

      expect(() => assertValidUUIDs(ids, 'test context')).not.toThrow();
    });

    it('should throw for missing UUIDs', () => {
      const ids = {
        workspaceId: '550e8400-e29b-41d4-a716-446655440000',
        spaceId: null,
      };

      expect(() => assertValidUUIDs(ids, 'test context')).toThrow(
        'Invalid UUIDs in test context: spaceId is missing'
      );
    });

    it('should throw for undefined UUIDs', () => {
      const ids = {
        workspaceId: '550e8400-e29b-41d4-a716-446655440000',
        spaceId: undefined,
      };

      expect(() => assertValidUUIDs(ids, 'test context')).toThrow(
        'Invalid UUIDs in test context: spaceId is missing'
      );
    });

    it('should throw for invalid UUID format', () => {
      const ids = {
        workspaceId: '550e8400-e29b-41d4-a716-446655440000',
        spaceId: 'not-a-uuid',
      };

      expect(() => assertValidUUIDs(ids, 'test context')).toThrow(
        'Invalid UUIDs in test context: spaceId is not a valid UUID: not-a-uuid'
      );
    });

    it('should throw for multiple invalid UUIDs', () => {
      const ids = {
        workspaceId: 'invalid1',
        spaceId: 'invalid2',
        projectId: null,
      };

      const error = () => assertValidUUIDs(ids, 'test context');
      expect(error).toThrow('Invalid UUIDs in test context');
      expect(error).toThrow('workspaceId is not a valid UUID');
      expect(error).toThrow('spaceId is not a valid UUID');
      expect(error).toThrow('projectId is missing');
    });

    it('should handle empty object', () => {
      expect(() => assertValidUUIDs({}, 'test context')).not.toThrow();
    });
  });

  describe('verifyWorkspaceMembership', () => {
    it('should return true when user is workspace member', async () => {
      const { supabase, mockSingle } = createMockSupabase();
      mockSingle.mockResolvedValue({
        data: { id: 'member-uuid' },
        error: null,
      });

      const result = await verifyWorkspaceMembership(
        supabase,
        '550e8400-e29b-41d4-a716-446655440000',
        'user-uuid'
      );

      expect(result).toBe(true);
    });

    it('should return false when user is not workspace member', async () => {
      const { supabase, mockSingle } = createMockSupabase();
      mockSingle.mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      });

      const result = await verifyWorkspaceMembership(
        supabase,
        '550e8400-e29b-41d4-a716-446655440000',
        'user-uuid'
      );

      expect(result).toBe(false);
    });

    it('should return false when data is null', async () => {
      const { supabase, mockSingle } = createMockSupabase();
      mockSingle.mockResolvedValue({
        data: null,
        error: null,
      });

      const result = await verifyWorkspaceMembership(
        supabase,
        '550e8400-e29b-41d4-a716-446655440000',
        'user-uuid'
      );

      expect(result).toBe(false);
    });
  });

  describe('resolveWorkspaceId', () => {
    it('should resolve workspace by friendly ID', async () => {
      const { supabase, mockSingle } = createMockSupabase();
      mockSingle.mockResolvedValue({
        data: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          workspace_id: 'w123456789',
          name: 'Test Workspace',
        },
        error: null,
      });

      const result = await resolveWorkspaceId(supabase, 'w123456789');

      expect(result).toEqual({
        workspaceUUID: '550e8400-e29b-41d4-a716-446655440000',
        workspaceFriendlyId: 'w123456789',
        workspaceName: 'Test Workspace',
      });
    });

    it('should resolve workspace by UUID', async () => {
      const { supabase, mockSingle } = createMockSupabase();
      mockSingle.mockResolvedValue({
        data: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          workspace_id: 'w123456789',
          name: 'Test Workspace',
        },
        error: null,
      });

      const result = await resolveWorkspaceId(
        supabase,
        '550e8400-e29b-41d4-a716-446655440000'
      );

      expect(result.workspaceUUID).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(result.workspaceFriendlyId).toBe('w123456789');
    });

    it('should throw error when workspace not found by friendly ID', async () => {
      const { supabase, mockSingle } = createMockSupabase();
      mockSingle.mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      });

      await expect(resolveWorkspaceId(supabase, 'w999999999')).rejects.toThrow(
        'Workspace not found for friendly ID: w999999999'
      );
    });

    it('should throw error when workspace not found by UUID', async () => {
      const { supabase, mockSingle } = createMockSupabase();
      mockSingle.mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      });

      await expect(
        resolveWorkspaceId(supabase, '550e8400-e29b-41d4-a716-446655440000')
      ).rejects.toThrow('Workspace not found by UUID');
    });

    it('should throw error when data is null', async () => {
      const { supabase, mockSingle } = createMockSupabase();
      mockSingle.mockResolvedValue({
        data: null,
        error: null,
      });

      await expect(resolveWorkspaceId(supabase, 'w123456789')).rejects.toThrow(
        'Workspace not found'
      );
    });
  });

  describe('resolveSpaceId', () => {
    it('should resolve space by friendly ID', async () => {
      const { supabase, mockSingle } = createMockSupabase();
      mockSingle.mockResolvedValue({
        data: {
          id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
          space_id: 's036717105687',
          name: 'Test Space',
          workspace_id: '550e8400-e29b-41d4-a716-446655440000',
        },
        error: null,
      });

      const result = await resolveSpaceId(supabase, 's036717105687');

      expect(result).toEqual({
        spaceUUID: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
        spaceFriendlyId: 's036717105687',
        spaceName: 'Test Space',
        workspaceUUID: '550e8400-e29b-41d4-a716-446655440000',
      });
    });

    it('should resolve space by UUID', async () => {
      const { supabase, mockSingle } = createMockSupabase();
      mockSingle.mockResolvedValue({
        data: {
          id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
          space_id: 's036717105687',
          name: 'Test Space',
          workspace_id: '550e8400-e29b-41d4-a716-446655440000',
        },
        error: null,
      });

      const result = await resolveSpaceId(
        supabase,
        '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
      );

      expect(result.spaceUUID).toBe('6ba7b810-9dad-11d1-80b4-00c04fd430c8');
    });

    it('should throw error when space not found', async () => {
      const { supabase, mockSingle } = createMockSupabase();
      mockSingle.mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      });

      await expect(resolveSpaceId(supabase, 's999999999')).rejects.toThrow(
        'Portfolio not found for ID: s999999999'
      );
    });
  });

  describe('resolveProjectId', () => {
    it('should resolve project by friendly ID', async () => {
      const { supabase, mockSingle } = createMockSupabase();
      mockSingle.mockResolvedValue({
        data: {
          id: '7ca7b810-9dad-11d1-80b4-00c04fd430c8',
          project_id: 'p269998695808',
          name: 'Test Project',
          space_id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
          workspace_id: '550e8400-e29b-41d4-a716-446655440000',
        },
        error: null,
      });

      const result = await resolveProjectId(supabase, 'p269998695808');

      expect(result).toEqual({
        projectUUID: '7ca7b810-9dad-11d1-80b4-00c04fd430c8',
        projectFriendlyId: 'p269998695808',
        projectName: 'Test Project',
        spaceUUID: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
        workspaceUUID: '550e8400-e29b-41d4-a716-446655440000',
      });
    });

    it('should resolve project by UUID', async () => {
      const { supabase, mockSingle } = createMockSupabase();
      mockSingle.mockResolvedValue({
        data: {
          id: '7ca7b810-9dad-11d1-80b4-00c04fd430c8',
          project_id: 'p269998695808',
          name: 'Test Project',
          space_id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
          workspace_id: '550e8400-e29b-41d4-a716-446655440000',
        },
        error: null,
      });

      const result = await resolveProjectId(
        supabase,
        '7ca7b810-9dad-11d1-80b4-00c04fd430c8'
      );

      expect(result.projectUUID).toBe('7ca7b810-9dad-11d1-80b4-00c04fd430c8');
    });

    it('should throw error when project not found', async () => {
      const { supabase, mockSingle } = createMockSupabase();
      mockSingle.mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      });

      await expect(resolveProjectId(supabase, 'p999999999')).rejects.toThrow(
        'Project not found'
      );
    });
  });

  describe('resolveStatusId', () => {
    it('should resolve status by friendly ID', async () => {
      const { supabase, mockSingle } = createMockSupabase();
      mockSingle.mockResolvedValue({
        data: {
          id: '8da7b810-9dad-11d1-80b4-00c04fd430c8',
          status_id: 'st123456789',
          name: 'In Progress',
          type: 'active',
          space_id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
        },
        error: null,
      });

      const result = await resolveStatusId(
        supabase,
        'st123456789',
        '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
      );

      expect(result).toEqual({
        statusUUID: '8da7b810-9dad-11d1-80b4-00c04fd430c8',
        statusFriendlyId: 'st123456789',
        statusName: 'In Progress',
        statusType: 'active',
        spaceUUID: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
      });
    });

    it('should resolve status by UUID', async () => {
      const { supabase, mockSingle } = createMockSupabase();
      mockSingle.mockResolvedValue({
        data: {
          id: '8da7b810-9dad-11d1-80b4-00c04fd430c8',
          status_id: 'st123456789',
          name: 'In Progress',
          type: 'active',
          space_id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
        },
        error: null,
      });

      const result = await resolveStatusId(
        supabase,
        '8da7b810-9dad-11d1-80b4-00c04fd430c8',
        '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
      );

      expect(result.statusUUID).toBe('8da7b810-9dad-11d1-80b4-00c04fd430c8');
    });

    it('should throw error when status not found', async () => {
      const { supabase, mockSingle } = createMockSupabase();
      mockSingle.mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      });

      await expect(
        resolveStatusId(
          supabase,
          'st999999999',
          '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
        )
      ).rejects.toThrow('Status not found');
    });
  });

  describe('batchResolveIds', () => {
    it('should resolve workspace only when provided', async () => {
      const { supabase, mockSingle } = createMockSupabase();
      mockSingle.mockResolvedValue({
        data: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          workspace_id: 'w123456789',
          name: 'Test Workspace',
        },
        error: null,
      });

      const result = await batchResolveIds(supabase, {
        workspaceId: 'w123456789',
      });

      expect(result.workspace).toBeDefined();
      expect(result.workspace?.workspaceUUID).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(result.space).toBeUndefined();
      expect(result.project).toBeUndefined();
    });

    it('should resolve multiple IDs in dependency order', async () => {
      const { supabase, mockSingle } = createMockSupabase();
      mockSingle
        .mockResolvedValueOnce({
          data: {
            id: '550e8400-e29b-41d4-a716-446655440000',
            workspace_id: 'w123456789',
            name: 'Test Workspace',
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: {
            id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
            space_id: 's036717105687',
            name: 'Test Space',
            workspace_id: '550e8400-e29b-41d4-a716-446655440000',
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: {
            id: '7ca7b810-9dad-11d1-80b4-00c04fd430c8',
            project_id: 'p269998695808',
            name: 'Test Project',
            space_id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
            workspace_id: '550e8400-e29b-41d4-a716-446655440000',
          },
          error: null,
        });

      const result = await batchResolveIds(supabase, {
        workspaceId: 'w123456789',
        spaceId: 's036717105687',
        projectId: 'p269998695808',
      });

      expect(result.workspace).toBeDefined();
      expect(result.space).toBeDefined();
      expect(result.project).toBeDefined();
      expect(result.workspace?.workspaceFriendlyId).toBe('w123456789');
      expect(result.space?.spaceFriendlyId).toBe('s036717105687');
      expect(result.project?.projectFriendlyId).toBe('p269998695808');
    });

    it('should return empty result when no IDs provided', async () => {
      const { supabase } = createMockSupabase();

      const result = await batchResolveIds(supabase, {});

      expect(result).toEqual({});
    });
  });
});

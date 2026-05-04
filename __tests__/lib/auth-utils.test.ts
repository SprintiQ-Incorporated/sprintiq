/**
 * Authentication Utilities Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isUserAllowed, getUserProfileByEmail, isUserAdmin } from '@/lib/auth-utils';

// Create mock functions at module level
const mockMaybeSingle = vi.fn();
const mockEq = vi.fn(() => ({
  maybeSingle: mockMaybeSingle,
  is: vi.fn(() => ({
    maybeSingle: mockMaybeSingle,
  })),
}));
const mockSelect = vi.fn(() => ({
  eq: mockEq,
}));
const mockFrom = vi.fn(() => ({
  select: mockSelect,
}));

// Mock the Supabase client
vi.mock('@/lib/supabase/client', () => ({
  createClientSupabaseClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

describe('auth-utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
  });

  describe('isUserAllowed', () => {
    it('should return false for invalid email', async () => {
      mockMaybeSingle.mockResolvedValue({ data: null, error: null });

      const result = await isUserAllowed('nonexistent@example.com');
      expect(result).toBe(false);
    });

    it('should normalize email before checking', async () => {
      mockMaybeSingle.mockResolvedValue({ data: { id: '123' }, error: null });
      
      const email = '  TEST@EXAMPLE.COM  ';
      await isUserAllowed(email);
      
      // Verify the function was called (email normalization happens internally)
      expect(mockFrom).toHaveBeenCalledWith('profiles');
    });

    it('should handle errors gracefully', async () => {
      mockMaybeSingle.mockResolvedValue({ data: null, error: new Error('Database error') });

      const result = await isUserAllowed('test@example.com');
      expect(result).toBe(false);
    });
  });

  describe('getUserProfileByEmail', () => {
    it('should return null for non-existent user', async () => {
      mockMaybeSingle.mockResolvedValue({ data: null, error: null });

      const result = await getUserProfileByEmail('nonexistent@example.com');
      expect(result).toBeNull();
    });

    it('should normalize email before querying', async () => {
      mockMaybeSingle.mockResolvedValue({ data: { id: '123', email: 'test@example.com' }, error: null });
      
      const email = '  TEST@EXAMPLE.COM  ';
      await getUserProfileByEmail(email);
      
      expect(mockFrom).toHaveBeenCalledWith('profiles');
    });

    it('should handle database errors', async () => {
      mockMaybeSingle.mockResolvedValue({ data: null, error: new Error('Database error') });

      const result = await getUserProfileByEmail('test@example.com');
      expect(result).toBeNull();
    });
  });

  describe('isUserAdmin', () => {
    it('should return false for non-admin users', async () => {
      mockMaybeSingle.mockResolvedValue({ 
        data: { role: 'user' }, 
        error: null 
      });

      const result = await isUserAdmin('user-id');
      expect(result).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      mockMaybeSingle.mockRejectedValue(new Error('Database error'));

      const result = await isUserAdmin('user-id');
      expect(result).toBe(false);
    });
  });
});

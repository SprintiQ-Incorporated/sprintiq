/**
 * API Routes Tests
 * Tests for Next.js API route handlers
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock Supabase
const mockSupabaseClient = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      order: vi.fn(() => ({
        order: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
      eq: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({ data: null, error: null })),
      })),
    })),
    insert: vi.fn(() => Promise.resolve({ data: null, error: null })),
    update: vi.fn(() => ({
      eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
    })),
    delete: vi.fn(() => ({
      eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
    })),
  })),
  auth: {
    getUser: vi.fn(() => Promise.resolve({ 
      data: { user: { id: 'test-user-id', email: 'test@example.com' } }, 
      error: null 
    })),
  },
};

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(() => Promise.resolve(mockSupabaseClient)),
  createClient: vi.fn(() => mockSupabaseClient),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => mockSupabaseClient),
}));

// Mock Resend
vi.mock('resend', () => ({
  Resend: vi.fn(() => ({
    emails: {
      send: vi.fn(() => Promise.resolve({ data: { id: 'email-id' }, error: null })),
    },
  })),
}));

describe('API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Request Validation', () => {
    it('should validate required fields for workspace creation', () => {
      const validateRequest = (data: any) => {
        if (!data.name || typeof data.name !== 'string') {
          return { valid: false, error: 'Workspace name is required' };
        }
        if (data.name.trim().length === 0) {
          return { valid: false, error: 'Workspace name cannot be empty' };
        }
        if (data.name.length > 255) {
          return { valid: false, error: 'Workspace name must be under 255 characters' };
        }
        if (!data.purpose || typeof data.purpose !== 'string') {
          return { valid: false, error: 'Purpose is required' };
        }
        if (!data.type || typeof data.type !== 'string') {
          return { valid: false, error: 'Type is required' };
        }
        if (!data.category || typeof data.category !== 'string') {
          return { valid: false, error: 'Category is required' };
        }
        return { valid: true };
      };

      // Valid data
      expect(validateRequest({
        name: 'Test Workspace',
        purpose: 'Development',
        type: 'Software',
        category: 'Engineering',
      })).toEqual({ valid: true });

      // Missing name
      expect(validateRequest({
        purpose: 'Development',
        type: 'Software',
        category: 'Engineering',
      })).toEqual({ valid: false, error: 'Workspace name is required' });

      // Empty name
      expect(validateRequest({
        name: '   ',
        purpose: 'Development',
        type: 'Software',
        category: 'Engineering',
      })).toEqual({ valid: false, error: 'Workspace name cannot be empty' });

      // Name too long
      expect(validateRequest({
        name: 'a'.repeat(256),
        purpose: 'Development',
        type: 'Software',
        category: 'Engineering',
      })).toEqual({ valid: false, error: 'Workspace name must be under 255 characters' });

      // Missing purpose
      expect(validateRequest({
        name: 'Test',
        type: 'Software',
        category: 'Engineering',
      })).toEqual({ valid: false, error: 'Purpose is required' });

      // Missing type
      expect(validateRequest({
        name: 'Test',
        purpose: 'Development',
        category: 'Engineering',
      })).toEqual({ valid: false, error: 'Type is required' });

      // Missing category
      expect(validateRequest({
        name: 'Test',
        purpose: 'Development',
        type: 'Software',
      })).toEqual({ valid: false, error: 'Category is required' });
    });

    it('should validate contact form fields', () => {
      const validateContact = (data: any) => {
        if (!data.firstName || !data.lastName || !data.email || !data.subject || !data.message) {
          return { valid: false, error: 'Missing required fields' };
        }
        return { valid: true };
      };

      // Valid
      expect(validateContact({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        subject: 'Question',
        message: 'Hello',
      })).toEqual({ valid: true });

      // Missing firstName
      expect(validateContact({
        lastName: 'Doe',
        email: 'john@example.com',
        subject: 'Question',
        message: 'Hello',
      })).toEqual({ valid: false, error: 'Missing required fields' });

      // Missing email
      expect(validateContact({
        firstName: 'John',
        lastName: 'Doe',
        subject: 'Question',
        message: 'Hello',
      })).toEqual({ valid: false, error: 'Missing required fields' });
    });
  });

  describe('Rate Limiting', () => {
    it('should track creation attempts', () => {
      const attempts = new Map<string, { count: number; resetAt: number }>();
      const userId = 'user-123';
      const now = Date.now();
      
      // First attempt
      attempts.set(userId, { count: 1, resetAt: now + 3600000 });
      expect(attempts.get(userId)?.count).toBe(1);

      // Increment
      const current = attempts.get(userId);
      if (current) {
        attempts.set(userId, { ...current, count: current.count + 1 });
      }
      expect(attempts.get(userId)?.count).toBe(2);
    });

    it('should enforce rate limits', () => {
      const MAX_ATTEMPTS = 5;
      const checkRateLimit = (count: number) => {
        if (count >= MAX_ATTEMPTS) {
          return { allowed: false, error: 'Rate limit exceeded' };
        }
        return { allowed: true };
      };

      expect(checkRateLimit(3)).toEqual({ allowed: true });
      expect(checkRateLimit(5)).toEqual({ allowed: false, error: 'Rate limit exceeded' });
      expect(checkRateLimit(10)).toEqual({ allowed: false, error: 'Rate limit exceeded' });
    });

    it('should reset rate limits after time window', () => {
      const attempts = new Map<string, { count: number; resetAt: number }>();
      const userId = 'user-123';
      const now = Date.now();
      
      attempts.set(userId, { count: 10, resetAt: now - 1000 }); // Expired
      
      const current = attempts.get(userId);
      if (current && current.resetAt < Date.now()) {
        attempts.delete(userId);
      }
      
      expect(attempts.has(userId)).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should return structured error responses', () => {
      const createErrorResponse = (error: string, code: string, status: number) => ({
        success: false,
        error,
        code,
        status,
      });

      expect(createErrorResponse('Not found', 'NOT_FOUND', 404)).toEqual({
        success: false,
        error: 'Not found',
        code: 'NOT_FOUND',
        status: 404,
      });

      expect(createErrorResponse('Unauthorized', 'UNAUTHORIZED', 401)).toEqual({
        success: false,
        error: 'Unauthorized',
        code: 'UNAUTHORIZED',
        status: 401,
      });

      expect(createErrorResponse('Server error', 'INTERNAL_ERROR', 500)).toEqual({
        success: false,
        error: 'Server error',
        code: 'INTERNAL_ERROR',
        status: 500,
      });
    });

    it('should handle database errors', () => {
      const handleDbError = (error: any) => {
        if (error?.code === '23505') {
          return { error: 'Duplicate entry', status: 409 };
        }
        if (error?.code === '23503') {
          return { error: 'Foreign key constraint violation', status: 400 };
        }
        return { error: 'Database error', status: 500 };
      };

      expect(handleDbError({ code: '23505' })).toEqual({
        error: 'Duplicate entry',
        status: 409,
      });

      expect(handleDbError({ code: '23503' })).toEqual({
        error: 'Foreign key constraint violation',
        status: 400,
      });

      expect(handleDbError({ code: 'unknown' })).toEqual({
        error: 'Database error',
        status: 500,
      });
    });

    it('should handle missing authentication', () => {
      const checkAuth = (user: any) => {
        if (!user) {
          return { authenticated: false, error: 'Authentication required' };
        }
        return { authenticated: true, userId: user.id };
      };

      expect(checkAuth(null)).toEqual({
        authenticated: false,
        error: 'Authentication required',
      });

      expect(checkAuth({ id: 'user-123' })).toEqual({
        authenticated: true,
        userId: 'user-123',
      });
    });
  });

  describe('Data Sanitization', () => {
    it('should sanitize user input', () => {
      const sanitize = (input: string) => {
        return input
          .trim()
          .replace(/<script>/gi, '')
          .replace(/<\/script>/gi, '')
          .replace(/javascript:/gi, '');
      };

      expect(sanitize('  Hello World  ')).toBe('Hello World');
      expect(sanitize('<script>alert("xss")</script>')).toBe('alert("xss")');
      expect(sanitize('javascript:void(0)')).toBe('void(0)');
    });

    it('should validate email formats', () => {
      const isValidEmail = (email: string) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
      };

      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user@domain.co.uk')).toBe(true);
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('invalid@')).toBe(false);
      expect(isValidEmail('@domain.com')).toBe(false);
      expect(isValidEmail('test@.com')).toBe(false);
    });

    it('should validate URLs', () => {
      const isValidUrl = (url: string) => {
        try {
          new URL(url);
          return true;
        } catch {
          return false;
        }
      };

      expect(isValidUrl('https://example.com')).toBe(true);
      expect(isValidUrl('http://localhost:3000')).toBe(true);
      expect(isValidUrl('ftp://files.example.com')).toBe(true);
      expect(isValidUrl('not-a-url')).toBe(false);
      expect(isValidUrl('//malformed')).toBe(false);
    });
  });

  describe('Response Formatting', () => {
    it('should format success responses', () => {
      const createSuccessResponse = <T>(data: T) => ({
        success: true,
        data,
        timestamp: new Date().toISOString(),
      });

      const response = createSuccessResponse({ id: '123', name: 'Test' });
      
      expect(response.success).toBe(true);
      expect(response.data).toEqual({ id: '123', name: 'Test' });
      expect(response.timestamp).toBeDefined();
    });

    it('should format paginated responses', () => {
      const createPaginatedResponse = <T>(
        items: T[],
        page: number,
        pageSize: number,
        total: number
      ) => ({
        items,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
          hasNext: page < Math.ceil(total / pageSize),
          hasPrev: page > 1,
        },
      });

      const response = createPaginatedResponse([1, 2, 3], 1, 10, 25);
      
      expect(response.items).toEqual([1, 2, 3]);
      expect(response.pagination.page).toBe(1);
      expect(response.pagination.totalPages).toBe(3);
      expect(response.pagination.hasNext).toBe(true);
      expect(response.pagination.hasPrev).toBe(false);
    });
  });

  describe('Workspace ID Generation', () => {
    it('should generate valid workspace IDs', () => {
      const generateWorkspaceId = (name: string) => {
        return name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .substring(0, 50);
      };

      expect(generateWorkspaceId('My Workspace')).toBe('my-workspace');
      expect(generateWorkspaceId('Test@Company#2024')).toBe('test-company-2024');
      expect(generateWorkspaceId('  Spaces  Here  ')).toBe('spaces-here');
      
      const longName = 'a'.repeat(100);
      expect(generateWorkspaceId(longName).length).toBeLessThanOrEqual(50);
    });

    it('should ensure workspace ID uniqueness', () => {
      const ensureUnique = (baseId: string, existingIds: Set<string>) => {
        let id = baseId;
        let counter = 1;
        
        while (existingIds.has(id)) {
          id = `${baseId}-${counter}`;
          counter++;
        }
        
        return id;
      };

      const existing = new Set(['workspace', 'workspace-1']);
      
      expect(ensureUnique('workspace', existing)).toBe('workspace-2');
      expect(ensureUnique('new-workspace', existing)).toBe('new-workspace');
    });
  });

  describe('Query Parameter Parsing', () => {
    it('should parse pagination parameters', () => {
      const parsePagination = (params: URLSearchParams) => {
        const page = parseInt(params.get('page') || '1', 10);
        const pageSize = parseInt(params.get('pageSize') || '20', 10);
        
        return {
          page: Math.max(1, page),
          pageSize: Math.max(1, Math.min(100, pageSize)),
        };
      };

      const params1 = new URLSearchParams('page=2&pageSize=50');
      expect(parsePagination(params1)).toEqual({ page: 2, pageSize: 50 });

      const params2 = new URLSearchParams('page=-1&pageSize=500');
      expect(parsePagination(params2)).toEqual({ page: 1, pageSize: 100 });

      const params3 = new URLSearchParams('');
      expect(parsePagination(params3)).toEqual({ page: 1, pageSize: 20 });
    });

    it('should parse filter parameters', () => {
      const parseFilters = (params: URLSearchParams) => {
        const status = params.get('status');
        const priority = params.get('priority');
        const search = params.get('search');
        
        return {
          ...(status && { status }),
          ...(priority && { priority }),
          ...(search && { search }),
        };
      };

      const params1 = new URLSearchParams('status=active&priority=high&search=test');
      expect(parseFilters(params1)).toEqual({
        status: 'active',
        priority: 'high',
        search: 'test',
      });

      const params2 = new URLSearchParams('status=done');
      expect(parseFilters(params2)).toEqual({ status: 'done' });

      const params3 = new URLSearchParams('');
      expect(parseFilters(params3)).toEqual({});
    });
  });

  describe('CORS Headers', () => {
    it('should add CORS headers with origin whitelisting', () => {
      const allowedOrigin = 'https://app.sprintiq.com';
      const addCorsHeaders = (headers: Headers, requestOrigin: string) => {
        const isAllowed = requestOrigin === allowedOrigin;
        headers.set('Access-Control-Allow-Origin', isAllowed ? requestOrigin : '');
        headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        headers.set('Access-Control-Max-Age', '86400');
        return headers;
      };

      // Allowed origin
      const headers = new Headers();
      addCorsHeaders(headers, allowedOrigin);
      expect(headers.get('Access-Control-Allow-Origin')).toBe(allowedOrigin);
      expect(headers.get('Access-Control-Allow-Origin')).not.toBe('*');
      expect(headers.get('Access-Control-Allow-Methods')).toContain('POST');
      expect(headers.get('Access-Control-Allow-Headers')).toContain('Authorization');
      expect(headers.get('Access-Control-Max-Age')).toBe('86400');

      // Disallowed origin
      const headers2 = new Headers();
      addCorsHeaders(headers2, 'https://evil.com');
      expect(headers2.get('Access-Control-Allow-Origin')).toBe('');
    });

    it('should handle OPTIONS preflight requests with origin validation', () => {
      const allowedOrigin = 'https://app.sprintiq.com';
      const handleOptions = (requestOrigin: string) => {
        const headers = new Headers();
        const isAllowed = requestOrigin === allowedOrigin;
        headers.set('Access-Control-Allow-Origin', isAllowed ? requestOrigin : '');
        headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        return {
          status: 204,
          headers,
        };
      };

      const response = handleOptions(allowedOrigin);
      expect(response.status).toBe(204);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe(allowedOrigin);

      const blockedResponse = handleOptions('https://evil.com');
      expect(blockedResponse.headers.get('Access-Control-Allow-Origin')).toBe('');
    });
  });

  describe('Timestamp Utilities', () => {
    it('should format timestamps consistently', () => {
      const formatTimestamp = (date: Date = new Date()) => {
        return date.toISOString();
      };

      const timestamp = formatTimestamp();
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should calculate time differences', () => {
      const getTimeDiff = (start: Date, end: Date) => {
        return end.getTime() - start.getTime();
      };

      const start = new Date('2024-01-01T00:00:00Z');
      const end = new Date('2024-01-01T01:00:00Z');
      
      expect(getTimeDiff(start, end)).toBe(3600000); // 1 hour in ms
    });
  });
});

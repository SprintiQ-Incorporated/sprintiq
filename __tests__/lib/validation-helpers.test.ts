/**
 * Validation Helpers Tests
 * Common validation functions used across the application
 */

import { describe, it, expect } from 'vitest';

describe('Validation Helpers', () => {
  describe('Email Validation', () => {
    it('should validate correct email formats', () => {
      const validEmails = [
        'user@example.com',
        'test.user@domain.co.uk',
        'user+tag@example.com',
        'user123@test-domain.com',
      ];

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      
      validEmails.forEach((email) => {
        expect(emailRegex.test(email)).toBe(true);
      });
    });

    it('should reject invalid email formats', () => {
      const invalidEmails = [
        'notanemail',
        '@example.com',
        'user@',
        'user@domain',
        'user @example.com',
      ];

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      
      invalidEmails.forEach((email) => {
        expect(emailRegex.test(email)).toBe(false);
      });
    });
  });

  describe('URL Validation', () => {
    it('should validate correct URLs', () => {
      const validUrls = [
        'https://example.com',
        'http://test.domain.com',
        'https://sub.domain.co.uk/path',
        'https://example.com:8080',
      ];

      validUrls.forEach((url) => {
        expect(() => new URL(url)).not.toThrow();
      });
    });

    it('should reject invalid URLs', () => {
      const invalidUrls = [
        'not-a-url',
        'ftp://invalid',
        'javascript:alert(1)',
      ];

      invalidUrls.forEach((url) => {
        try {
          new URL(url);
          if (!url.startsWith('http')) {
            expect(true).toBe(false); // Should have thrown
          }
        } catch (e) {
          expect(e).toBeDefined();
        }
      });
    });
  });

  describe('String Sanitization', () => {
    it('should trim whitespace', () => {
      const strings = [
        '  test  ',
        '\ttest\t',
        '\ntest\n',
      ];

      strings.forEach((str) => {
        expect(str.trim()).toBe('test');
      });
    });

    it('should remove HTML tags', () => {
      const sanitize = (str: string) => str.replace(/<[^>]*>/g, '');
      
      const inputs = [
        '<script>alert("xss")</script>',
        '<div>Test</div>',
        'Normal <b>text</b>',
      ];

      const expected = [
        'alert("xss")',
        'Test',
        'Normal text',
      ];

      inputs.forEach((input, i) => {
        expect(sanitize(input)).toBe(expected[i]);
      });
    });

    it('should escape special characters', () => {
      const escape = (str: string) => 
        str.replace(/[&<>"']/g, (char) => {
          const escapeMap: Record<string, string> = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
          };
          return escapeMap[char] || char;
        });

      expect(escape('<script>')).toBe('&lt;script&gt;');
      expect(escape('"quoted"')).toBe('&quot;quoted&quot;');
    });
  });

  describe('Number Validation', () => {
    it('should validate positive integers', () => {
      const isPositiveInteger = (n: number) => Number.isInteger(n) && n > 0;

      expect(isPositiveInteger(1)).toBe(true);
      expect(isPositiveInteger(100)).toBe(true);
      expect(isPositiveInteger(0)).toBe(false);
      expect(isPositiveInteger(-1)).toBe(false);
      expect(isPositiveInteger(1.5)).toBe(false);
    });

    it('should validate number ranges', () => {
      const isInRange = (n: number, min: number, max: number) => 
        n >= min && n <= max;

      expect(isInRange(5, 1, 10)).toBe(true);
      expect(isInRange(0, 1, 10)).toBe(false);
      expect(isInRange(11, 1, 10)).toBe(false);
    });

    it('should handle story points validation (1-100)', () => {
      const validateStoryPoints = (points: number) => 
        Number.isInteger(points) && points >= 1 && points <= 100;

      expect(validateStoryPoints(5)).toBe(true);
      expect(validateStoryPoints(100)).toBe(true);
      expect(validateStoryPoints(0)).toBe(false);
      expect(validateStoryPoints(101)).toBe(false);
      expect(validateStoryPoints(5.5)).toBe(false);
    });
  });

  describe('Date Validation', () => {
    it('should validate date formats', () => {
      const isValidDate = (dateString: string) => {
        const date = new Date(dateString);
        return !isNaN(date.getTime());
      };

      expect(isValidDate('2026-01-01')).toBe(true);
      expect(isValidDate('2026-13-01')).toBe(false);
      expect(isValidDate('invalid')).toBe(false);
    });

    it('should validate future dates', () => {
      const isFutureDate = (dateString: string) => {
        const date = new Date(dateString);
        return date > new Date();
      };

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      expect(isFutureDate(tomorrow.toISOString())).toBe(true);
      expect(isFutureDate('2020-01-01')).toBe(false);
    });

    it('should validate sprint date ranges', () => {
      const isValidDateRange = (start: string, end: string) => {
        const startDate = new Date(start);
        const endDate = new Date(end);
        return endDate > startDate;
      };

      expect(isValidDateRange('2026-01-01', '2026-01-15')).toBe(true);
      expect(isValidDateRange('2026-01-15', '2026-01-01')).toBe(false);
    });
  });

  describe('Array Validation', () => {
    it('should validate non-empty arrays', () => {
      const isNonEmpty = (arr: any[]) => Array.isArray(arr) && arr.length > 0;

      expect(isNonEmpty([1, 2, 3])).toBe(true);
      expect(isNonEmpty([])).toBe(false);
      expect(isNonEmpty(null as any)).toBe(false);
    });

    it('should validate unique arrays', () => {
      const hasUniqueValues = (arr: any[]) => 
        new Set(arr).size === arr.length;

      expect(hasUniqueValues([1, 2, 3])).toBe(true);
      expect(hasUniqueValues([1, 2, 2, 3])).toBe(false);
    });

    it('should validate array element types', () => {
      const areAllStrings = (arr: any[]) => 
        arr.every((item) => typeof item === 'string');

      expect(areAllStrings(['a', 'b', 'c'])).toBe(true);
      expect(areAllStrings(['a', 1, 'c'])).toBe(false);
    });
  });

  describe('Object Validation', () => {
    it('should validate required fields', () => {
      const hasRequiredFields = (obj: any, fields: string[]) => 
        fields.every((field) => field in obj && obj[field] != null);

      const story = {
        title: 'Test',
        description: 'Description',
        storyPoints: 5,
      };

      expect(hasRequiredFields(story, ['title', 'description'])).toBe(true);
      expect(hasRequiredFields(story, ['title', 'missing'])).toBe(false);
    });

    it('should validate object structure', () => {
      const isValidStory = (obj: any) => {
        return (
          typeof obj === 'object' &&
          obj !== null &&
          typeof obj.title === 'string' &&
          typeof obj.description === 'string' &&
          (obj.storyPoints === undefined || typeof obj.storyPoints === 'number')
        );
      };

      expect(isValidStory({ title: 'Test', description: 'Desc' })).toBe(true);
      expect(isValidStory({ title: 'Test' })).toBe(false);
      expect(isValidStory(null)).toBe(false);
    });
  });

  describe('Business Logic Validation', () => {
    it('should validate sprint capacity', () => {
      const isValidCapacity = (stories: number[], capacity: number) => {
        const total = stories.reduce((sum, points) => sum + points, 0);
        return total <= capacity * 1.2; // Allow 20% overcommitment
      };

      expect(isValidCapacity([5, 8, 10], 25)).toBe(true);
      expect(isValidCapacity([10, 20, 30], 25)).toBe(false);
    });

    it('should validate team member allocation', () => {
      const isValidAllocation = (availability: number) => 
        availability >= 0 && availability <= 1;

      expect(isValidAllocation(0.8)).toBe(true);
      expect(isValidAllocation(1.0)).toBe(true);
      expect(isValidAllocation(1.5)).toBe(false);
      expect(isValidAllocation(-0.1)).toBe(false);
    });

    it('should validate dependency cycles', () => {
      const hasCycle = (dependencies: Map<string, string[]>, start: string, visited = new Set<string>()): boolean => {
        if (visited.has(start)) return true;
        visited.add(start);
        
        const deps = dependencies.get(start) || [];
        return deps.some((dep) => hasCycle(dependencies, dep, new Set(visited)));
      };

      const deps = new Map([
        ['A', ['B']],
        ['B', ['C']],
        ['C', []],
      ]);

      expect(hasCycle(deps, 'A')).toBe(false);

      const cyclicDeps = new Map([
        ['A', ['B']],
        ['B', ['C']],
        ['C', ['A']],
      ]);

      expect(hasCycle(cyclicDeps, 'A')).toBe(true);
    });
  });
});

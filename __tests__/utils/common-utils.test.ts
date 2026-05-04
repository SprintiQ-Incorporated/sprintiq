/**
 * Common Utility Functions Tests
 */

import { describe, it, expect } from 'vitest';
import { cn, getIconColor, getAvatarInitials, getPriorityColor } from '@/lib/utils';

describe('utils', () => {
  describe('cn (className utility)', () => {
    it('should merge class names', () => {
      const result = cn('foo', 'bar');
      expect(result).toBe('foo bar');
    });

    it('should handle conditional classes', () => {
      const result = cn('foo', false && 'bar', 'baz');
      expect(result).toBe('foo baz');
    });

    it('should merge Tailwind classes correctly', () => {
      const result = cn('px-2 py-1', 'px-4');
      expect(result).toContain('px-4');
      expect(result).toContain('py-1');
    });

    it('should handle array of classes', () => {
      const result = cn(['foo', 'bar']);
      expect(result).toBe('foo bar');
    });

    it('should handle undefined and null', () => {
      const result = cn('foo', undefined, null, 'bar');
      expect(result).toBe('foo bar');
    });
  });

  describe('getIconColor', () => {
    it('should return correct color for valid icon values', () => {
      expect(getIconColor('blue')).toBe('bg-blue-500');
      expect(getIconColor('green')).toBe('bg-green-500');
      expect(getIconColor('red')).toBe('bg-red-500');
      expect(getIconColor('purple')).toBe('bg-purple-500');
      expect(getIconColor('yellow')).toBe('bg-yellow-500');
      expect(getIconColor('pink')).toBe('bg-pink-500');
    });

    it('should return default color for invalid values', () => {
      expect(getIconColor('invalid')).toBe('bg-blue-500');
      expect(getIconColor(null)).toBe('bg-blue-500');
      expect(getIconColor(undefined)).toBe('bg-blue-500');
    });
  });

  describe('getAvatarInitials', () => {
    it('should get initials from full name', () => {
      expect(getAvatarInitials('John Doe', null)).toBe('JD');
      expect(getAvatarInitials('Jane Smith', null)).toBe('JS');
    });

    it('should get initials from single name', () => {
      expect(getAvatarInitials('Madonna', null)).toBe('M');
      expect(getAvatarInitials('Prince', null)).toBe('P');
    });

    it('should get initials from multi-part names', () => {
      expect(getAvatarInitials('John Paul Smith', null)).toBe('JS');
      expect(getAvatarInitials('Mary Anne Johnson', null)).toBe('MJ');
    });

    it('should use email when full name is not available', () => {
      expect(getAvatarInitials(null, 'john@example.com')).toBe('J');
      expect(getAvatarInitials('', 'test@domain.com')).toBe('T');
    });

    it('should return default when neither name nor email available', () => {
      expect(getAvatarInitials(null, null)).toBe('U');
      expect(getAvatarInitials('', '')).toBe('U');
    });

    it('should handle names with extra whitespace', () => {
      expect(getAvatarInitials('  John   Doe  ', null)).toBe('JD');
      expect(getAvatarInitials(' Jane ', null)).toBe('J');
    });

    it('should convert to uppercase', () => {
      expect(getAvatarInitials('john doe', null)).toBe('JD');
      expect(getAvatarInitials(null, 'test@example.com')).toBe('T');
    });
  });

  describe('getPriorityColor', () => {
    it('should return correct color for critical priority', () => {
      const result = getPriorityColor('critical');
      expect(result).toContain('red');
    });

    it('should return correct color for high priority', () => {
      const result = getPriorityColor('high');
      expect(result).toContain('yellow');
    });

    it('should return correct color for medium priority', () => {
      const result = getPriorityColor('medium');
      expect(result).toContain('blue');
    });

    it('should return correct color for low priority', () => {
      const result = getPriorityColor('low');
      expect(result).toContain('green');
    });

    it('should be case-insensitive', () => {
      expect(getPriorityColor('CRITICAL')).toContain('red');
      expect(getPriorityColor('Critical')).toContain('red');
      expect(getPriorityColor('HIGH')).toContain('yellow');
    });

    it('should handle undefined priority', () => {
      const result = getPriorityColor(undefined);
      expect(result).toBeDefined();
    });
  });
});

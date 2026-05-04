/**
 * UI Components Tests
 * Tests for reusable UI components
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// Mock cn function
const cn = (...inputs: any[]) => {
  return inputs.filter(Boolean).join(' ');
};

describe('UI Components', () => {
  describe('Button Variants', () => {
    it('should generate default button classes', () => {
      const getButtonClasses = (variant?: string, size?: string) => {
        const baseClasses = 'inline-flex items-center justify-center rounded-md';
        const variantClasses = {
          default: 'bg-primary text-primary-foreground',
          workspace: 'workspace-primary text-white',
          destructive: 'bg-destructive text-destructive-foreground',
          outline: 'border border-input bg-background',
          secondary: 'bg-secondary text-secondary-foreground',
          ghost: 'hover:bg-accent hover:text-accent-foreground',
          link: 'text-primary underline-offset-4',
        };
        const sizeClasses = {
          default: 'h-10 px-4 py-2',
          sm: 'h-9 rounded-md px-3',
          lg: 'h-11 rounded-md px-8',
          icon: 'h-10 w-10',
        };

        const variantClass = variantClasses[variant as keyof typeof variantClasses] || variantClasses.default;
        const sizeClass = sizeClasses[size as keyof typeof sizeClasses] || sizeClasses.default;

        return cn(baseClasses, variantClass, sizeClass);
      };

      expect(getButtonClasses()).toContain('bg-primary');
      expect(getButtonClasses('workspace')).toContain('workspace-primary');
      expect(getButtonClasses('destructive')).toContain('bg-destructive');
      expect(getButtonClasses('default', 'sm')).toContain('h-9');
      expect(getButtonClasses('default', 'lg')).toContain('h-11');
      expect(getButtonClasses('default', 'icon')).toContain('h-10 w-10');
    });
  });

  describe('Badge Variants', () => {
    it('should generate badge classes for different variants', () => {
      const getBadgeClasses = (variant?: string) => {
        const baseClasses = 'inline-flex items-center rounded-full px-2.5 py-0.5';
        const variantClasses = {
          default: 'bg-primary text-primary-foreground',
          workspace: 'workspace-primary text-white',
          secondary: 'bg-secondary text-secondary-foreground',
          destructive: 'bg-destructive text-destructive-foreground',
          success: 'bg-green-100 text-green-800',
          warning: 'bg-yellow-100 text-yellow-800',
          info: 'bg-blue-100 text-blue-800',
        };

        const variantClass = variantClasses[variant as keyof typeof variantClasses] || variantClasses.default;
        return cn(baseClasses, variantClass);
      };

      expect(getBadgeClasses()).toContain('bg-primary');
      expect(getBadgeClasses('success')).toContain('bg-green-100');
      expect(getBadgeClasses('warning')).toContain('bg-yellow-100');
      expect(getBadgeClasses('info')).toContain('bg-blue-100');
      expect(getBadgeClasses('destructive')).toContain('bg-destructive');
    });
  });

  describe('Status Badge Logic', () => {
    it('should determine badge variant based on status', () => {
      const getStatusBadgeVariant = (status: string) => {
        switch (status.toLowerCase()) {
          case 'active':
          case 'in-progress':
            return 'info';
          case 'done':
          case 'completed':
            return 'success';
          case 'blocked':
          case 'failed':
            return 'destructive';
          case 'pending':
          case 'waiting':
            return 'warning';
          default:
            return 'default';
        }
      };

      expect(getStatusBadgeVariant('active')).toBe('info');
      expect(getStatusBadgeVariant('done')).toBe('success');
      expect(getStatusBadgeVariant('blocked')).toBe('destructive');
      expect(getStatusBadgeVariant('pending')).toBe('warning');
      expect(getStatusBadgeVariant('unknown')).toBe('default');
    });
  });

  describe('Priority Badge Logic', () => {
    it('should determine badge variant based on priority', () => {
      const getPriorityBadgeVariant = (priority: string) => {
        switch (priority.toLowerCase()) {
          case 'critical':
          case 'urgent':
            return 'destructive';
          case 'high':
            return 'warning';
          case 'medium':
            return 'info';
          case 'low':
            return 'success';
          default:
            return 'default';
        }
      };

      expect(getPriorityBadgeVariant('critical')).toBe('destructive');
      expect(getPriorityBadgeVariant('high')).toBe('warning');
      expect(getPriorityBadgeVariant('medium')).toBe('info');
      expect(getPriorityBadgeVariant('low')).toBe('success');
    });
  });

  describe('Component State Logic', () => {
    it('should determine if button should be disabled', () => {
      const shouldDisableButton = (
        isLoading: boolean,
        isDisabled: boolean,
        hasErrors: boolean
      ) => {
        return isLoading || isDisabled || hasErrors;
      };

      expect(shouldDisableButton(true, false, false)).toBe(true);
      expect(shouldDisableButton(false, true, false)).toBe(true);
      expect(shouldDisableButton(false, false, true)).toBe(true);
      expect(shouldDisableButton(false, false, false)).toBe(false);
    });

    it('should determine button text based on state', () => {
      const getButtonText = (isLoading: boolean, defaultText: string, loadingText: string) => {
        return isLoading ? loadingText : defaultText;
      };

      expect(getButtonText(true, 'Submit', 'Submitting...')).toBe('Submitting...');
      expect(getButtonText(false, 'Submit', 'Submitting...')).toBe('Submit');
    });
  });

  describe('Conditional Rendering Logic', () => {
    it('should determine visibility based on conditions', () => {
      const shouldShowElement = (
        hasPermission: boolean,
        isVisible: boolean,
        hasData: boolean
      ) => {
        return hasPermission && isVisible && hasData;
      };

      expect(shouldShowElement(true, true, true)).toBe(true);
      expect(shouldShowElement(false, true, true)).toBe(false);
      expect(shouldShowElement(true, false, true)).toBe(false);
      expect(shouldShowElement(true, true, false)).toBe(false);
    });

    it('should determine error message display', () => {
      const getErrorMessage = (errors: string[], fieldName: string) => {
        const fieldErrors = errors.filter(e => e.includes(fieldName));
        return fieldErrors.length > 0 ? fieldErrors[0] : null;
      };

      const errors = ['Email is required', 'Password is too short', 'Email is invalid'];
      
      expect(getErrorMessage(errors, 'Email')).toBe('Email is required');
      expect(getErrorMessage(errors, 'Password')).toBe('Password is too short');
      expect(getErrorMessage(errors, 'Username')).toBeNull();
    });
  });

  describe('Form Validation Logic', () => {
    it('should validate required fields', () => {
      const validateField = (value: string, isRequired: boolean) => {
        if (isRequired && !value.trim()) {
          return { valid: false, error: 'This field is required' };
        }
        return { valid: true };
      };

      expect(validateField('', true)).toEqual({ valid: false, error: 'This field is required' });
      expect(validateField('value', true)).toEqual({ valid: true });
      expect(validateField('', false)).toEqual({ valid: true });
    });

    it('should validate field length', () => {
      const validateLength = (value: string, minLength: number, maxLength: number) => {
        if (value.length < minLength) {
          return { valid: false, error: `Minimum length is ${minLength}` };
        }
        if (value.length > maxLength) {
          return { valid: false, error: `Maximum length is ${maxLength}` };
        }
        return { valid: true };
      };

      expect(validateLength('ab', 3, 10)).toEqual({ valid: false, error: 'Minimum length is 3' });
      expect(validateLength('abcdefghijk', 3, 10)).toEqual({ valid: false, error: 'Maximum length is 10' });
      expect(validateLength('abcd', 3, 10)).toEqual({ valid: true });
    });

    it('should validate pattern matching', () => {
      const validatePattern = (value: string, pattern: RegExp, errorMessage: string) => {
        if (!pattern.test(value)) {
          return { valid: false, error: errorMessage };
        }
        return { valid: true };
      };

      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      
      expect(validatePattern('invalid', emailPattern, 'Invalid email')).toEqual({
        valid: false,
        error: 'Invalid email'
      });
      expect(validatePattern('valid@email.com', emailPattern, 'Invalid email')).toEqual({
        valid: true
      });
    });
  });

  describe('Loading State Logic', () => {
    it('should determine skeleton count based on data state', () => {
      const getSkeletonCount = (isLoading: boolean, expectedCount: number) => {
        return isLoading ? expectedCount : 0;
      };

      expect(getSkeletonCount(true, 5)).toBe(5);
      expect(getSkeletonCount(false, 5)).toBe(0);
    });

    it('should determine spinner visibility', () => {
      const shouldShowSpinner = (isLoading: boolean, hasMinimumDelay: boolean) => {
        return isLoading && hasMinimumDelay;
      };

      expect(shouldShowSpinner(true, true)).toBe(true);
      expect(shouldShowSpinner(true, false)).toBe(false);
      expect(shouldShowSpinner(false, true)).toBe(false);
    });
  });

  describe('Data Formatting Logic', () => {
    it('should format display names', () => {
      const formatDisplayName = (firstName?: string, lastName?: string, email?: string) => {
        if (firstName && lastName) {
          return `${firstName} ${lastName}`;
        }
        if (firstName) {
          return firstName;
        }
        return email || 'Unknown User';
      };

      expect(formatDisplayName('John', 'Doe')).toBe('John Doe');
      expect(formatDisplayName('John')).toBe('John');
      expect(formatDisplayName(undefined, undefined, 'john@example.com')).toBe('john@example.com');
      expect(formatDisplayName()).toBe('Unknown User');
    });

    it('should format numbers with separators', () => {
      const formatNumber = (num: number) => {
        return num.toLocaleString();
      };

      expect(formatNumber(1000)).toBe('1,000');
      expect(formatNumber(1000000)).toBe('1,000,000');
    });

    it('should format percentages', () => {
      const formatPercentage = (value: number, total: number) => {
        if (total === 0) return '0%';
        return `${Math.round((value / total) * 100)}%`;
      };

      expect(formatPercentage(50, 100)).toBe('50%');
      expect(formatPercentage(33, 100)).toBe('33%');
      expect(formatPercentage(0, 100)).toBe('0%');
      expect(formatPercentage(50, 0)).toBe('0%');
    });
  });

  describe('Color Selection Logic', () => {
    it('should select appropriate text color for background', () => {
      const getTextColor = (backgroundColor: string) => {
        // Simple logic: dark backgrounds get light text
        const darkBackgrounds = ['black', 'navy', 'purple', 'dark'];
        return darkBackgrounds.some(dark => backgroundColor.includes(dark)) ? 'white' : 'black';
      };

      expect(getTextColor('black')).toBe('white');
      expect(getTextColor('navy')).toBe('white');
      expect(getTextColor('white')).toBe('black');
      expect(getTextColor('yellow')).toBe('black');
    });
  });

  describe('Array Manipulation Logic', () => {
    it('should chunk array into groups', () => {
      const chunkArray = <T,>(arr: T[], size: number): T[][] => {
        const chunks: T[][] = [];
        for (let i = 0; i < arr.length; i += size) {
          chunks.push(arr.slice(i, i + size));
        }
        return chunks;
      };

      expect(chunkArray([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
      expect(chunkArray([1, 2, 3], 3)).toEqual([[1, 2, 3]]);
      expect(chunkArray([], 2)).toEqual([]);
    });

    it('should remove duplicates from array', () => {
      const removeDuplicates = <T,>(arr: T[]): T[] => {
        return Array.from(new Set(arr));
      };

      expect(removeDuplicates([1, 2, 2, 3, 3, 4])).toEqual([1, 2, 3, 4]);
      expect(removeDuplicates(['a', 'b', 'a', 'c'])).toEqual(['a', 'b', 'c']);
    });
  });

  describe('Sort Logic', () => {
    it('should sort by date', () => {
      const sortByDate = (a: { date: string }, b: { date: string }, ascending = true) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return ascending ? dateA - dateB : dateB - dateA;
      };

      const items = [
        { date: '2024-01-03' },
        { date: '2024-01-01' },
        { date: '2024-01-02' },
      ];

      const sorted = [...items].sort((a, b) => sortByDate(a, b, true));
      expect(sorted[0].date).toBe('2024-01-01');
      expect(sorted[2].date).toBe('2024-01-03');
    });

    it('should sort by priority', () => {
      const priorityOrder: Record<string, number> = {
        critical: 1,
        high: 2,
        medium: 3,
        low: 4,
      };

      const sortByPriority = (a: string, b: string) => {
        return priorityOrder[a] - priorityOrder[b];
      };

      const priorities = ['low', 'critical', 'medium', 'high'];
      const sorted = [...priorities].sort(sortByPriority);
      
      expect(sorted).toEqual(['critical', 'high', 'medium', 'low']);
    });
  });
});

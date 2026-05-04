/**
 * Core Utils Tests
 * Comprehensive tests for lib/utils.ts utility functions
 */

import { describe, it, expect } from 'vitest';
import {
  cn,
  getIconColor,
  getStatusColor,
  getAvatarInitials,
  getColorByIndex,
  getColorByLabel,
  getPriorityColor,
  getUtilizationColor,
  getRiskColor,
  getStatusTypeColor,
  getStatusTypeBgColor,
  getStatusTypeTextColor,
  getStatusTypeText,
  getStatusTypeChartColor,
} from '@/lib/utils';

describe('lib/utils', () => {
  describe('cn (className merge)', () => {
    it('should merge class names', () => {
      const result = cn('text-sm', 'font-bold');
      expect(result).toContain('text-sm');
      expect(result).toContain('font-bold');
    });

    it('should handle conditional classes', () => {
      const result = cn('base-class', false && 'hidden', 'visible');
      expect(result).toContain('base-class');
      expect(result).toContain('visible');
      expect(result).not.toContain('hidden');
    });

    it('should handle arrays', () => {
      const result = cn(['class1', 'class2']);
      expect(result).toContain('class1');
      expect(result).toContain('class2');
    });

    it('should handle objects', () => {
      const result = cn({ 'text-red': true, 'text-blue': false });
      expect(result).toContain('text-red');
      expect(result).not.toContain('text-blue');
    });

    it('should resolve Tailwind conflicts', () => {
      const result = cn('p-4', 'p-2');
      // Tailwind merge should keep only the last padding
      expect(result).toBe('p-2');
    });
  });

  describe('getIconColor', () => {
    it('should return correct color for known icons', () => {
      expect(getIconColor('blue')).toBe('bg-blue-500');
      expect(getIconColor('green')).toBe('bg-green-500');
      expect(getIconColor('red')).toBe('bg-red-500');
      expect(getIconColor('purple')).toBe('bg-purple-500');
      expect(getIconColor('yellow')).toBe('bg-yellow-500');
      expect(getIconColor('pink')).toBe('bg-pink-500');
    });

    it('should return default color for unknown icon', () => {
      expect(getIconColor('unknown')).toBe('bg-blue-500');
    });

    it('should handle null and undefined', () => {
      expect(getIconColor(null)).toBe('bg-blue-500');
      expect(getIconColor(undefined)).toBe('bg-blue-500');
    });
  });

  describe('getAvatarInitials', () => {
    it('should extract initials from full name', () => {
      expect(getAvatarInitials('John Doe')).toBe('JD');
      expect(getAvatarInitials('Jane Smith')).toBe('JS');
    });

    it('should handle single name', () => {
      expect(getAvatarInitials('John')).toBe('J');
    });

    it('should handle three or more names', () => {
      expect(getAvatarInitials('John William Doe')).toBe('JD');
    });

    it('should handle names with extra whitespace', () => {
      expect(getAvatarInitials('  John   Doe  ')).toBe('JD');
    });

    it('should use email if no name provided', () => {
      expect(getAvatarInitials(null, 'john@example.com')).toBe('J');
    });

    it('should return U for no name or email', () => {
      expect(getAvatarInitials(null, null)).toBe('U');
      expect(getAvatarInitials(undefined, undefined)).toBe('U');
    });

    it('should uppercase initials', () => {
      expect(getAvatarInitials('john doe')).toBe('JD');
    });
  });

  describe('getPriorityColor', () => {
    it('should return correct color for critical priority', () => {
      expect(getPriorityColor('critical')).toBe('bg-red-600/10 text-red-600');
      expect(getPriorityColor('Critical')).toBe('bg-red-600/10 text-red-600');
      expect(getPriorityColor('CRITICAL')).toBe('bg-red-600/10 text-red-600');
    });

    it('should return correct color for high priority', () => {
      expect(getPriorityColor('high')).toBe('bg-yellow-600/10 text-yellow-600');
      expect(getPriorityColor('High')).toBe('bg-yellow-600/10 text-yellow-600');
    });

    it('should return correct color for medium priority', () => {
      expect(getPriorityColor('medium')).toBe('bg-blue-600/10 text-blue-600');
      expect(getPriorityColor('Medium')).toBe('bg-blue-600/10 text-blue-600');
    });

    it('should return correct color for low priority', () => {
      expect(getPriorityColor('low')).toBe('bg-green-600/10 text-green-600');
      expect(getPriorityColor('Low')).toBe('bg-green-600/10 text-green-600');
    });

    it('should return default color for unknown priority', () => {
      expect(getPriorityColor('unknown')).toBe('bg-gray-600/10 text-gray-600');
      expect(getPriorityColor(undefined)).toBe('bg-gray-600/10 text-gray-600');
    });
  });

  describe('getUtilizationColor', () => {
    it('should return red for over 100% utilization', () => {
      expect(getUtilizationColor(101)).toBe('text-red-600');
      expect(getUtilizationColor(150)).toBe('text-red-600');
    });

    it('should return orange for 91-100% utilization', () => {
      expect(getUtilizationColor(91)).toBe('text-orange-600');
      expect(getUtilizationColor(100)).toBe('text-orange-600');
    });

    it('should return green for 71-90% utilization', () => {
      expect(getUtilizationColor(71)).toBe('text-green-600');
      expect(getUtilizationColor(90)).toBe('text-green-600');
    });

    it('should return blue for under 70% utilization', () => {
      expect(getUtilizationColor(70)).toBe('text-blue-600');
      expect(getUtilizationColor(50)).toBe('text-blue-600');
      expect(getUtilizationColor(0)).toBe('text-blue-600');
    });
  });

  describe('getRiskColor', () => {
    it('should return red for high risk', () => {
      expect(getRiskColor('High')).toBe('text-red-600 bg-red-50');
    });

    it('should return yellow for medium risk', () => {
      expect(getRiskColor('Medium')).toBe('text-yellow-600 bg-yellow-50');
    });

    it('should return green for low risk', () => {
      expect(getRiskColor('Low')).toBe('text-green-600 bg-green-50');
    });

    it('should return gray for unknown risk', () => {
      expect(getRiskColor('Unknown')).toBe('text-gray-600 bg-gray-50');
      expect(getRiskColor('')).toBe('text-gray-600 bg-gray-50');
    });
  });

  describe('getStatusTypeColor', () => {
    it('should return correct hex color for not-started', () => {
      expect(getStatusTypeColor('not-started')).toBe('#6B7280');
      expect(getStatusTypeColor('Not Started')).toBe('#6B7280');
    });

    it('should return correct hex color for active', () => {
      expect(getStatusTypeColor('active')).toBe('#3B82F6');
      expect(getStatusTypeColor('Active')).toBe('#3B82F6');
    });

    it('should return correct hex color for done', () => {
      expect(getStatusTypeColor('done')).toBe('#10B981');
      expect(getStatusTypeColor('Done')).toBe('#10B981');
    });

    it('should return correct hex color for closed', () => {
      expect(getStatusTypeColor('closed')).toBe('#8B5CF6');
      expect(getStatusTypeColor('Closed')).toBe('#8B5CF6');
    });

    it('should return default gray for unknown status', () => {
      expect(getStatusTypeColor('unknown')).toBe('#6B7280');
    });
  });

  describe('getStatusTypeBgColor', () => {
    it('should return correct background classes', () => {
      expect(getStatusTypeBgColor('not-started')).toBe('bg-gray-500/10');
      expect(getStatusTypeBgColor('active')).toBe('bg-blue-500/10');
      expect(getStatusTypeBgColor('done')).toBe('bg-green-500/10');
      expect(getStatusTypeBgColor('closed')).toBe('bg-purple-500/10');
      expect(getStatusTypeBgColor('unknown')).toBe('bg-gray-500/10');
    });
  });

  describe('getStatusTypeTextColor', () => {
    it('should return correct text color classes', () => {
      expect(getStatusTypeTextColor('not-started')).toBe('text-gray-500');
      expect(getStatusTypeTextColor('active')).toBe('text-blue-500');
      expect(getStatusTypeTextColor('done')).toBe('text-green-500');
      expect(getStatusTypeTextColor('closed')).toBe('text-purple-500');
      expect(getStatusTypeTextColor('unknown')).toBe('text-gray-500');
    });
  });

  describe('getStatusTypeText', () => {
    it('should return human-readable status text', () => {
      expect(getStatusTypeText('not-started')).toBe('Not Started');
      expect(getStatusTypeText('active')).toBe('Active');
      expect(getStatusTypeText('done')).toBe('Done');
      expect(getStatusTypeText('closed')).toBe('Closed');
      expect(getStatusTypeText('unknown')).toBe('Not Started');
    });
  });

  describe('getStatusTypeChartColor', () => {
    it('should return correct HSL colors for charts', () => {
      expect(getStatusTypeChartColor('Not Started')).toBe('hsl(220, 9%, 46%)');
      expect(getStatusTypeChartColor('Active')).toBe('hsl(217, 91%, 60%)');
      expect(getStatusTypeChartColor('Done')).toBe('hsl(141, 71%, 48%)');
      expect(getStatusTypeChartColor('Closed')).toBe('hsl(276, 80%, 80%)');
      expect(getStatusTypeChartColor('Unknown')).toBe('hsl(220, 9%, 46%)');
    });
  });

});

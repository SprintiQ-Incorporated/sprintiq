/**
 * Status Types Constants Tests
 * Tests for lib/constants/statusTypes.ts
 */

import { describe, it, expect } from 'vitest';
import {
  STATUS_TYPE_CATEGORIES,
  isCompletedStatusType,
  isNotStartedStatusType,
  isInProgressStatusType,
  isBlockedStatusType,
  getStatusTypeCategory,
} from '@/lib/constants/statusTypes';

describe('lib/constants/statusTypes', () => {
  describe('STATUS_TYPE_CATEGORIES', () => {
    it('should have NOT_STARTED category with expected values', () => {
      expect(STATUS_TYPE_CATEGORIES.NOT_STARTED).toContain('not-started');
      expect(STATUS_TYPE_CATEGORIES.NOT_STARTED).toContain('open');
      expect(STATUS_TYPE_CATEGORIES.NOT_STARTED).toContain('backlog');
      expect(STATUS_TYPE_CATEGORIES.NOT_STARTED).toContain('todo');
      expect(STATUS_TYPE_CATEGORIES.NOT_STARTED).toContain('new');
    });

    it('should have IN_PROGRESS category with expected values', () => {
      expect(STATUS_TYPE_CATEGORIES.IN_PROGRESS).toContain('active');
      expect(STATUS_TYPE_CATEGORIES.IN_PROGRESS).toContain('testing');
      expect(STATUS_TYPE_CATEGORIES.IN_PROGRESS).toContain('in-progress');
      expect(STATUS_TYPE_CATEGORIES.IN_PROGRESS).toContain('in_progress');
      expect(STATUS_TYPE_CATEGORIES.IN_PROGRESS).toContain('review');
      expect(STATUS_TYPE_CATEGORIES.IN_PROGRESS).toContain('doing');
    });

    it('should have COMPLETED category with both done and closed', () => {
      expect(STATUS_TYPE_CATEGORIES.COMPLETED).toContain('done');
      expect(STATUS_TYPE_CATEGORIES.COMPLETED).toContain('closed');
      expect(STATUS_TYPE_CATEGORIES.COMPLETED).toContain('complete');
      expect(STATUS_TYPE_CATEGORIES.COMPLETED).toContain('completed');
      expect(STATUS_TYPE_CATEGORIES.COMPLETED).toContain('deployed');
    });

    it('should have BLOCKED category with expected values', () => {
      expect(STATUS_TYPE_CATEGORIES.BLOCKED).toContain('blocked');
      expect(STATUS_TYPE_CATEGORIES.BLOCKED).toContain('on-hold');
      expect(STATUS_TYPE_CATEGORIES.BLOCKED).toContain('impediment');
    });
  });

  describe('isCompletedStatusType', () => {
    it('should return true for done status', () => {
      expect(isCompletedStatusType('done')).toBe(true);
      expect(isCompletedStatusType('Done')).toBe(true);
      expect(isCompletedStatusType('DONE')).toBe(true);
    });

    it('should return true for closed status', () => {
      expect(isCompletedStatusType('closed')).toBe(true);
      expect(isCompletedStatusType('Closed')).toBe(true);
      expect(isCompletedStatusType('CLOSED')).toBe(true);
    });

    it('should return true for other completed statuses', () => {
      expect(isCompletedStatusType('complete')).toBe(true);
      expect(isCompletedStatusType('completed')).toBe(true);
      expect(isCompletedStatusType('deployed')).toBe(true);
    });

    it('should return false for non-completed statuses', () => {
      expect(isCompletedStatusType('active')).toBe(false);
      expect(isCompletedStatusType('not-started')).toBe(false);
      expect(isCompletedStatusType('blocked')).toBe(false);
    });

    it('should return false for null or undefined', () => {
      expect(isCompletedStatusType(null)).toBe(false);
      expect(isCompletedStatusType(undefined)).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isCompletedStatusType('')).toBe(false);
    });
  });

  describe('isNotStartedStatusType', () => {
    it('should return true for not-started statuses', () => {
      expect(isNotStartedStatusType('not-started')).toBe(true);
      expect(isNotStartedStatusType('open')).toBe(true);
      expect(isNotStartedStatusType('backlog')).toBe(true);
      expect(isNotStartedStatusType('todo')).toBe(true);
      expect(isNotStartedStatusType('new')).toBe(true);
    });

    it('should handle case insensitivity', () => {
      expect(isNotStartedStatusType('NOT-STARTED')).toBe(true);
      expect(isNotStartedStatusType('Open')).toBe(true);
      expect(isNotStartedStatusType('BACKLOG')).toBe(true);
    });

    it('should return false for other statuses', () => {
      expect(isNotStartedStatusType('done')).toBe(false);
      expect(isNotStartedStatusType('active')).toBe(false);
    });

    it('should return false for null or undefined', () => {
      expect(isNotStartedStatusType(null)).toBe(false);
      expect(isNotStartedStatusType(undefined)).toBe(false);
    });
  });

  describe('isInProgressStatusType', () => {
    it('should return true for in-progress statuses', () => {
      expect(isInProgressStatusType('active')).toBe(true);
      expect(isInProgressStatusType('testing')).toBe(true);
      expect(isInProgressStatusType('in-progress')).toBe(true);
      expect(isInProgressStatusType('in_progress')).toBe(true);
      expect(isInProgressStatusType('review')).toBe(true);
      expect(isInProgressStatusType('doing')).toBe(true);
    });

    it('should handle case insensitivity', () => {
      expect(isInProgressStatusType('ACTIVE')).toBe(true);
      expect(isInProgressStatusType('Testing')).toBe(true);
      expect(isInProgressStatusType('IN-PROGRESS')).toBe(true);
    });

    it('should return false for other statuses', () => {
      expect(isInProgressStatusType('done')).toBe(false);
      expect(isInProgressStatusType('not-started')).toBe(false);
    });

    it('should return false for null or undefined', () => {
      expect(isInProgressStatusType(null)).toBe(false);
      expect(isInProgressStatusType(undefined)).toBe(false);
    });
  });

  describe('isBlockedStatusType', () => {
    it('should return true for blocked statuses', () => {
      expect(isBlockedStatusType('blocked')).toBe(true);
      expect(isBlockedStatusType('on-hold')).toBe(true);
      expect(isBlockedStatusType('impediment')).toBe(true);
    });

    it('should handle case insensitivity', () => {
      expect(isBlockedStatusType('BLOCKED')).toBe(true);
      expect(isBlockedStatusType('On-Hold')).toBe(true);
      expect(isBlockedStatusType('IMPEDIMENT')).toBe(true);
    });

    it('should return false for other statuses', () => {
      expect(isBlockedStatusType('done')).toBe(false);
      expect(isBlockedStatusType('active')).toBe(false);
    });

    it('should return false for null or undefined', () => {
      expect(isBlockedStatusType(null)).toBe(false);
      expect(isBlockedStatusType(undefined)).toBe(false);
    });
  });

  describe('getStatusTypeCategory', () => {
    it('should return NOT_STARTED for not-started statuses', () => {
      expect(getStatusTypeCategory('not-started')).toBe('NOT_STARTED');
      expect(getStatusTypeCategory('open')).toBe('NOT_STARTED');
      expect(getStatusTypeCategory('backlog')).toBe('NOT_STARTED');
      expect(getStatusTypeCategory('todo')).toBe('NOT_STARTED');
    });

    it('should return IN_PROGRESS for in-progress statuses', () => {
      expect(getStatusTypeCategory('active')).toBe('IN_PROGRESS');
      expect(getStatusTypeCategory('testing')).toBe('IN_PROGRESS');
      expect(getStatusTypeCategory('in-progress')).toBe('IN_PROGRESS');
      expect(getStatusTypeCategory('review')).toBe('IN_PROGRESS');
    });

    it('should return COMPLETED for done and closed statuses', () => {
      expect(getStatusTypeCategory('done')).toBe('COMPLETED');
      expect(getStatusTypeCategory('closed')).toBe('COMPLETED');
      expect(getStatusTypeCategory('complete')).toBe('COMPLETED');
      expect(getStatusTypeCategory('deployed')).toBe('COMPLETED');
    });

    it('should return BLOCKED for blocked statuses', () => {
      expect(getStatusTypeCategory('blocked')).toBe('BLOCKED');
      expect(getStatusTypeCategory('on-hold')).toBe('BLOCKED');
      expect(getStatusTypeCategory('impediment')).toBe('BLOCKED');
    });

    it('should handle case insensitivity', () => {
      expect(getStatusTypeCategory('DONE')).toBe('COMPLETED');
      expect(getStatusTypeCategory('Active')).toBe('IN_PROGRESS');
      expect(getStatusTypeCategory('BLOCKED')).toBe('BLOCKED');
    });

    it('should return null for unknown statuses', () => {
      expect(getStatusTypeCategory('unknown')).toBe(null);
      expect(getStatusTypeCategory('random-status')).toBe(null);
    });

    it('should return null for null or undefined', () => {
      expect(getStatusTypeCategory(null)).toBe(null);
      expect(getStatusTypeCategory(undefined)).toBe(null);
    });

    it('should return null for empty string', () => {
      expect(getStatusTypeCategory('')).toBe(null);
    });
  });
});

/**
 * Hook Tests - use-toast
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { reducer } from '@/hooks/use-toast';

describe('use-toast reducer', () => {
  const initialState = {
    toasts: [],
  };

  const mockToast = {
    id: '1',
    title: 'Test Toast',
    description: 'Test Description',
    variant: 'default' as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ADD_TOAST action', () => {
    it('should add a toast to empty state', () => {
      const action = {
        type: 'ADD_TOAST' as const,
        toast: mockToast,
      };

      const newState = reducer(initialState, action);

      expect(newState.toasts).toHaveLength(1);
      expect(newState.toasts[0]).toEqual(mockToast);
    });

    it('should add a toast and respect TOAST_LIMIT of 1', () => {
      const existingToast = {
        id: '2',
        title: 'Existing Toast',
        variant: 'default' as const,
      };

      const stateWithToast = {
        toasts: [existingToast],
      };

      const action = {
        type: 'ADD_TOAST' as const,
        toast: mockToast,
      };

      const newState = reducer(stateWithToast, action);

      // TOAST_LIMIT is 1, so only the newest toast is kept
      expect(newState.toasts).toHaveLength(1);
      expect(newState.toasts[0]).toEqual(mockToast);
    });

    it('should limit toasts to TOAST_LIMIT', () => {
      const existingToast = {
        id: '2',
        title: 'Existing Toast',
        variant: 'default' as const,
      };

      const stateWithToast = {
        toasts: [existingToast],
      };

      const action = {
        type: 'ADD_TOAST' as const,
        toast: mockToast,
      };

      const newState = reducer(stateWithToast, action);

      // TOAST_LIMIT is 1, so should only keep the newest toast
      expect(newState.toasts).toHaveLength(1);
      expect(newState.toasts[0]).toEqual(mockToast);
    });
  });

  describe('UPDATE_TOAST action', () => {
    it('should update existing toast', () => {
      const stateWithToast = {
        toasts: [mockToast],
      };

      const action = {
        type: 'UPDATE_TOAST' as const,
        toast: {
          id: '1',
          title: 'Updated Title',
        },
      };

      const newState = reducer(stateWithToast, action);

      expect(newState.toasts[0].title).toBe('Updated Title');
      expect(newState.toasts[0].description).toBe('Test Description');
      expect(newState.toasts[0].id).toBe('1');
    });

    it('should not update non-matching toasts', () => {
      const stateWithToast = {
        toasts: [mockToast],
      };

      const action = {
        type: 'UPDATE_TOAST' as const,
        toast: {
          id: '999',
          title: 'Updated Title',
        },
      };

      const newState = reducer(stateWithToast, action);

      expect(newState.toasts[0]).toEqual(mockToast);
    });
  });

  describe('DISMISS_TOAST action', () => {
    it('should handle dismiss with specific toastId', () => {
      const stateWithToast = {
        toasts: [mockToast],
      };

      const action = {
        type: 'DISMISS_TOAST' as const,
        toastId: '1',
      };

      // The reducer doesn't immediately remove, just schedules removal
      const newState = reducer(stateWithToast, action);

      // State should remain the same initially
      expect(newState.toasts).toHaveLength(1);
    });

    it('should handle dismiss without toastId', () => {
      const toast1 = { ...mockToast, id: '1' };
      const toast2 = { ...mockToast, id: '2' };

      const stateWithToasts = {
        toasts: [toast1, toast2],
      };

      const action = {
        type: 'DISMISS_TOAST' as const,
      };

      const newState = reducer(stateWithToasts, action);

      // Both toasts should still be present initially
      expect(newState.toasts).toHaveLength(2);
    });
  });

  describe('REMOVE_TOAST action', () => {
    it('should remove specific toast', () => {
      const stateWithToast = {
        toasts: [mockToast],
      };

      const action = {
        type: 'REMOVE_TOAST' as const,
        toastId: '1',
      };

      const newState = reducer(stateWithToast, action);

      expect(newState.toasts).toHaveLength(0);
    });

    it('should remove all toasts when no toastId provided', () => {
      const toast1 = { ...mockToast, id: '1' };
      const toast2 = { ...mockToast, id: '2' };

      const stateWithToasts = {
        toasts: [toast1, toast2],
      };

      const action = {
        type: 'REMOVE_TOAST' as const,
      };

      const newState = reducer(stateWithToasts, action);

      expect(newState.toasts).toHaveLength(0);
    });

    it('should not affect other toasts', () => {
      const toast1 = { ...mockToast, id: '1' };
      const toast2 = { ...mockToast, id: '2', title: 'Toast 2' };

      const stateWithToasts = {
        toasts: [toast1, toast2],
      };

      const action = {
        type: 'REMOVE_TOAST' as const,
        toastId: '1',
      };

      const newState = reducer(stateWithToasts, action);

      expect(newState.toasts).toHaveLength(1);
      expect(newState.toasts[0].id).toBe('2');
      expect(newState.toasts[0].title).toBe('Toast 2');
    });
  });
});

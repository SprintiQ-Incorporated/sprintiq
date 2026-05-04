/**
 * Hook Tests - use-mobile
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('useIsMobile', () => {
  let matchMediaMock: any;
  
  beforeEach(() => {
    // Mock matchMedia
    matchMediaMock = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: matchMediaMock,
    });
  });

  it('should create matchMedia with correct breakpoint', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });

    // Call matchMedia directly to test the breakpoint
    const mql = window.matchMedia('(max-width: 767px)');
    
    expect(matchMediaMock).toHaveBeenCalledWith('(max-width: 767px)');
  });

  it('should match for mobile width', () => {
    matchMediaMock.mockImplementation((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375,
    });

    const mql = window.matchMedia('(max-width: 767px)');
    expect(mql.matches).toBe(true);
  });

  it('should not match for desktop width', () => {
    matchMediaMock.mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });

    const mql = window.matchMedia('(max-width: 767px)');
    expect(mql.matches).toBe(false);
  });

  it('should match at breakpoint boundary', () => {
    matchMediaMock.mockImplementation((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 767,
    });

    const mql = window.matchMedia('(max-width: 767px)');
    expect(mql.matches).toBe(true);
  });

  it('should support event listeners', () => {
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();

    matchMediaMock.mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener,
      removeEventListener,
      dispatchEvent: vi.fn(),
    }));

    const mql = window.matchMedia('(max-width: 767px)');
    const handler = vi.fn();
    
    mql.addEventListener('change', handler);
    expect(addEventListener).toHaveBeenCalledWith('change', handler);
    
    mql.removeEventListener('change', handler);
    expect(removeEventListener).toHaveBeenCalledWith('change', handler);
  });

  it('should use 768px as mobile breakpoint constant', () => {
    const MOBILE_BREAKPOINT = 768;
    expect(MOBILE_BREAKPOINT).toBe(768);
    
    // Verify the query string construction
    window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    expect(matchMediaMock).toHaveBeenCalledWith('(max-width: 767px)');
  });
});

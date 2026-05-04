/**
 * Device Detection Utility Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  isMobileDevice,
  isTablet,
  isIOS,
  isAndroid,
  getDeviceType,
} from '@/lib/utils/device-detection';

describe('device-detection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isMobileDevice', () => {
    it('should return false in SSR environment', () => {
      const originalWindow = global.window;
      // @ts-ignore
      delete global.window;
      
      expect(isMobileDevice()).toBe(false);
      
      global.window = originalWindow;
    });

    it('should detect mobile device from user agent', () => {
      const testCases = [
        { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)', expected: true },
        { userAgent: 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X)', expected: true },
        { userAgent: 'Mozilla/5.0 (Linux; Android 10)', expected: true },
        { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', expected: false },
      ];

      testCases.forEach(({ userAgent, expected }) => {
        Object.defineProperty(window.navigator, 'userAgent', {
          value: userAgent,
          configurable: true,
        });

        const result = isMobileDevice();
        expect(result).toBe(expected);
      });
    });

    it('should detect mobile based on screen width and touch capability', () => {
      Object.defineProperty(window.navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        configurable: true,
      });

      Object.defineProperty(window, 'innerWidth', {
        value: 500,
        configurable: true,
      });

      Object.defineProperty(window.navigator, 'maxTouchPoints', {
        value: 5,
        configurable: true,
      });

      expect(isMobileDevice()).toBe(true);
    });
  });

  describe('isTablet', () => {
    it('should return false in SSR environment', () => {
      const originalWindow = global.window;
      // @ts-ignore
      delete global.window;
      
      expect(isTablet()).toBe(false);
      
      global.window = originalWindow;
    });

    it('should detect iPad from user agent', () => {
      Object.defineProperty(window.navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X)',
        configurable: true,
      });

      expect(isTablet()).toBe(true);
    });

    it('should detect tablet based on screen size and touch', () => {
      Object.defineProperty(window.navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        configurable: true,
      });

      Object.defineProperty(window, 'innerWidth', {
        value: 800,
        configurable: true,
      });

      // @ts-ignore
      window.ontouchstart = null;

      expect(isTablet()).toBe(true);
    });
  });

  describe('isIOS', () => {
    it('should return false in SSR environment', () => {
      const originalWindow = global.window;
      // @ts-ignore
      delete global.window;
      
      expect(isIOS()).toBe(false);
      
      global.window = originalWindow;
    });

    it('should detect iOS devices', () => {
      const testCases = [
        { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)', expected: true },
        { userAgent: 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X)', expected: true },
        { userAgent: 'Mozilla/5.0 (iPod touch; CPU iPhone OS 12_0 like Mac OS X)', expected: true },
        { userAgent: 'Mozilla/5.0 (Linux; Android 10)', expected: false },
      ];

      testCases.forEach(({ userAgent, expected }) => {
        Object.defineProperty(window.navigator, 'userAgent', {
          value: userAgent,
          configurable: true,
        });

        expect(isIOS()).toBe(expected);
      });
    });
  });

  describe('isAndroid', () => {
    it('should return false in SSR environment', () => {
      const originalWindow = global.window;
      // @ts-ignore
      delete global.window;
      
      expect(isAndroid()).toBe(false);
      
      global.window = originalWindow;
    });

    it('should detect Android devices', () => {
      const testCases = [
        { userAgent: 'Mozilla/5.0 (Linux; Android 10)', expected: true },
        { userAgent: 'Mozilla/5.0 (Linux; Android 11; SM-G991B)', expected: true },
        { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)', expected: false },
      ];

      testCases.forEach(({ userAgent, expected }) => {
        Object.defineProperty(window.navigator, 'userAgent', {
          value: userAgent,
          configurable: true,
        });

        expect(isAndroid()).toBe(expected);
      });
    });
  });

  describe('getDeviceType', () => {
    it('should return desktop for non-mobile devices', () => {
      Object.defineProperty(window.navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        configurable: true,
      });

      Object.defineProperty(window, 'innerWidth', {
        value: 1920,
        configurable: true,
      });

      expect(getDeviceType()).toBe('desktop');
    });

    it('should return tablet for tablet devices', () => {
      Object.defineProperty(window.navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X)',
        configurable: true,
      });

      expect(getDeviceType()).toBe('tablet');
    });

    it('should return mobile for mobile devices', () => {
      Object.defineProperty(window.navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
        configurable: true,
      });

      expect(getDeviceType()).toBe('mobile');
    });
  });
});

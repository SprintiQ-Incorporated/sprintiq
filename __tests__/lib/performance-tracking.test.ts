/**
 * Performance Tracking Tests
 * Tests for Web Vitals and custom performance metrics
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  trackWebVitals,
  trackCustomMetric,
  measureApiLatency,
  trackRouteChange,
  performanceMarks,
} from '@/lib/performance-tracking';
import type { WebVitalsMetric } from '@/lib/performance-tracking';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('Performance Tracking', () => {
  let sendBeaconSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Mock navigator.sendBeacon
    sendBeaconSpy = vi.fn(() => true);
    Object.defineProperty(global.navigator, 'sendBeacon', {
      value: sendBeaconSpy,
      writable: true,
      configurable: true,
    });

    // Mock performance API
    global.performance = {
      mark: vi.fn(),
      measure: vi.fn(),
      getEntriesByName: vi.fn(() => [{ duration: 123 }]),
      clearMarks: vi.fn(),
      clearMeasures: vi.fn(),
      now: vi.fn(() => Date.now()),
    } as any;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('trackWebVitals', () => {
    it('should track LCP metric', () => {
      const metric: WebVitalsMetric = {
        name: 'LCP',
        value: 2400,
        rating: 'good',
        delta: 2400,
        id: 'v1-1234',
        navigationType: 'navigate',
      };

      trackWebVitals(metric);

      expect(sendBeaconSpy).toHaveBeenCalledWith(
        '/api/analytics/web-vitals',
        expect.stringContaining('"metric":"LCP"')
      );
      expect(sendBeaconSpy).toHaveBeenCalledWith(
        '/api/analytics/web-vitals',
        expect.stringContaining('"value":2400')
      );
    });

    it('should track CLS metric with proper formatting', () => {
      const metric: WebVitalsMetric = {
        name: 'CLS',
        value: 0.05,
        rating: 'good',
        delta: 0.05,
        id: 'v1-5678',
      };

      trackWebVitals(metric);

      // CLS values should be multiplied by 1000
      expect(sendBeaconSpy).toHaveBeenCalledWith(
        '/api/analytics/web-vitals',
        expect.stringContaining('"value":50')
      );
    });

    it('should track FID metric', () => {
      const metric: WebVitalsMetric = {
        name: 'FID',
        value: 85,
        rating: 'good',
        delta: 85,
        id: 'v1-9012',
      };

      trackWebVitals(metric);

      expect(sendBeaconSpy).toHaveBeenCalledWith(
        '/api/analytics/web-vitals',
        expect.stringContaining('"metric":"FID"')
      );
    });

    it('should include URL and timestamp', () => {
      const metric: WebVitalsMetric = {
        name: 'TTFB',
        value: 500,
        rating: 'good',
        delta: 500,
        id: 'v1-3456',
      };

      trackWebVitals(metric);

      const callArg = sendBeaconSpy.mock.calls[0][1];
      const payload = JSON.parse(callArg);

      expect(payload).toHaveProperty('url');
      expect(payload).toHaveProperty('timestamp');
      expect(payload).toHaveProperty('userAgent');
    });
  });

  describe('trackCustomMetric', () => {
    it('should track custom metric with metadata', () => {
      trackCustomMetric('api.fetchTasks', 250, {
        workspace_id: 'ws-123',
        count: 50,
      });

      expect(sendBeaconSpy).toHaveBeenCalledWith(
        '/api/analytics/performance',
        expect.stringContaining('"metric":"api.fetchTasks"')
      );
      expect(sendBeaconSpy).toHaveBeenCalledWith(
        '/api/analytics/performance',
        expect.stringContaining('"value":250')
      );
      expect(sendBeaconSpy).toHaveBeenCalledWith(
        '/api/analytics/performance',
        expect.stringContaining('"workspace_id":"ws-123"')
      );
    });

    it('should round metric values', () => {
      trackCustomMetric('test', 123.456);

      const callArg = sendBeaconSpy.mock.calls[0][1];
      const payload = JSON.parse(callArg);

      expect(payload.value).toBe(123);
    });
  });

  describe('measureApiLatency', () => {
    it('should measure successful API call', async () => {
      const mockFn = vi.fn().mockResolvedValue({ data: 'test' });

      const result = await measureApiLatency('fetchUser', mockFn);

      expect(result).toEqual({ data: 'test' });
      expect(sendBeaconSpy).toHaveBeenCalledWith(
        '/api/analytics/performance',
        expect.stringContaining('"metric":"api.fetchUser"')
      );
      expect(sendBeaconSpy).toHaveBeenCalledWith(
        '/api/analytics/performance',
        expect.stringContaining('"status":"success"')
      );
    });

    it('should measure failed API call', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('API Error'));

      await expect(measureApiLatency('fetchUser', mockFn)).rejects.toThrow('API Error');

      expect(sendBeaconSpy).toHaveBeenCalledWith(
        '/api/analytics/performance',
        expect.stringContaining('"status":"error"')
      );
      expect(sendBeaconSpy).toHaveBeenCalledWith(
        '/api/analytics/performance',
        expect.stringContaining('"error":"API Error"')
      );
    });

    it('should track latency duration', async () => {
      vi.mocked(performance.now)
        .mockReturnValueOnce(1000)
        .mockReturnValueOnce(1250);

      const mockFn = vi.fn().mockResolvedValue({ data: 'test' });

      await measureApiLatency('test', mockFn);

      const callArg = sendBeaconSpy.mock.calls[0][1];
      const payload = JSON.parse(callArg);

      expect(payload.value).toBe(250);
    });
  });

  describe('trackRouteChange', () => {
    it('should track route change with duration', () => {
      trackRouteChange('/dashboard', 345);

      expect(sendBeaconSpy).toHaveBeenCalledWith(
        '/api/analytics/performance',
        expect.stringContaining('"metric":"route.change"')
      );
      expect(sendBeaconSpy).toHaveBeenCalledWith(
        '/api/analytics/performance',
        expect.stringContaining('"route":"/dashboard"')
      );
      expect(sendBeaconSpy).toHaveBeenCalledWith(
        '/api/analytics/performance',
        expect.stringContaining('"value":345')
      );
    });
  });

  describe('performanceMarks', () => {
    it('should create performance marks and measure duration', () => {
      performanceMarks.start('dashboard-load');
      performanceMarks.end('dashboard-load');

      expect(performance.mark).toHaveBeenCalledWith('dashboard-load-start');
      expect(performance.mark).toHaveBeenCalledWith('dashboard-load-end');
      expect(performance.measure).toHaveBeenCalledWith(
        'dashboard-load',
        'dashboard-load-start',
        'dashboard-load-end'
      );
    });

    it('should track measured performance', () => {
      vi.mocked(performance.getEntriesByName).mockReturnValue([
        { duration: 456, name: 'test', entryType: 'measure' } as any,
      ]);

      performanceMarks.start('test');
      performanceMarks.end('test');

      expect(sendBeaconSpy).toHaveBeenCalledWith(
        '/api/analytics/performance',
        expect.stringContaining('"metric":"test"')
      );
      expect(sendBeaconSpy).toHaveBeenCalledWith(
        '/api/analytics/performance',
        expect.stringContaining('"value":456')
      );
    });

    it('should clean up marks after measurement', () => {
      performanceMarks.start('cleanup-test');
      performanceMarks.end('cleanup-test');

      expect(performance.clearMarks).toHaveBeenCalledWith('cleanup-test-start');
      expect(performance.clearMarks).toHaveBeenCalledWith('cleanup-test-end');
      expect(performance.clearMeasures).toHaveBeenCalledWith('cleanup-test');
    });
  });
});

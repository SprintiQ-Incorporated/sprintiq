/**
 * ID Lookup Utilities Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isValidUUID } from '@/lib/utils/id-lookup';

describe('id-lookup utilities', () => {
  describe('isValidUUID', () => {
    it('should return true for valid UUIDs', () => {
      const validUUIDs = [
        '550e8400-e29b-41d4-a716-446655440000',
        'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
        '6ba7b811-9dad-11d1-80b4-00c04fd430c8',
      ];

      validUUIDs.forEach((uuid) => {
        expect(isValidUUID(uuid)).toBe(true);
      });
    });

    it('should return false for invalid UUIDs', () => {
      const invalidUUIDs = [
        'not-a-uuid',
        '550e8400-e29b-41d4-a716',
        '550e8400e29b41d4a716446655440000', // missing dashes
        '550e8400-e29b-41d4-a716-446655440000-extra',
        '',
        'w123456789',
        's036717105687',
        'p269998695808',
      ];

      invalidUUIDs.forEach((uuid) => {
        expect(isValidUUID(uuid)).toBe(false);
      });
    });

    it('should be case-insensitive', () => {
      const upperUUID = '550E8400-E29B-41D4-A716-446655440000';
      const lowerUUID = '550e8400-e29b-41d4-a716-446655440000';
      const mixedUUID = '550e8400-E29b-41D4-a716-446655440000';

      expect(isValidUUID(upperUUID)).toBe(true);
      expect(isValidUUID(lowerUUID)).toBe(true);
      expect(isValidUUID(mixedUUID)).toBe(true);
    });

    it('should reject UUIDs with wrong format', () => {
      const wrongFormats = [
        '550e8400-e29b-41d4-a716-44665544000', // too short
        '550e8400-e29b-41d4-a716-4466554400000', // too long
        '550e8400_e29b_41d4_a716_446655440000', // wrong separator
        '550e8400-e29b-41d4-a716-44665544000g', // invalid character
      ];

      wrongFormats.forEach((uuid) => {
        expect(isValidUUID(uuid)).toBe(false);
      });
    });
  });
});

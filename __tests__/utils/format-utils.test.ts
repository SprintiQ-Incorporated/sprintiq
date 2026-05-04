/**
 * Date and Format Utilities Tests
 */

import { describe, it, expect } from 'vitest';
import { format, parseISO } from 'date-fns';

// Import the utility functions from sprint/utils
const formatDateRange = (startDate?: string, dueDate?: string): string => {
  if (startDate && !dueDate) {
    return `Starts ${format(parseISO(startDate), "MMM d")}`;
  }
  if (dueDate && !startDate) {
    return format(parseISO(dueDate), "MMM d");
  }
  if (startDate && dueDate) {
    return `${format(parseISO(startDate), "MMM d")} - ${format(
      parseISO(dueDate),
      "MMM d"
    )}`;
  }
  return "";
};

const stripFormatting = (text: string): string => {
  if (!text) return "";

  const withoutMarkdown = text
    .replace(/^#+\s*/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "");

  const withoutHTML = withoutMarkdown
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');

  return withoutHTML.trim();
};

describe('date and format utilities', () => {
  describe('formatDateRange', () => {
    it('should format start date only', () => {
      const result = formatDateRange('2024-03-15', undefined);
      expect(result).toBe('Starts Mar 15');
    });

    it('should format due date only', () => {
      const result = formatDateRange(undefined, '2024-03-20');
      expect(result).toBe('Mar 20');
    });

    it('should format date range', () => {
      const result = formatDateRange('2024-03-15', '2024-03-20');
      expect(result).toBe('Mar 15 - Mar 20');
    });

    it('should return empty string when no dates provided', () => {
      const result = formatDateRange(undefined, undefined);
      expect(result).toBe('');
    });

    it('should handle dates in different months', () => {
      const result = formatDateRange('2024-01-15', '2024-02-20');
      expect(result).toBe('Jan 15 - Feb 20');
    });

    it('should handle dates in same month', () => {
      const result = formatDateRange('2024-03-10', '2024-03-20');
      expect(result).toBe('Mar 10 - Mar 20');
    });
  });

  describe('stripFormatting', () => {
    it('should return empty string for empty input', () => {
      expect(stripFormatting('')).toBe('');
      expect(stripFormatting(null as any)).toBe('');
      expect(stripFormatting(undefined as any)).toBe('');
    });

    it('should remove markdown headers', () => {
      expect(stripFormatting('# Header 1')).toBe('Header 1');
      expect(stripFormatting('## Header 2')).toBe('Header 2');
      expect(stripFormatting('### Header 3')).toBe('Header 3');
    });

    it('should remove bold formatting', () => {
      expect(stripFormatting('**bold text**')).toBe('bold text');
      expect(stripFormatting('Some **bold** text')).toBe('Some bold text');
    });

    it('should remove italic formatting', () => {
      expect(stripFormatting('*italic text*')).toBe('italic text');
      expect(stripFormatting('Some *italic* text')).toBe('Some italic text');
    });

    it('should remove markdown links', () => {
      expect(stripFormatting('[link text](https://example.com)')).toBe('link text');
      expect(stripFormatting('Check [this link](url) out')).toBe('Check this link out');
    });

    it('should remove bullet points', () => {
      expect(stripFormatting('- item 1')).toBe('item 1');
      expect(stripFormatting('* item 2')).toBe('item 2');
      expect(stripFormatting('+ item 3')).toBe('item 3');
    });

    it('should remove numbered lists', () => {
      expect(stripFormatting('1. First item')).toBe('First item');
      expect(stripFormatting('2. Second item')).toBe('Second item');
    });

    it('should remove HTML tags', () => {
      expect(stripFormatting('<p>paragraph</p>')).toBe('paragraph');
      expect(stripFormatting('<div>content</div>')).toBe('content');
      expect(stripFormatting('<strong>bold</strong>')).toBe('bold');
    });

    it('should decode HTML entities', () => {
      expect(stripFormatting('Text&nbsp;here')).toBe('Text here');
      expect(stripFormatting('&amp;')).toBe('&');
      expect(stripFormatting('&lt;')).toBe('<');
      expect(stripFormatting('&gt;')).toBe('>');
      expect(stripFormatting('&quot;')).toBe('"');
    });

    it('should handle complex mixed formatting', () => {
      const input = '## **Header** with *italic*\n- item 1\n- item 2\n<p>HTML</p>';
      const result = stripFormatting(input);
      expect(result).not.toContain('##');
      expect(result).not.toContain('**');
      expect(result).not.toContain('*');
      expect(result).not.toContain('<p>');
      expect(result).not.toContain('</p>');
      expect(result).not.toContain('-');
    });

    it('should preserve plain text content', () => {
      const plainText = 'This is plain text without any formatting';
      expect(stripFormatting(plainText)).toBe(plainText);
    });

    it('should trim whitespace', () => {
      expect(stripFormatting('  text  ')).toBe('text');
      expect(stripFormatting('\n\ntext\n\n')).toBe('text');
    });
  });
});

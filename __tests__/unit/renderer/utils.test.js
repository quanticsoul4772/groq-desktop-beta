import { 
  cn, 
  formatTimestamp, 
  truncateText, 
  isValidUrl, 
  sanitizeHtml, 
  copyToClipboard,
  generateId,
  validateEmail,
  formatFileSize,
  debounce,
  throttle
} from '../../../src/renderer/lib/utils';

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn(() => Promise.resolve())
  }
});

describe('Renderer Utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('cn (className utility)', () => {
    test('combines class names correctly', () => {
      const result = cn('base-class', 'additional-class');
      expect(result).toContain('base-class');
      expect(result).toContain('additional-class');
    });

    test('handles conditional classes', () => {
      const result = cn('base-class', true && 'conditional-class', false && 'hidden-class');
      expect(result).toContain('base-class');
      expect(result).toContain('conditional-class');
      expect(result).not.toContain('hidden-class');
    });

    test('handles undefined and null values', () => {
      const result = cn('base-class', undefined, null, 'valid-class');
      expect(result).toContain('base-class');
      expect(result).toContain('valid-class');
    });

    test('handles arrays and objects', () => {
      const result = cn('base', ['array-class'], { 'object-class': true, 'false-class': false });
      expect(result).toContain('base');
      expect(result).toContain('array-class');
      expect(result).toContain('object-class');
      expect(result).not.toContain('false-class');
    });
  });

  describe('formatTimestamp', () => {
    test('formats timestamp correctly', () => {
      const timestamp = new Date('2023-12-25T10:30:00Z');
      const result = formatTimestamp(timestamp);
      
      expect(result).toMatch(/\d{1,2}:\d{2}/); // Should contain time format
    });

    test('handles string timestamps', () => {
      const timestamp = '2023-12-25T10:30:00Z';
      const result = formatTimestamp(timestamp);
      
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    test('handles invalid timestamps', () => {
      const result = formatTimestamp('invalid-date');
      
      expect(result).toBe('Invalid Date');
    });

    test('handles null and undefined', () => {
      expect(formatTimestamp(null)).toBe('');
      expect(formatTimestamp(undefined)).toBe('');
    });
  });

  describe('truncateText', () => {
    test('truncates long text', () => {
      const longText = 'This is a very long text that should be truncated';
      const result = truncateText(longText, 20);
      
      expect(result.length).toBeLessThanOrEqual(23); // 20 + '...'
      expect(result).toContain('...');
    });

    test('does not truncate short text', () => {
      const shortText = 'Short text';
      const result = truncateText(shortText, 20);
      
      expect(result).toBe(shortText);
      expect(result).not.toContain('...');
    });

    test('handles empty string', () => {
      const result = truncateText('', 10);
      expect(result).toBe('');
    });

    test('handles null and undefined', () => {
      expect(truncateText(null, 10)).toBe('');
      expect(truncateText(undefined, 10)).toBe('');
    });
  });

  describe('isValidUrl', () => {
    test('validates correct URLs', () => {
      const validUrls = [
        'https://example.com',
        'http://example.com',
        'https://www.example.com/path?query=value',
        'ftp://ftp.example.com'
      ];

      validUrls.forEach(url => {
        expect(isValidUrl(url)).toBe(true);
      });
    });

    test('rejects invalid URLs', () => {
      const invalidUrls = [
        'not-a-url',
        'example.com',
        '',
        null,
        undefined,
        'javascript:alert("xss")'
      ];

      invalidUrls.forEach(url => {
        expect(isValidUrl(url)).toBe(false);
      });
    });
  });

  describe('sanitizeHtml', () => {
    test('removes script tags', () => {
      const htmlWithScript = '<p>Safe content</p><script>alert("xss")</script>';
      const result = sanitizeHtml(htmlWithScript);
      
      expect(result).toContain('Safe content');
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('alert');
    });

    test('removes on* event attributes', () => {
      const htmlWithEvents = '<div onclick="alert(\'xss\')" onmouseover="alert(\'xss\')">Content</div>';
      const result = sanitizeHtml(htmlWithEvents);
      
      expect(result).toContain('Content');
      expect(result).not.toContain('onclick');
      expect(result).not.toContain('onmouseover');
    });

    test('preserves safe HTML', () => {
      const safeHtml = '<p><strong>Bold</strong> and <em>italic</em> text</p>';
      const result = sanitizeHtml(safeHtml);
      
      expect(result).toContain('<strong>');
      expect(result).toContain('<em>');
      expect(result).toContain('Bold');
      expect(result).toContain('italic');
    });

    test('handles empty and null input', () => {
      expect(sanitizeHtml('')).toBe('');
      expect(sanitizeHtml(null)).toBe('');
      expect(sanitizeHtml(undefined)).toBe('');
    });
  });

  describe('copyToClipboard', () => {
    test('copies text to clipboard successfully', async () => {
      const text = 'Test text to copy';
      
      const result = await copyToClipboard(text);
      
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(text);
      expect(result).toBe(true);
    });

    test('handles clipboard API errors', async () => {
      navigator.clipboard.writeText.mockRejectedValueOnce(new Error('Clipboard error'));
      
      const result = await copyToClipboard('test');
      
      expect(result).toBe(false);
    });

    test('handles empty text', async () => {
      const result = await copyToClipboard('');
      
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('');
      expect(result).toBe(true);
    });
  });

  describe('generateId', () => {
    test('generates unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      
      expect(typeof id1).toBe('string');
      expect(typeof id2).toBe('string');
      expect(id1).not.toBe(id2);
      expect(id1.length).toBeGreaterThan(0);
    });

    test('generates IDs with specified prefix', () => {
      const id = generateId('test-');
      
      expect(id).toStartWith('test-');
    });

    test('generates IDs with specified length', () => {
      const id = generateId('', 10);
      
      expect(id.length).toBe(10);
    });
  });

  describe('validateEmail', () => {
    test('validates correct email addresses', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'first+last@company.org',
        'user123@test-domain.com'
      ];

      validEmails.forEach(email => {
        expect(validateEmail(email)).toBe(true);
      });
    });

    test('rejects invalid email addresses', () => {
      const invalidEmails = [
        'not-an-email',
        '@example.com',
        'user@',
        'user.name',
        '',
        null,
        undefined
      ];

      invalidEmails.forEach(email => {
        expect(validateEmail(email)).toBe(false);
      });
    });
  });

  describe('formatFileSize', () => {
    test('formats bytes correctly', () => {
      expect(formatFileSize(0)).toBe('0 Bytes');
      expect(formatFileSize(512)).toBe('512 Bytes');
      expect(formatFileSize(1023)).toBe('1023 Bytes');
    });

    test('formats kilobytes correctly', () => {
      expect(formatFileSize(1024)).toBe('1.0 KB');
      expect(formatFileSize(1536)).toBe('1.5 KB');
    });

    test('formats megabytes correctly', () => {
      expect(formatFileSize(1048576)).toBe('1.0 MB');
      expect(formatFileSize(2097152)).toBe('2.0 MB');
    });

    test('formats gigabytes correctly', () => {
      expect(formatFileSize(1073741824)).toBe('1.0 GB');
    });

    test('handles negative values', () => {
      expect(formatFileSize(-1024)).toBe('-1.0 KB');
    });

    test('handles very large values', () => {
      const result = formatFileSize(1099511627776); // 1 TB
      expect(result).toContain('TB');
    });
  });

  describe('debounce', () => {
    test('debounces function calls', async () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 100);

      debouncedFn('arg1');
      debouncedFn('arg2');
      debouncedFn('arg3');

      expect(mockFn).not.toHaveBeenCalled();

      await new Promise(resolve => setTimeout(resolve, 150));

      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('arg3');
    });

    test('returns a function', () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 100);

      expect(typeof debouncedFn).toBe('function');
    });
  });

  describe('throttle', () => {
    test('throttles function calls', async () => {
      const mockFn = jest.fn();
      const throttledFn = throttle(mockFn, 100);

      throttledFn('arg1');
      throttledFn('arg2');
      throttledFn('arg3');

      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('arg1');

      await new Promise(resolve => setTimeout(resolve, 150));

      throttledFn('arg4');

      expect(mockFn).toHaveBeenCalledTimes(2);
      expect(mockFn).toHaveBeenCalledWith('arg4');
    });

    test('returns a function', () => {
      const mockFn = jest.fn();
      const throttledFn = throttle(mockFn, 100);

      expect(typeof throttledFn).toBe('function');
    });
  });

  describe('error handling', () => {
    test('utils handle edge cases gracefully', () => {
      // Test that utility functions don't crash with unexpected input
      expect(() => {
        cn(123, true, null, undefined, [], {});
        formatTimestamp({});
        truncateText(123, 'invalid');
        isValidUrl({});
        sanitizeHtml(123);
        generateId(null, 'invalid');
        validateEmail(123);
        formatFileSize('invalid');
      }).not.toThrow();
    });
  });
});
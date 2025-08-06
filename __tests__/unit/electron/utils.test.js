const utils = require('../../../electron/utils');
const path = require('path');

describe('Electron Utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getScriptPath', () => {
    test('returns correct path for existing script file', () => {
      const mockExistsSync = jest.spyOn(require('fs'), 'existsSync');
      mockExistsSync.mockReturnValue(true);

      const scriptName = 'run-node';
      const result = utils.getScriptPath(scriptName);

      expect(result).toContain('run-node');
      expect(typeof result).toBe('string');
    });

    test('handles non-existent script files', () => {
      const mockExistsSync = jest.spyOn(require('fs'), 'existsSync');
      mockExistsSync.mockReturnValue(false);

      const scriptName = 'non-existent-script';
      const result = utils.getScriptPath(scriptName);

      // Should still return a path even if file doesn't exist
      expect(typeof result).toBe('string');
      expect(result).toContain('non-existent-script');
    });

    test('handles different platforms', () => {
      const originalPlatform = process.platform;

      // Test Windows
      Object.defineProperty(process, 'platform', { value: 'win32' });
      const windowsPath = utils.getScriptPath('run-node');
      expect(windowsPath).toMatch(/\.(cmd|ps1)$/);

      // Test macOS/Linux
      Object.defineProperty(process, 'platform', { value: 'darwin' });
      const unixPath = utils.getScriptPath('run-node');
      expect(unixPath).toMatch(/\.sh$/);

      // Restore original platform
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });
  });

  describe('sanitizeToolOutput', () => {
    test('truncates long output to specified limit', () => {
      const longOutput = 'a'.repeat(1000);
      const limit = 100;
      
      const result = utils.sanitizeToolOutput(longOutput, limit);
      
      expect(result.length).toBeLessThanOrEqual(limit + 50); // Account for truncation message
      expect(result).toContain('[Output truncated]');
    });

    test('does not truncate short output', () => {
      const shortOutput = 'Short output';
      const limit = 100;
      
      const result = utils.sanitizeToolOutput(shortOutput, limit);
      
      expect(result).toBe(shortOutput);
      expect(result).not.toContain('[Output truncated]');
    });

    test('removes ANSI escape codes', () => {
      const outputWithAnsi = '\x1b[31mRed text\x1b[0m Normal text';
      
      const result = utils.sanitizeToolOutput(outputWithAnsi);
      
      expect(result).toBe('Red text Normal text');
      expect(result).not.toContain('\x1b');
    });

    test('handles null and undefined input', () => {
      expect(utils.sanitizeToolOutput(null)).toBe('');
      expect(utils.sanitizeToolOutput(undefined)).toBe('');
    });

    test('handles non-string input', () => {
      expect(utils.sanitizeToolOutput(123)).toBe('123');
      expect(utils.sanitizeToolOutput({ key: 'value' })).toBe('[object Object]');
      expect(utils.sanitizeToolOutput(true)).toBe('true');
    });

    test('preserves important whitespace', () => {
      const outputWithSpaces = 'Line 1\n  Indented line\nLine 3';
      
      const result = utils.sanitizeToolOutput(outputWithSpaces);
      
      expect(result).toContain('\n');
      expect(result).toContain('  Indented line');
    });
  });

  describe('validateApiKey', () => {
    test('validates correct API key format', () => {
      const validKeys = [
        'gsk_1234567890abcdef1234567890abcdef',
        'gsk_' + 'a'.repeat(32),
        'gsk_valid_api_key_format_here123'
      ];

      validKeys.forEach(key => {
        expect(utils.validateApiKey(key)).toBe(true);
      });
    });

    test('rejects invalid API key formats', () => {
      const invalidKeys = [
        '',
        null,
        undefined,
        'invalid_key',
        'gsk_',
        'gsk_short',
        'not_gsk_prefix_key',
        123
      ];

      invalidKeys.forEach(key => {
        expect(utils.validateApiKey(key)).toBe(false);
      });
    });
  });

  describe('formatError', () => {
    test('formats Error objects', () => {
      const error = new Error('Test error message');
      error.stack = 'Error: Test error message\n    at test.js:1:1';
      
      const result = utils.formatError(error);
      
      expect(result).toContain('Test error message');
      expect(result).toContain('test.js:1:1');
    });

    test('formats error strings', () => {
      const errorString = 'Simple error message';
      
      const result = utils.formatError(errorString);
      
      expect(result).toBe(errorString);
    });

    test('handles objects with error information', () => {
      const errorObj = {
        message: 'API Error',
        code: 500,
        details: 'Internal server error'
      };
      
      const result = utils.formatError(errorObj);
      
      expect(result).toContain('API Error');
      expect(result).toContain('500');
    });

    test('handles unknown error types', () => {
      const unknownError = 12345;
      
      const result = utils.formatError(unknownError);
      
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('parseCommandArgs', () => {
    test('parses simple command arguments', () => {
      const command = 'node script.js arg1 arg2';
      
      const result = utils.parseCommandArgs(command);
      
      expect(result).toEqual(['node', 'script.js', 'arg1', 'arg2']);
    });

    test('handles quoted arguments', () => {
      const command = 'node "script with spaces.js" --option "value with spaces"';
      
      const result = utils.parseCommandArgs(command);
      
      expect(result).toContain('script with spaces.js');
      expect(result).toContain('value with spaces');
    });

    test('handles empty command', () => {
      const result = utils.parseCommandArgs('');
      
      expect(result).toEqual([]);
    });

    test('handles command with multiple spaces', () => {
      const command = 'node    script.js     arg1     arg2';
      
      const result = utils.parseCommandArgs(command);
      
      expect(result).toEqual(['node', 'script.js', 'arg1', 'arg2']);
    });
  });

  describe('isPortInUse', () => {
    test('detects port in use', async () => {
      // Mock net.createConnection to simulate port in use
      const net = require('net');
      const mockConnect = jest.fn((port, callback) => {
        // Simulate successful connection (port is in use)
        setTimeout(() => callback(), 10);
        return { 
          end: jest.fn(),
          on: jest.fn()
        };
      });
      net.createConnection = mockConnect;

      const result = await utils.isPortInUse(3000);
      
      expect(result).toBe(true);
    });

    test('detects available port', async () => {
      // Mock net.createConnection to simulate connection error (port available)
      const net = require('net');
      const mockConnect = jest.fn((port, callback) => {
        const mockSocket = { 
          end: jest.fn(),
          on: jest.fn((event, handler) => {
            if (event === 'error') {
              // Simulate connection error (port not in use)
              setTimeout(() => handler({ code: 'ECONNREFUSED' }), 10);
            }
          })
        };
        return mockSocket;
      });
      net.createConnection = mockConnect;

      const result = await utils.isPortInUse(3000);
      
      expect(result).toBe(false);
    });
  });

  describe('findAvailablePort', () => {
    test('finds available port starting from given port', async () => {
      // Mock isPortInUse to return false for port 3001
      utils.isPortInUse = jest.fn()
        .mockResolvedValueOnce(true)  // 3000 is in use
        .mockResolvedValueOnce(false); // 3001 is available

      const result = await utils.findAvailablePort(3000);
      
      expect(result).toBe(3001);
    });

    test('returns default port when available', async () => {
      utils.isPortInUse = jest.fn().mockResolvedValue(false);

      const result = await utils.findAvailablePort(3000);
      
      expect(result).toBe(3000);
    });
  });

  describe('debounce', () => {
    test('debounces function calls', async () => {
      const mockFn = jest.fn();
      const debouncedFn = utils.debounce(mockFn, 100);

      // Call multiple times quickly
      debouncedFn('arg1');
      debouncedFn('arg2');
      debouncedFn('arg3');

      // Should not be called immediately
      expect(mockFn).not.toHaveBeenCalled();

      // Wait for debounce delay
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should be called once with the last arguments
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('arg3');
    });

    test('cancels previous calls when called again', async () => {
      const mockFn = jest.fn();
      const debouncedFn = utils.debounce(mockFn, 100);

      debouncedFn('first');
      
      // Wait less than debounce delay
      await new Promise(resolve => setTimeout(resolve, 50));
      
      debouncedFn('second');
      
      // Wait for full debounce delay
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('second');
    });
  });

  describe('throttle', () => {
    test('throttles function calls', async () => {
      const mockFn = jest.fn();
      const throttledFn = utils.throttle(mockFn, 100);

      // Call multiple times quickly
      throttledFn('arg1');
      throttledFn('arg2');
      throttledFn('arg3');

      // Should be called immediately once
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('arg1');

      // Wait for throttle period to pass
      await new Promise(resolve => setTimeout(resolve, 150));

      throttledFn('arg4');

      // Should be called again after throttle period
      expect(mockFn).toHaveBeenCalledTimes(2);
      expect(mockFn).toHaveBeenCalledWith('arg4');
    });
  });
});
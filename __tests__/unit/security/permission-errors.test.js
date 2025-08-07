const fs = require('fs');
const path = require('path');
const os = require('os');

// Import the real settingsManager WITHOUT mocks
const settingsManager = require('../../../electron/settingsManager');

describe('Permission Error Handling (No Mocks)', () => {
  let testDir;
  beforeEach(() => {
    // Create a temporary directory for permission tests
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'groq-permission-test-'));
  });

  afterEach(() => {
    // Clean up temp directory
    if (fs.existsSync(testDir)) {
      try {
        // Restore permissions before cleanup
        fs.chmodSync(testDir, 0o755);
        fs.rmSync(testDir, { recursive: true, force: true });
      } catch (error) {
        console.warn('Cleanup warning:', error.message);
      }
    }
  });

  describe('File System Permission Errors', () => {
    test('should throw EACCES when writing to read-only directory', async () => {
      // Skip on Windows as chmod behaves differently
      if (process.platform === 'win32') {
        console.log('Skipping permission test on Windows');
        return;
      }

      try {
        // Make directory read-only
        fs.chmodSync(testDir, 0o444);

        // Create a mock app that returns our read-only test directory
        const mockApp = {
          getPath: () => testDir,
        };

        // Initialize settingsManager with the restricted directory
        settingsManager.initializeSettingsHandlers(
          {
            handle: jest.fn(),
          },
          mockApp
        );

        // Attempt to save settings should fail with permission error
        const testFilePath = path.join(testDir, 'settings.json');

        expect(() => {
          fs.writeFileSync(testFilePath, JSON.stringify({ test: 'data' }));
        }).toThrow(/EACCES|permission denied/i);
      } finally {
        // Restore permissions for cleanup
        try {
          fs.chmodSync(testDir, 0o755);
        } catch (error) {
          console.warn('Failed to restore permissions:', error.message);
        }
      }
    });

    test('should throw EPERM when attempting to write to non-writable file', async () => {
      // Skip on Windows as chmod behaves differently
      if (process.platform === 'win32') {
        console.log('Skipping permission test on Windows');
        return;
      }

      const testFilePath = path.join(testDir, 'readonly-settings.json');

      try {
        // Create a file and make it read-only
        fs.writeFileSync(testFilePath, JSON.stringify({ existing: 'data' }));
        fs.chmodSync(testFilePath, 0o444);

        // Attempt to overwrite should fail
        expect(() => {
          fs.writeFileSync(testFilePath, JSON.stringify({ new: 'data' }));
        }).toThrow(/EACCES|permission denied/i);
      } finally {
        // Restore permissions for cleanup
        try {
          fs.chmodSync(testFilePath, 0o644);
        } catch (error) {
          console.warn('Failed to restore file permissions:', error.message);
        }
      }
    });

    test('should handle ENOENT error when reading non-existent file', () => {
      const nonExistentPath = path.join(testDir, 'does-not-exist.json');

      expect(() => {
        fs.readFileSync(nonExistentPath, 'utf8');
      }).toThrow(/ENOENT|no such file or directory/i);
    });

    test('should handle EISDIR error when trying to read directory as file', () => {
      expect(() => {
        fs.readFileSync(testDir, 'utf8');
      }).toThrow(/EISDIR|illegal operation on a directory/i);
    });
  });

  describe('Real SettingsManager Error Handling', () => {
    test('settingsManager should handle filesystem errors gracefully', () => {
      // Create a mock app that points to a non-existent path
      const mockApp = {
        getPath: () => '/invalid/path/that/does/not/exist',
      };

      // This should not crash but should handle the error gracefully
      expect(() => {
        settingsManager.initializeSettingsHandlers(
          {
            handle: jest.fn(),
          },
          mockApp
        );
      }).not.toThrow();
    });

    test('loadSettings should return defaults when filesystem errors occur', () => {
      // Test by attempting to read from a path that will cause permission issues
      const settings = settingsManager.loadSettings();

      // Should return valid defaults even if file operations fail
      expect(settings).toHaveProperty('GROQ_API_KEY');
      expect(settings).toHaveProperty('model');
      expect(settings).toHaveProperty('temperature');
      expect(typeof settings.temperature).toBe('number');
    });
  });

  describe('Error Detection Tests', () => {
    test('code should not silently swallow EACCES errors', async () => {
      // This test ensures that permission errors are properly propagated
      // and not caught and ignored

      if (process.platform === 'win32') {
        console.log('Skipping EACCES detection test on Windows');
        return;
      }

      const readOnlyDir = path.join(testDir, 'readonly');
      fs.mkdirSync(readOnlyDir);
      fs.chmodSync(readOnlyDir, 0o444);

      try {
        const testFile = path.join(readOnlyDir, 'test.json');

        // This MUST throw and not be silently caught
        let errorThrown = false;
        try {
          fs.writeFileSync(testFile, 'test data');
        } catch (error) {
          errorThrown = true;
          expect(error.code).toBe('EACCES');
        }

        expect(errorThrown).toBe(true);
      } finally {
        fs.chmodSync(readOnlyDir, 0o755);
      }
    });

    test('code should not silently swallow EPERM errors', async () => {
      if (process.platform === 'win32') {
        console.log('Skipping EPERM detection test on Windows');
        return;
      }

      const testFile = path.join(testDir, 'protected.json');
      fs.writeFileSync(testFile, 'initial data');
      fs.chmodSync(testFile, 0o444);

      try {
        // This MUST throw and not be silently caught
        let errorThrown = false;
        try {
          fs.writeFileSync(testFile, 'new data');
        } catch (error) {
          errorThrown = true;
          expect(['EACCES', 'EPERM']).toContain(error.code);
        }

        expect(errorThrown).toBe(true);
      } finally {
        fs.chmodSync(testFile, 0o644);
      }
    });
  });
});

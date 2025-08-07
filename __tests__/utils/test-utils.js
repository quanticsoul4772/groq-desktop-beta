const fs = require('fs');
const path = require('path');
const os = require('os');
const { v4: uuidv4 } =
  require('crypto').randomUUID ||
  (() => Math.random().toString(36).substring(2) + Date.now().toString(36));

/**
 * Shared test utilities for performance optimization
 * Reuses temporary directories instead of creating/destroying them for each test
 */
class TestUtils {
  constructor() {
    this.sharedRootDir = null;
    this.testDirs = new Map();
    this.isInitialized = false;
  }

  /**
   * Initialize shared test directory root
   * Should be called once at the beginning of test suite
   */
  initializeSharedRoot() {
    if (this.isInitialized) {
      return this.sharedRootDir;
    }

    // Create unique shared root: os.tmpdir()/groq-desktop-tests/<uuid>
    const uuid = typeof uuidv4 === 'function' ? uuidv4() : this.generateUuid();
    this.sharedRootDir = path.join(os.tmpdir(), 'groq-desktop-tests', uuid);

    // Create the root directory
    fs.mkdirSync(this.sharedRootDir, { recursive: true });
    this.isInitialized = true;

    console.log(`📁 Initialized shared test root: ${this.sharedRootDir}`);
    return this.sharedRootDir;
  }

  /**
   * Get a unique test subdirectory under the shared root
   * @param {string} testName - Name identifier for the test
   * @returns {string} Path to the test subdirectory
   */
  getTestDir(testName) {
    if (!this.isInitialized) {
      this.initializeSharedRoot();
    }

    // Create a unique subdirectory for this test
    const timestamp = Date.now();
    const testDirName = `${testName}-${timestamp}`;
    const testDir = path.join(this.sharedRootDir, testDirName);

    // Create the test directory
    fs.mkdirSync(testDir, { recursive: true });

    // Track the directory for potential cleanup
    this.testDirs.set(testName, testDir);

    return testDir;
  }

  /**
   * Clean up a specific test directory (optional - for individual test cleanup)
   * @param {string} testName - Name identifier for the test
   */
  cleanupTestDir(testName) {
    const testDir = this.testDirs.get(testName);
    if (testDir && fs.existsSync(testDir)) {
      try {
        fs.rmSync(testDir, { recursive: true, force: true });
        this.testDirs.delete(testName);
      } catch (error) {
        console.warn(`Warning: Could not clean up test dir ${testDir}:`, error.message);
      }
    }
  }

  /**
   * Clean up all test directories and the shared root
   * Should be called once at the end of test suite
   */
  cleanupAll() {
    if (!this.sharedRootDir || !fs.existsSync(this.sharedRootDir)) {
      return;
    }

    try {
      // Clean up the entire shared root directory
      fs.rmSync(this.sharedRootDir, { recursive: true, force: true });
      console.log(`🧹 Cleaned up shared test root: ${this.sharedRootDir}`);

      // Reset state
      this.sharedRootDir = null;
      this.testDirs.clear();
      this.isInitialized = false;
    } catch (error) {
      console.error(`Error cleaning up shared test root ${this.sharedRootDir}:`, error.message);
    }
  }

  /**
   * Generate a simple UUID-like string for environments without crypto.randomUUID
   */
  generateUuid() {
    return (
      'xxxx-xxxx-xxxx'.replace(/[x]/g, () => {
        return ((Math.random() * 16) | 0).toString(16);
      }) +
      '-' +
      Date.now().toString(16)
    );
  }

  /**
   * Get the shared root directory path (for inspection/debugging)
   */
  getSharedRootPath() {
    return this.sharedRootDir;
  }
}

// Export a singleton instance
const testUtils = new TestUtils();

module.exports = {
  testUtils,
  TestUtils,
};

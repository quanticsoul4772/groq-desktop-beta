const fs = require('fs');
const path = require('path');
const os = require('os');

// Import the settingsManager
const { loadSettings, initializeSettingsHandlers } = require('./electron/settingsManager.js');

// Test utilities
let testResults = [];
let testCount = 0;
let passedCount = 0;

function test(name, testFn) {
    testCount++;
    try {
        testFn();
        console.log(`✅ ${name}`);
        testResults.push({ name, status: 'PASSED' });
        passedCount++;
    } catch (error) {
        console.log(`❌ ${name}`);
        console.log(`   Error: ${error.message}`);
        testResults.push({ name, status: 'FAILED', error: error.message });
    }
}

function assertEquals(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(`${message || 'Assertion failed'}: expected ${expected}, got ${actual}`);
    }
}

function assertDeepEquals(actual, expected, message) {
    if (!deepEquals(actual, expected)) {
        throw new Error(`${message || 'Deep assertion failed'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
}

function deepEquals(a, b) {
    // Handle strict equality (including primitives, null, undefined)
    if (a === b) return true;
    
    // Handle null/undefined cases
    if (a == null || b == null) return a === b;
    
    // Handle different types
    if (typeof a !== typeof b) return false;
    
    // Handle primitives that failed strict equality
    if (typeof a !== 'object') return false;
    
    // Handle arrays
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    if (Array.isArray(a)) {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
            if (!deepEquals(a[i], b[i])) return false;
        }
        return true;
    }
    
    // Handle Date objects
    if (a instanceof Date && b instanceof Date) {
        return a.getTime() === b.getTime();
    }
    
    // Handle RegExp objects
    if (a instanceof RegExp && b instanceof RegExp) {
        return a.toString() === b.toString();
    }
    
    // Handle objects
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    
    if (keysA.length !== keysB.length) return false;
    
    for (const key of keysA) {
        if (!keysB.includes(key)) return false;
        if (!deepEquals(a[key], b[key])) return false;
    }
    
    return true;
}

function assertTrue(condition, message) {
    if (!condition) {
        throw new Error(message || 'Expected condition to be true');
    }
}

// Mock app instance for testing
const mockApp = {
    getPath: (type) => {
        if (type === 'userData') {
            return path.join(os.tmpdir(), 'groq-test-' + Date.now());
        }
        return os.tmpdir();
    }
};

// Setup test environment
function setupTestEnvironment() {
    // Store original env vars
    const originalEnv = {
        GROQ_API_KEY: process.env.GROQ_API_KEY,
        GROQ_DEFAULT_MODEL: process.env.GROQ_DEFAULT_MODEL
    };
    
    // Clean up environment
    delete process.env.GROQ_API_KEY;
    delete process.env.GROQ_DEFAULT_MODEL;
    
    return originalEnv;
}

function cleanupTestEnvironment(originalEnv) {
    // Restore original env vars
    if (originalEnv.GROQ_API_KEY) {
        process.env.GROQ_API_KEY = originalEnv.GROQ_API_KEY;
    }
    if (originalEnv.GROQ_DEFAULT_MODEL) {
        process.env.GROQ_DEFAULT_MODEL = originalEnv.GROQ_DEFAULT_MODEL;
    }
}

console.log('🧪 Running settingsManager.js Unit Tests\n');

const originalEnv = setupTestEnvironment();

// Test 1: loadSettings without app instance returns minimal defaults
test('loadSettings without app instance returns minimal defaults', () => {
    // Temporarily clear the app instance
    const settingsManagerModule = require('./electron/settingsManager.js');
    
    // Clear any cached app instance by requiring fresh module
    delete require.cache[require.resolve('./electron/settingsManager.js')];
    const freshModule = require('./electron/settingsManager.js');
    
    const settings = freshModule.loadSettings();
    
    // Should return defaults without crashing
    assertTrue(settings.hasOwnProperty('GROQ_API_KEY'), 'Should have GROQ_API_KEY');
    assertTrue(settings.hasOwnProperty('model'), 'Should have model');
    assertEquals(settings.temperature, 0.7, 'Default temperature should be 0.7');
    assertEquals(settings.popupEnabled, true, 'Default popupEnabled should be true');
});

// Test 2: Boolean false values are preserved
test('Boolean false values are preserved in settings merge', () => {
    // Create a temporary directory for test
    const testUserData = path.join(os.tmpdir(), 'groq-test-boolean-' + Date.now());
    fs.mkdirSync(testUserData, { recursive: true });
    
    const testApp = {
        getPath: (type) => type === 'userData' ? testUserData : os.tmpdir()
    };
    
    // Initialize with test app
    delete require.cache[require.resolve('./electron/settingsManager.js')];
    const settingsManager = require('./electron/settingsManager.js');
    
    // Set app instance by calling initializeSettingsHandlers
    const mockIpcMain = {
        handle: () => {} // Mock ipcMain.handle
    };
    settingsManager.initializeSettingsHandlers(mockIpcMain, testApp);
    
    // Create settings file with false boolean values
    const settingsPath = path.join(testUserData, 'settings.json');
    const testSettings = {
        popupEnabled: false,
        enableSpellCheck: false,
        temperature: 0.7
    };
    fs.writeFileSync(settingsPath, JSON.stringify(testSettings, null, 2));
    
    const loadedSettings = settingsManager.loadSettings();
    
    assertEquals(loadedSettings.popupEnabled, false, 'popupEnabled should remain false');
    assertEquals(loadedSettings.enableSpellCheck, false, 'enableSpellCheck should remain false');
    
    // Cleanup
    fs.rmSync(testUserData, { recursive: true, force: true });
});

// Test 3: Zero numeric values are preserved
test('Zero numeric values are preserved in settings merge', () => {
    const testUserData = path.join(os.tmpdir(), 'groq-test-zero-' + Date.now());
    fs.mkdirSync(testUserData, { recursive: true });
    
    const testApp = {
        getPath: (type) => type === 'userData' ? testUserData : os.tmpdir()
    };
    
    delete require.cache[require.resolve('./electron/settingsManager.js')];
    const settingsManager = require('./electron/settingsManager.js');
    
    const mockIpcMain = { handle: () => {} };
    settingsManager.initializeSettingsHandlers(mockIpcMain, testApp);
    
    // Create settings file with zero values
    const settingsPath = path.join(testUserData, 'settings.json');
    const testSettings = {
        temperature: 0,
        top_p: 0,
        toolOutputLimit: 0
    };
    fs.writeFileSync(settingsPath, JSON.stringify(testSettings, null, 2));
    
    const loadedSettings = settingsManager.loadSettings();
    
    assertEquals(loadedSettings.temperature, 0, 'temperature should remain 0');
    assertEquals(loadedSettings.top_p, 0, 'top_p should remain 0');
    assertEquals(loadedSettings.toolOutputLimit, 0, 'toolOutputLimit should remain 0');
    
    // Cleanup
    fs.rmSync(testUserData, { recursive: true, force: true });
});

// Test 4: Empty string values are preserved
test('Empty string values are preserved in settings merge', () => {
    const testUserData = path.join(os.tmpdir(), 'groq-test-empty-' + Date.now());
    fs.mkdirSync(testUserData, { recursive: true });
    
    const testApp = {
        getPath: (type) => type === 'userData' ? testUserData : os.tmpdir()
    };
    
    delete require.cache[require.resolve('./electron/settingsManager.js')];
    const settingsManager = require('./electron/settingsManager.js');
    
    const mockIpcMain = { handle: () => {} };
    settingsManager.initializeSettingsHandlers(mockIpcMain, testApp);
    
    // Create settings file with empty string values
    const settingsPath = path.join(testUserData, 'settings.json');
    const testSettings = {
        customSystemPrompt: '',
        customCompletionUrl: '',
        customApiBaseUrl: '',
        theme: ''  // This should remain empty, not fall back to 'light'
    };
    fs.writeFileSync(settingsPath, JSON.stringify(testSettings, null, 2));
    
    const loadedSettings = settingsManager.loadSettings();
    
    assertEquals(loadedSettings.customSystemPrompt, '', 'customSystemPrompt should remain empty string');
    assertEquals(loadedSettings.customCompletionUrl, '', 'customCompletionUrl should remain empty string');
    assertEquals(loadedSettings.customApiBaseUrl, '', 'customApiBaseUrl should remain empty string');
    assertEquals(loadedSettings.theme, '', 'theme should remain empty string');
    
    // Cleanup
    fs.rmSync(testUserData, { recursive: true, force: true });
});

// Test 5: null vs undefined handling
test('null vs undefined handling in settings', () => {
    const testUserData = path.join(os.tmpdir(), 'groq-test-null-' + Date.now());
    fs.mkdirSync(testUserData, { recursive: true });
    
    const testApp = {
        getPath: (type) => type === 'userData' ? testUserData : os.tmpdir()
    };
    
    delete require.cache[require.resolve('./electron/settingsManager.js')];
    const settingsManager = require('./electron/settingsManager.js');
    
    const mockIpcMain = { handle: () => {} };
    settingsManager.initializeSettingsHandlers(mockIpcMain, testApp);
    
    // Create settings file with null and missing (undefined) values
    const settingsPath = path.join(testUserData, 'settings.json');
    const testSettings = {
        temperature: null,
        // top_p is missing (undefined)
        customSystemPrompt: null,
        popupEnabled: null
    };
    fs.writeFileSync(settingsPath, JSON.stringify(testSettings, null, 2));
    
    const loadedSettings = settingsManager.loadSettings();
    
    // null values should be replaced with defaults due to nullish coalescing
    assertEquals(loadedSettings.temperature, 0.7, 'null temperature should use default');
    assertEquals(loadedSettings.top_p, 0.95, 'undefined top_p should use default');
    assertEquals(loadedSettings.customSystemPrompt, '', 'null customSystemPrompt should use default');
    assertEquals(loadedSettings.popupEnabled, true, 'null popupEnabled should use default');
    
    // Cleanup
    fs.rmSync(testUserData, { recursive: true, force: true });
});

// Test 6: Environment variable precedence
test('Environment variable precedence for API key', () => {
    // Set environment variable
    process.env.GROQ_API_KEY = 'env-test-key';
    
    const testUserData = path.join(os.tmpdir(), 'groq-test-env-' + Date.now());
    fs.mkdirSync(testUserData, { recursive: true });
    
    const testApp = {
        getPath: (type) => type === 'userData' ? testUserData : os.tmpdir()
    };
    
    delete require.cache[require.resolve('./electron/settingsManager.js')];
    const settingsManager = require('./electron/settingsManager.js');
    
    const mockIpcMain = { handle: () => {} };
    settingsManager.initializeSettingsHandlers(mockIpcMain, testApp);
    
    // Create settings file with different API key
    const settingsPath = path.join(testUserData, 'settings.json');
    const testSettings = {
        GROQ_API_KEY: 'file-test-key'
    };
    fs.writeFileSync(settingsPath, JSON.stringify(testSettings, null, 2));
    
    const loadedSettings = settingsManager.loadSettings();
    
    assertEquals(loadedSettings.GROQ_API_KEY, 'env-test-key', 'Environment variable should take precedence');
    
    // Cleanup
    delete process.env.GROQ_API_KEY;
    fs.rmSync(testUserData, { recursive: true, force: true });
});

// Test 7: Settings file creation when missing
test('Settings file creation when missing', () => {
    const testUserData = path.join(os.tmpdir(), 'groq-test-create-' + Date.now());
    fs.mkdirSync(testUserData, { recursive: true });
    
    const testApp = {
        getPath: (type) => type === 'userData' ? testUserData : os.tmpdir()
    };
    
    delete require.cache[require.resolve('./electron/settingsManager.js')];
    const settingsManager = require('./electron/settingsManager.js');
    
    const mockIpcMain = { handle: () => {} };
    settingsManager.initializeSettingsHandlers(mockIpcMain, testApp);
    
    const settingsPath = path.join(testUserData, 'settings.json');
    
    // Ensure file doesn't exist
    if (fs.existsSync(settingsPath)) {
        fs.unlinkSync(settingsPath);
    }
    
    const loadedSettings = settingsManager.loadSettings();
    
    // File should be created
    assertTrue(fs.existsSync(settingsPath), 'Settings file should be created');
    
    // Should return default settings
    assertEquals(loadedSettings.temperature, 0.7, 'Should have default temperature');
    assertEquals(loadedSettings.popupEnabled, true, 'Should have default popupEnabled');
    
    // Cleanup
    fs.rmSync(testUserData, { recursive: true, force: true });
});

// Test 8: Error handling for corrupted JSON
test('Error handling for corrupted JSON file', () => {
    const testUserData = path.join(os.tmpdir(), 'groq-test-corrupt-' + Date.now());
    fs.mkdirSync(testUserData, { recursive: true });
    
    const testApp = {
        getPath: (type) => type === 'userData' ? testUserData : os.tmpdir()
    };
    
    delete require.cache[require.resolve('./electron/settingsManager.js')];
    const settingsManager = require('./electron/settingsManager.js');
    
    const mockIpcMain = { handle: () => {} };
    settingsManager.initializeSettingsHandlers(mockIpcMain, testApp);
    
    // Create corrupted JSON file
    const settingsPath = path.join(testUserData, 'settings.json');
    fs.writeFileSync(settingsPath, '{ invalid json }');
    
    const loadedSettings = settingsManager.loadSettings();
    
    // Should return defaults when JSON is corrupted
    assertEquals(loadedSettings.temperature, 0.7, 'Should fallback to default temperature on JSON error');
    assertEquals(loadedSettings.popupEnabled, true, 'Should fallback to default popupEnabled on JSON error');
    
    // Cleanup
    fs.rmSync(testUserData, { recursive: true, force: true });
});

// Test 9: Settings validation in save handler
test('Settings validation logic', () => {
    const testUserData = path.join(os.tmpdir(), 'groq-test-validation-' + Date.now());
    fs.mkdirSync(testUserData, { recursive: true });
    
    const testApp = {
        getPath: (type) => type === 'userData' ? testUserData : os.tmpdir()
    };
    
    delete require.cache[require.resolve('./electron/settingsManager.js')];
    const settingsManager = require('./electron/settingsManager.js');
    
    let saveHandlerFn;
    const mockIpcMain = {
        handle: (event, handler) => {
            if (event === 'save-settings') {
                saveHandlerFn = handler;
            }
        }
    };
    
    settingsManager.initializeSettingsHandlers(mockIpcMain, testApp);
    
    // Test invalid settings object
    let result = saveHandlerFn(null, null);
    assertEquals(result.success, false, 'Should fail with null settings');
    assertTrue(result.error.includes('Invalid settings object'), 'Should have validation error message');
    
    result = saveHandlerFn(null, 'not an object');
    assertEquals(result.success, false, 'Should fail with non-object settings');
    
    // Test valid settings object
    const validSettings = { temperature: 0.5, popupEnabled: false };
    result = saveHandlerFn(null, validSettings);
    assertEquals(result.success, true, 'Should succeed with valid settings object');
    
    // Cleanup
    fs.rmSync(testUserData, { recursive: true, force: true });
});

cleanupTestEnvironment(originalEnv);

// Print test summary
console.log('\n📊 Test Summary:');
console.log(`Total tests: ${testCount}`);
console.log(`Passed: ${passedCount}`);
console.log(`Failed: ${testCount - passedCount}`);

if (passedCount === testCount) {
    console.log('\n🎉 All tests passed!');
    process.exit(0);
} else {
    console.log('\n💥 Some tests failed!');
    process.exit(1);
}
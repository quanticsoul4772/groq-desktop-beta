const fs = require('fs');
const path = require('path');
const os = require('os');

// Import the settingsManager
const { loadSettings, initializeSettingsHandlers } = require('./electron/settingsManager.js');

// Import shared test utilities for performance optimization
const { testUtils } = require('./test-utils.js');

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
        throw new Error(`${message || `Value assertion failed: expected '${expected}' (${typeof expected}) but received '${actual}' (${typeof actual})`}`);
    }
}

function assertDeepEquals(actual, expected, message) {
    if (!deepEquals(actual, expected)) {
        throw new Error(`${message || `Deep comparison failed: objects are not structurally equal\nExpected: ${JSON.stringify(expected, null, 2)}\nReceived: ${JSON.stringify(actual, null, 2)}`}`);
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
        throw new Error(message || `Boolean assertion failed: expected truthy value but received '${condition}' (${typeof condition})`);
    }
}

// Mock app instance for testing
const mockApp = {
    getPath: (type) => {
        if (type === 'userData') {
            return testUtils.getTestDir('mockApp');
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

// Initialize shared test directory for performance optimization
testUtils.initializeSharedRoot();

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
    assertTrue(settings.hasOwnProperty('GROQ_API_KEY'), 'Settings object must contain GROQ_API_KEY property for API authentication');
    assertTrue(settings.hasOwnProperty('model'), 'Settings object must contain model property to specify the AI model to use');
    assertEquals(settings.temperature, 0.7, `Default temperature must be 0.7 for consistent model behavior, found ${settings.temperature}`);
    assertEquals(settings.popupEnabled, true, `Default popupEnabled must be true to enable popup functionality, found ${settings.popupEnabled}`);
});

// Test 2: Boolean false values are preserved
test('Boolean false values are preserved in settings merge', () => {
    // Create a temporary directory for test
    const testUserData = testUtils.getTestDir('boolean-test');
    
    const testApp = {
        getPath: (type) => type === 'userData' ? testUserData : os.tmpdir()
    };
    
    // Initialize with test app
    delete require.cache[require.resolve('./electron/settingsManager.js')];
    const settingsManager = require('./electron/settingsManager.js');
    
    // Set app instance by calling initializeSettingsHandlers
    const mockIpcMain = require('./__mocks__/ipcMain.js');
    mockIpcMain._reset(); // Clear any previous handlers
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
    
    assertEquals(loadedSettings.popupEnabled, false, `Settings merge must preserve boolean false value for popupEnabled, found ${loadedSettings.popupEnabled}`);
    assertEquals(loadedSettings.enableSpellCheck, false, `Settings merge must preserve boolean false value for enableSpellCheck, found ${loadedSettings.enableSpellCheck}`);
    
    // Cleanup
    testUtils.cleanupTestDir('boolean-test');
});

// Test 3: Zero numeric values are preserved
test('Zero numeric values are preserved in settings merge', () => {
    const testUserData = testUtils.getTestDir('zero-test');
    
    const testApp = {
        getPath: (type) => type === 'userData' ? testUserData : os.tmpdir()
    };
    
    delete require.cache[require.resolve('./electron/settingsManager.js')];
    const settingsManager = require('./electron/settingsManager.js');
    
    const mockIpcMain = require('./__mocks__/ipcMain.js');
    mockIpcMain._reset(); // Clear any previous handlers
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
    
    assertEquals(loadedSettings.temperature, 0, `Settings merge must preserve zero value for temperature parameter, found ${loadedSettings.temperature}`);
    assertEquals(loadedSettings.top_p, 0, `Settings merge must preserve zero value for top_p parameter, found ${loadedSettings.top_p}`);
    assertEquals(loadedSettings.toolOutputLimit, 0, `Settings merge must preserve zero value for toolOutputLimit parameter, found ${loadedSettings.toolOutputLimit}`);
    
    // Cleanup
    testUtils.cleanupTestDir('zero-test');
});

// Test 4: Empty string values are preserved
test('Empty string values are preserved in settings merge', () => {
    const testUserData = testUtils.getTestDir('empty-test');
    
    const testApp = {
        getPath: (type) => type === 'userData' ? testUserData : os.tmpdir()
    };
    
    delete require.cache[require.resolve('./electron/settingsManager.js')];
    const settingsManager = require('./electron/settingsManager.js');
    
    const mockIpcMain = require('./__mocks__/ipcMain.js');
    mockIpcMain._reset(); // Clear any previous handlers
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
    
    assertEquals(loadedSettings.customSystemPrompt, '', `Settings merge must preserve empty string for customSystemPrompt, found '${loadedSettings.customSystemPrompt}'`);
    assertEquals(loadedSettings.customCompletionUrl, '', `Settings merge must preserve empty string for customCompletionUrl, found '${loadedSettings.customCompletionUrl}'`);
    assertEquals(loadedSettings.customApiBaseUrl, '', `Settings merge must preserve empty string for customApiBaseUrl, found '${loadedSettings.customApiBaseUrl}'`);
    assertEquals(loadedSettings.theme, '', `Settings merge must preserve empty string for theme, found '${loadedSettings.theme}'`);
    
    // Cleanup
    testUtils.cleanupTestDir('empty-test');
});

// Test 5: null vs undefined handling
test('null vs undefined handling in settings', () => {
    const testUserData = testUtils.getTestDir('null-test');
    
    const testApp = {
        getPath: (type) => type === 'userData' ? testUserData : os.tmpdir()
    };
    
    delete require.cache[require.resolve('./electron/settingsManager.js')];
    const settingsManager = require('./electron/settingsManager.js');
    
    const mockIpcMain = require('./__mocks__/ipcMain.js');
    mockIpcMain._reset(); // Clear any previous handlers
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
    assertEquals(loadedSettings.temperature, 0.7, `Null temperature value must fallback to default 0.7 via nullish coalescing, found ${loadedSettings.temperature}`);
    assertEquals(loadedSettings.top_p, 0.95, `Undefined top_p value must fallback to default 0.95 via nullish coalescing, found ${loadedSettings.top_p}`);
    assertEquals(loadedSettings.customSystemPrompt, '', `Null customSystemPrompt must fallback to default empty string, found '${loadedSettings.customSystemPrompt}'`);
    assertEquals(loadedSettings.popupEnabled, true, `Null popupEnabled must fallback to default true value, found ${loadedSettings.popupEnabled}`);
    
    // Cleanup
    testUtils.cleanupTestDir('null-test');
});

// Test 6: Environment variable precedence
test('Environment variable precedence for API key', () => {
    // Set environment variable
    process.env.GROQ_API_KEY = 'env-test-key';
    
    const testUserData = testUtils.getTestDir('env-test');
    
    const testApp = {
        getPath: (type) => type === 'userData' ? testUserData : os.tmpdir()
    };
    
    delete require.cache[require.resolve('./electron/settingsManager.js')];
    const settingsManager = require('./electron/settingsManager.js');
    
    const mockIpcMain = require('./__mocks__/ipcMain.js');
    mockIpcMain._reset(); // Clear any previous handlers
    settingsManager.initializeSettingsHandlers(mockIpcMain, testApp);
    
    // Create settings file with different API key
    const settingsPath = path.join(testUserData, 'settings.json');
    const testSettings = {
        GROQ_API_KEY: 'file-test-key'
    };
    fs.writeFileSync(settingsPath, JSON.stringify(testSettings, null, 2));
    
    const loadedSettings = settingsManager.loadSettings();
    
    assertEquals(loadedSettings.GROQ_API_KEY, 'env-test-key', `GROQ_API_KEY from environment must override file setting for security, expected 'env-test-key' but found '${loadedSettings.GROQ_API_KEY}'`);
    
    // Cleanup
    delete process.env.GROQ_API_KEY;
    testUtils.cleanupTestDir('env-test');
});

// Test 7: Settings file creation when missing
test('Settings file creation when missing', () => {
    const testUserData = testUtils.getTestDir('create-test');
    
    const testApp = {
        getPath: (type) => type === 'userData' ? testUserData : os.tmpdir()
    };
    
    delete require.cache[require.resolve('./electron/settingsManager.js')];
    const settingsManager = require('./electron/settingsManager.js');
    
    const mockIpcMain = require('./__mocks__/ipcMain.js');
    mockIpcMain._reset(); // Clear any previous handlers
    settingsManager.initializeSettingsHandlers(mockIpcMain, testApp);
    
    const settingsPath = path.join(testUserData, 'settings.json');
    
    // Ensure file doesn't exist
    if (fs.existsSync(settingsPath)) {
        fs.unlinkSync(settingsPath);
    }
    
    const loadedSettings = settingsManager.loadSettings();
    
    // File should be created
    assertTrue(fs.existsSync(settingsPath), `Settings file must be auto-created when missing at path: ${settingsPath}`);
    
    // Should return default settings
    assertEquals(loadedSettings.temperature, 0.7, `Auto-created settings must have default temperature 0.7, found ${loadedSettings.temperature}`);
    assertEquals(loadedSettings.popupEnabled, true, `Auto-created settings must have default popupEnabled true, found ${loadedSettings.popupEnabled}`);
    
    // Cleanup
    testUtils.cleanupTestDir('create-test');
});

// Test 8: Error handling for corrupted JSON
test('Error handling for corrupted JSON file', () => {
    const testUserData = testUtils.getTestDir('corrupt-test');
    
    const testApp = {
        getPath: (type) => type === 'userData' ? testUserData : os.tmpdir()
    };
    
    delete require.cache[require.resolve('./electron/settingsManager.js')];
    const settingsManager = require('./electron/settingsManager.js');
    
    const mockIpcMain = require('./__mocks__/ipcMain.js');
    mockIpcMain._reset(); // Clear any previous handlers
    settingsManager.initializeSettingsHandlers(mockIpcMain, testApp);
    
    // Create corrupted JSON file
    const settingsPath = path.join(testUserData, 'settings.json');
    fs.writeFileSync(settingsPath, '{ invalid json }');
    
    const loadedSettings = settingsManager.loadSettings();
    
    // Should return defaults when JSON is corrupted
    assertEquals(loadedSettings.temperature, 0.7, `Corrupted JSON must fallback to default temperature 0.7 for graceful recovery, found ${loadedSettings.temperature}`);
    assertEquals(loadedSettings.popupEnabled, true, `Corrupted JSON must fallback to default popupEnabled true for graceful recovery, found ${loadedSettings.popupEnabled}`);
    
    // Cleanup
    testUtils.cleanupTestDir('corrupt-test');
});

// Test 9: Settings validation in save handler
test('Settings validation logic', () => {
    const testUserData = testUtils.getTestDir('validation-test');
    
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
    assertEquals(result.success, false, `Settings validation must reject null input for data integrity, result.success was ${result.success}`);
    assertTrue(result.error.includes('Invalid settings object'), `Validation error must specify 'Invalid settings object' for null input, got: '${result.error}'`);
    
    result = saveHandlerFn(null, 'not an object');
    assertEquals(result.success, false, `Settings validation must reject non-object input (string), result.success was ${result.success}`);
    
    // Test valid settings object
    const validSettings = { temperature: 0.5, popupEnabled: false };
    result = saveHandlerFn(null, validSettings);
    assertEquals(result.success, true, `Settings validation must accept valid object input, result.success was ${result.success}`);
    
    // Cleanup
    testUtils.cleanupTestDir('validation-test');
});

// Test 10: Mock IPC handler registration and invocation
test('Mock IPC handlers are registered and can be invoked', () => {
    const testUserData = testUtils.getTestDir('ipc-test');
    
    const testApp = {
        getPath: (type) => type === 'userData' ? testUserData : os.tmpdir()
    };
    
    delete require.cache[require.resolve('./electron/settingsManager.js')];
    const settingsManager = require('./electron/settingsManager.js');
    
    const mockIpcMain = require('./__mocks__/ipcMain.js');
    mockIpcMain._reset(); // Clear any previous handlers
    settingsManager.initializeSettingsHandlers(mockIpcMain, testApp);
    
    // Create a test settings file
    const settingsPath = path.join(testUserData, 'settings.json');
    const testSettings = { temperature: 0.8, popupEnabled: false };
    fs.writeFileSync(settingsPath, JSON.stringify(testSettings, null, 2));
    
    // Test get-settings handler
    const result = mockIpcMain._invoke('get-settings');
    assertEquals(result.temperature, 0.8, `IPC get-settings handler must return saved temperature value 0.8, found ${result.temperature}`);
    assertEquals(result.popupEnabled, false, `IPC get-settings handler must return saved popupEnabled false value, found ${result.popupEnabled}`);
    
    // Test save-settings handler
    const newSettings = { temperature: 0.9, popupEnabled: true };
    const saveResult = mockIpcMain._invoke('save-settings', null, newSettings);
    assertEquals(saveResult.success, true, `IPC save-settings handler must succeed with valid data, saveResult.success was ${saveResult.success}`);
    
    // Verify settings were saved
    const savedData = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    assertEquals(savedData.temperature, 0.9, `IPC handler must persist temperature 0.9 to settings file, found ${savedData.temperature} in saved file`);
    assertEquals(savedData.popupEnabled, true, `IPC handler must persist popupEnabled true to settings file, found ${savedData.popupEnabled} in saved file`);
    
    // Cleanup
    testUtils.cleanupTestDir('ipc-test');
});

// Test 11: Mock IPC _reset functionality
test('Mock IPC _reset clears all handlers', () => {
    const testUserData = testUtils.getTestDir('reset-test');
    
    const testApp = {
        getPath: (type) => type === 'userData' ? testUserData : os.tmpdir()
    };
    
    delete require.cache[require.resolve('./electron/settingsManager.js')];
    const settingsManager = require('./electron/settingsManager.js');
    
    const mockIpcMain = require('./__mocks__/ipcMain.js');
    mockIpcMain._reset(); // Clear any previous handlers
    settingsManager.initializeSettingsHandlers(mockIpcMain, testApp);
    
    // Verify handler is registered and can be called
    const settings = mockIpcMain._invoke('get-settings');
    assertTrue(settings !== undefined, `IPC get-settings handler must be registered and return defined result, got ${typeof settings}: ${settings}`);
    
    // Reset and verify handlers are cleared
    mockIpcMain._reset();
    
    let errorCaught = false;
    try {
        mockIpcMain._invoke('get-settings');
    } catch (error) {
        errorCaught = true;
        assertTrue(error.message.includes('No handler registered'), `Mock IPC must throw 'No handler registered' error after reset, got: '${error.message}'`);
    }
    
    assertTrue(errorCaught, `Mock IPC _reset() must clear handlers causing subsequent calls to throw errors, errorCaught was ${errorCaught}`);
    
    // Cleanup
    testUtils.cleanupTestDir('reset-test');
});

// Test 12: Mock IPC error handling for missing handlers
test('Mock IPC throws error for unregistered handlers', () => {
    const mockIpcMain = require('./__mocks__/ipcMain.js');
    mockIpcMain._reset(); // Clear any previous handlers
    
    let errorCaught = false;
    try {
        mockIpcMain._invoke('non-existent-channel');
    } catch (error) {
        errorCaught = true;
        assertTrue(error.message.includes('No handler registered for channel: non-existent-channel'), 
                   `Mock IPC must throw descriptive error with channel name for unregistered handlers, got: '${error.message}'`);
    }
    
    assertTrue(errorCaught, `Mock IPC must throw error when invoking unregistered handler 'non-existent-channel', errorCaught was ${errorCaught}`);
});

cleanupTestEnvironment(originalEnv);

// Clean up all shared test directories
testUtils.cleanupAll();

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
// Mock electron-json-storage
jest.mock('electron-json-storage', () => ({
  get: jest.fn(),
  set: jest.fn(),
  has: jest.fn(),
  remove: jest.fn(),
  clear: jest.fn(),
  getDataPath: jest.fn(() => '/mock/data/path'),
}));

// Mock electron
jest.mock('electron', () => require('../../__mocks__/electron'));

// Mock dotenv
jest.mock('dotenv', () => ({
  config: jest.fn(),
}));

// Mock fs
jest.mock('fs');

const settingsManager = require('../settingsManager');

describe('SettingsManager Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('loadSettings', () => {
    test('returns default settings when app instance not initialized', () => {
      const settings = settingsManager.loadSettings();

      expect(settings).toBeDefined();
      expect(settings).toHaveProperty('GROQ_API_KEY');
      expect(settings).toHaveProperty('model');
      expect(settings).toHaveProperty('temperature');
      expect(settings).toHaveProperty('theme');
      expect(settings.model).toBe('llama-3.3-70b-versatile');
      expect(settings.temperature).toBe(0.7);
      expect(settings.theme).toBe('light');
    });

    test('includes all required default properties', () => {
      const settings = settingsManager.loadSettings();

      const requiredProperties = [
        'GROQ_API_KEY',
        'model',
        'temperature',
        'top_p',
        'mcpServers',
        'disabledMcpServers',
        'customSystemPrompt',
        'popupEnabled',
        'customCompletionUrl',
        'toolOutputLimit',
        'customApiBaseUrl',
        'customModels',
        'theme',
        'enableSpellCheck',
      ];

      requiredProperties.forEach((prop) => {
        expect(settings).toHaveProperty(prop);
      });
    });

    test('returns object with correct default values', () => {
      const settings = settingsManager.loadSettings();

      expect(settings.temperature).toBe(0.7);
      expect(settings.top_p).toBe(0.95);
      expect(settings.popupEnabled).toBe(true);
      expect(settings.toolOutputLimit).toBe(8000);
      expect(settings.theme).toBe('light');
      expect(settings.enableSpellCheck).toBe(true);
      expect(Array.isArray(settings.disabledMcpServers)).toBe(true);
      expect(typeof settings.mcpServers).toBe('object');
      expect(typeof settings.customModels).toBe('object');
    });
  });

  describe('initializeSettingsHandlers', () => {
    test('is a function', () => {
      expect(typeof settingsManager.initializeSettingsHandlers).toBe('function');
    });

    test('accepts app and ipcMain parameters', () => {
      const mockApp = { getPath: jest.fn() };
      const mockIpcMain = { handle: jest.fn() };

      // Should not throw
      expect(() => {
        settingsManager.initializeSettingsHandlers(mockApp, mockIpcMain);
      }).not.toThrow();
    });
  });
});

const settingsManager = require('../../../electron/settingsManager');
const fs = require('fs');

describe('SettingsManager', () => {
  const mockApp = {
    getPath: jest.fn(() => '/mock/userData'),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset environment variables
    delete process.env.GROQ_API_KEY;
    delete process.env.GROQ_DEFAULT_MODEL;

    // Mock fs methods
    fs.existsSync = jest.fn();
    fs.readFileSync = jest.fn();
    fs.writeFileSync = jest.fn();
    fs.mkdirSync = jest.fn();

    // Initialize with mock app
    settingsManager.initialize(mockApp);
  });

  test('initializes with app instance', () => {
    expect(() => {
      settingsManager.initialize(mockApp);
    }).not.toThrow();
  });

  test('loads default settings when no file exists', () => {
    fs.existsSync.mockReturnValue(false);

    const settings = settingsManager.loadSettings();

    expect(settings).toHaveProperty('GROQ_API_KEY');
    expect(settings).toHaveProperty('model');
    expect(settings).toHaveProperty('temperature');
    expect(settings.model).toBe('llama-3.3-70b-versatile');
    expect(settings.temperature).toBe(0.7);
  });

  test('loads settings from file when it exists', () => {
    const mockSettings = {
      GROQ_API_KEY: 'test-api-key',
      model: 'custom-model',
      temperature: 0.5,
    };

    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(JSON.stringify(mockSettings));

    const settings = settingsManager.loadSettings();

    expect(settings.GROQ_API_KEY).toBe('test-api-key');
    expect(settings.model).toBe('custom-model');
    expect(settings.temperature).toBe(0.5);
  });

  test('handles corrupt settings file gracefully', () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue('invalid json');

    const settings = settingsManager.loadSettings();

    // Should return defaults when file is corrupt
    expect(settings).toHaveProperty('GROQ_API_KEY');
    expect(settings.model).toBe('llama-3.3-70b-versatile');
  });

  test('saves settings to file', () => {
    const newSettings = {
      GROQ_API_KEY: 'new-api-key',
      model: 'new-model',
      temperature: 0.8,
    };

    settingsManager.saveSettings(newSettings);

    expect(fs.writeFileSync).toHaveBeenCalled();
    const savedData = fs.writeFileSync.mock.calls[0][1];
    const parsedData = JSON.parse(savedData);

    expect(parsedData.GROQ_API_KEY).toBe('new-api-key');
    expect(parsedData.model).toBe('new-model');
    expect(parsedData.temperature).toBe(0.8);
  });

  test('creates settings directory if it does not exist', () => {
    const newSettings = { GROQ_API_KEY: 'test' };

    // Mock directory doesn't exist
    fs.existsSync.mockImplementation((filePath) => {
      return !filePath.includes('userData'); // Directory doesn't exist
    });

    settingsManager.saveSettings(newSettings);

    expect(fs.mkdirSync).toHaveBeenCalledWith(expect.stringContaining('userData'), {
      recursive: true,
    });
  });

  test('gets specific setting value', () => {
    const mockSettings = {
      GROQ_API_KEY: 'test-key',
      model: 'test-model',
    };

    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(JSON.stringify(mockSettings));

    const apiKey = settingsManager.getSetting('GROQ_API_KEY');
    const model = settingsManager.getSetting('model');

    expect(apiKey).toBe('test-key');
    expect(model).toBe('test-model');
  });

  test('returns default for non-existent setting', () => {
    fs.existsSync.mockReturnValue(false);

    const nonExistent = settingsManager.getSetting('NON_EXISTENT');

    expect(nonExistent).toBeUndefined();
  });

  test('sets individual setting', () => {
    fs.existsSync.mockReturnValue(false);

    settingsManager.setSetting('GROQ_API_KEY', 'updated-key');

    expect(fs.writeFileSync).toHaveBeenCalled();
    const savedData = fs.writeFileSync.mock.calls[0][1];
    const parsedData = JSON.parse(savedData);

    expect(parsedData.GROQ_API_KEY).toBe('updated-key');
  });

  test('merges new settings with existing ones', () => {
    const existingSettings = {
      GROQ_API_KEY: 'existing-key',
      model: 'existing-model',
      temperature: 0.5,
    };

    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(JSON.stringify(existingSettings));

    settingsManager.setSetting('temperature', 0.9);

    const savedData = fs.writeFileSync.mock.calls[0][1];
    const parsedData = JSON.parse(savedData);

    // Should preserve existing settings and update only the specified one
    expect(parsedData.GROQ_API_KEY).toBe('existing-key');
    expect(parsedData.model).toBe('existing-model');
    expect(parsedData.temperature).toBe(0.9);
  });

  test('handles MCP server settings', () => {
    const settings = settingsManager.loadSettings();

    expect(settings).toHaveProperty('mcpServers');
    expect(settings).toHaveProperty('disabledMcpServers');
    expect(Array.isArray(settings.disabledMcpServers)).toBe(true);
  });

  test('loads environment variables as defaults', () => {
    process.env.GROQ_API_KEY = 'env-api-key';
    process.env.GROQ_DEFAULT_MODEL = 'env-model';

    fs.existsSync.mockReturnValue(false);

    // Re-require to pick up new env vars
    delete require.cache[require.resolve('../../../electron/settingsManager')];
    const freshSettingsManager = require('../../../electron/settingsManager');
    freshSettingsManager.initialize(mockApp);

    const settings = freshSettingsManager.loadSettings();

    expect(settings.GROQ_API_KEY).toBe('env-api-key');
    expect(settings.model).toBe('env-model');
  });

  test('validates theme setting', () => {
    settingsManager.setSetting('theme', 'dark');

    const savedData = fs.writeFileSync.mock.calls[0][1];
    const parsedData = JSON.parse(savedData);

    expect(parsedData.theme).toBe('dark');
  });

  test('handles boolean settings correctly', () => {
    settingsManager.setSetting('popupEnabled', false);
    settingsManager.setSetting('enableSpellCheck', true);

    const savedData = fs.writeFileSync.mock.calls[0][1];
    const parsedData = JSON.parse(savedData);

    expect(parsedData.popupEnabled).toBe(false);
    expect(parsedData.enableSpellCheck).toBe(true);
  });

  test('handles numeric settings correctly', () => {
    settingsManager.setSetting('temperature', 0.75);
    settingsManager.setSetting('toolOutputLimit', 10000);

    const savedData = fs.writeFileSync.mock.calls[0][1];
    const parsedData = JSON.parse(savedData);

    expect(parsedData.temperature).toBe(0.75);
    expect(parsedData.toolOutputLimit).toBe(10000);
  });

  test('handles object settings correctly', () => {
    const customModels = {
      'custom-model-1': { name: 'Custom Model 1' },
      'custom-model-2': { name: 'Custom Model 2' },
    };

    settingsManager.setSetting('customModels', customModels);

    const savedData = fs.writeFileSync.mock.calls[0][1];
    const parsedData = JSON.parse(savedData);

    expect(parsedData.customModels).toEqual(customModels);
  });

  test('handles file system errors gracefully', () => {
    fs.writeFileSync.mockImplementation(() => {
      throw new Error('Permission denied');
    });

    expect(() => {
      settingsManager.saveSettings({ GROQ_API_KEY: 'test' });
    }).toThrow('Permission denied');
  });

  test('returns defaults when app not initialized', () => {
    // Create a fresh instance without initialization
    delete require.cache[require.resolve('../../../electron/settingsManager')];
    const uninitializedManager = require('../../../electron/settingsManager');

    const settings = uninitializedManager.loadSettings();

    expect(settings).toHaveProperty('GROQ_API_KEY');
    expect(settings.model).toBe('llama-3.3-70b-versatile');
  });
});

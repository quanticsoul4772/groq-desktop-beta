// Mock Electron modules
jest.mock('electron', () => ({
  app: {
    getVersion: () => '1.0.0',
    getName: () => 'Groq Desktop',
    getPath: (name) => `/mock/path/${name}`,
    setPath: jest.fn(),
    quit: jest.fn(),
    whenReady: () => Promise.resolve(),
    on: jest.fn(),
    once: jest.fn(),
    removeListener: jest.fn(),
  },
  BrowserWindow: jest.fn().mockImplementation(() => ({
    loadURL: jest.fn(),
    loadFile: jest.fn(),
    on: jest.fn(),
    once: jest.fn(),
    webContents: {
      send: jest.fn(),
      on: jest.fn(),
      openDevTools: jest.fn(),
    },
    show: jest.fn(),
    hide: jest.fn(),
    close: jest.fn(),
    destroy: jest.fn(),
    focus: jest.fn(),
    isFocused: () => true,
    isVisible: () => true,
    isDestroyed: () => false,
  })),
  ipcMain: {
    on: jest.fn(),
    once: jest.fn(),
    handle: jest.fn(),
    removeListener: jest.fn(),
    removeAllListeners: jest.fn(),
  },
  shell: {
    openExternal: jest.fn(),
  },
  Menu: {
    setApplicationMenu: jest.fn(),
    buildFromTemplate: jest.fn(),
  },
  dialog: {
    showMessageBox: jest.fn(),
    showOpenDialog: jest.fn(),
    showSaveDialog: jest.fn(),
  },
  contextBridge: {
    exposeInMainWorld: jest.fn(),
  },
}));

// Mock electron-json-storage
jest.mock('electron-json-storage', () => ({
  get: jest.fn((key, callback) => callback(null, {})),
  set: jest.fn((key, data, callback) => callback(null)),
  has: jest.fn((key, callback) => callback(null, false)),
  keys: jest.fn((callback) => callback(null, [])),
  remove: jest.fn((key, callback) => callback(null)),
  clear: jest.fn((callback) => callback(null)),
}));

// Mock Node.js modules
jest.mock('fs', () => ({
  existsSync: jest.fn(() => true),
  readFileSync: jest.fn(() => '{}'),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
  promises: {
    readFile: jest.fn(() => Promise.resolve('{}')),
    writeFile: jest.fn(() => Promise.resolve()),
    mkdir: jest.fn(() => Promise.resolve()),
    access: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock('path', () => ({
  join: jest.fn((...args) => args.join('/')),
  resolve: jest.fn((...args) => '/' + args.join('/')),
  dirname: jest.fn((path) => path.split('/').slice(0, -1).join('/')),
  basename: jest.fn((path) => path.split('/').pop()),
  extname: jest.fn((path) => {
    const parts = path.split('.');
    return parts.length > 1 ? '.' + parts.pop() : '';
  }),
  sep: '/',
}));

// Mock process (use defineProperty for read-only properties)
Object.defineProperty(process, 'platform', {
  value: 'linux',
  writable: true,
  configurable: true,
});
process.env.NODE_ENV = 'test';

// Ensure full mock isolation between tests
afterEach(() => {
  // Reset all mocks after each test for full isolation
  jest.resetAllMocks();
  // Restore all mocked modules
  jest.restoreAllMocks();
});

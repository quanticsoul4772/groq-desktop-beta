// Mock Electron module for Jest tests
const electron = {
  app: {
    getPath: jest.fn((name) => {
      const paths = {
        userData: '/mock/user/data',
        appData: '/mock/app/data',
        logs: '/mock/logs',
        temp: '/mock/temp',
        home: '/mock/home',
      };
      return paths[name] || '/mock/path';
    }),
    getVersion: jest.fn(() => '1.0.0'),
    getName: jest.fn(() => 'Groq Desktop'),
    quit: jest.fn(),
    on: jest.fn(),
    whenReady: jest.fn(() => Promise.resolve()),
  },

  BrowserWindow: jest.fn().mockImplementation(() => ({
    loadURL: jest.fn(),
    loadFile: jest.fn(),
    on: jest.fn(),
    webContents: {
      send: jest.fn(),
      on: jest.fn(),
      openDevTools: jest.fn(),
    },
    show: jest.fn(),
    close: jest.fn(),
    destroy: jest.fn(),
    isDestroyed: jest.fn(() => false),
    setAlwaysOnTop: jest.fn(),
  })),

  ipcMain: {
    handle: jest.fn(),
    on: jest.fn(),
    removeHandler: jest.fn(),
    removeAllListeners: jest.fn(),
  },

  ipcRenderer: {
    send: jest.fn(),
    on: jest.fn(),
    invoke: jest.fn(),
    removeListener: jest.fn(),
    removeAllListeners: jest.fn(),
  },

  dialog: {
    showOpenDialog: jest.fn(),
    showSaveDialog: jest.fn(),
    showMessageBox: jest.fn(),
    showErrorBox: jest.fn(),
  },

  Menu: {
    buildFromTemplate: jest.fn(),
    setApplicationMenu: jest.fn(),
  },

  shell: {
    openExternal: jest.fn(),
    openPath: jest.fn(),
  },

  contextBridge: {
    exposeInMainWorld: jest.fn(),
  },
};

// Freeze the mock to prevent tampering
Object.freeze(electron.app);
Object.freeze(electron.BrowserWindow);
Object.freeze(electron.ipcMain);
Object.freeze(electron.ipcRenderer);
Object.freeze(electron.dialog);
Object.freeze(electron.Menu);
Object.freeze(electron.shell);
Object.freeze(electron.contextBridge);
Object.freeze(electron);

module.exports = electron;

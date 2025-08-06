const electronMock = require('../../../__mocks__/electron');
const ipcMainMock = require('../../../__mocks__/ipcMain');

describe('Mock Security', () => {
  describe('Electron Mock Protection', () => {
    test('frozen electron mock throws when attempting to add properties', () => {
      expect(() => {
        electronMock.maliciousProperty = 'evil';
      }).toThrow();
    });

    test('frozen electron.app throws when attempting mutation', () => {
      expect(() => {
        electronMock.app.maliciousMethod = jest.fn();
      }).toThrow();
    });

    test('frozen electron.ipcMain throws when attempting mutation', () => {
      expect(() => {
        electronMock.ipcMain.maliciousMethod = jest.fn();
      }).toThrow();
    });

    test('frozen electron.ipcRenderer throws when attempting mutation', () => {
      expect(() => {
        electronMock.ipcRenderer.maliciousMethod = jest.fn();
      }).toThrow();
    });

    test('frozen electron.dialog throws when attempting mutation', () => {
      expect(() => {
        electronMock.dialog.maliciousMethod = jest.fn();
      }).toThrow();
    });

    test('tests must clone mocks to customize behavior', () => {
      // This demonstrates the proper way to customize frozen mocks
      const customElectron = { ...electronMock };
      const customApp = { ...electronMock.app };
      
      // This should work fine
      customElectron.testProperty = 'test';
      customApp.customMethod = jest.fn();
      
      expect(customElectron.testProperty).toBe('test');
      expect(customApp.customMethod).toBeDefined();
    });
  });

  describe('IPC Mock Protection', () => {
    test('frozen ipcMain mock throws when attempting to add properties', () => {
      expect(() => {
        ipcMainMock.maliciousProperty = 'evil';
      }).toThrow();
    });

    test('tests must clone ipcMain mock to customize behavior', () => {
      // This demonstrates the proper way to customize frozen mocks
      const customIpcMain = { ...ipcMainMock };
      
      // This should work fine
      customIpcMain.customMethod = jest.fn();
      
      expect(customIpcMain.customMethod).toBeDefined();
    });
  });
});
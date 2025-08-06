describe('Electron Main-Renderer Communication Integration Tests', () => {
  let mockIpcMain;
  let mockIpcRenderer;
  let mockBrowserWindow;
  let messageHandlers;
  
  beforeEach(() => {
    messageHandlers = new Map();
    
    // Mock ipcMain
    mockIpcMain = {
      handle: jest.fn((channel, handler) => {
        messageHandlers.set(channel, handler);
      }),
      on: jest.fn((channel, handler) => {
        messageHandlers.set(channel, handler);
      }),
      removeAllListeners: jest.fn()
    };
    
    // Mock ipcRenderer (simulates preload script exposure)
    mockIpcRenderer = {
      invoke: jest.fn(async (channel, ...args) => {
        const handler = messageHandlers.get(channel);
        if (handler) {
          return await handler({}, ...args);
        }
        throw new Error(`No handler for channel: ${channel}`);
      }),
      send: jest.fn((channel, ...args) => {
        const handler = messageHandlers.get(channel);
        if (handler) {
          handler({}, ...args);
        }
      }),
      on: jest.fn()
    };
    
    // Mock BrowserWindow
    mockBrowserWindow = {
      webContents: {
        send: jest.fn((channel, ...args) => {
          // Simulate message reaching renderer
          const handler = messageHandlers.get(`renderer:${channel}`);
          if (handler) {
            handler(...args);
          }
        })
      }
    };
  });

  describe('Settings Management Communication', () => {
    test('gets settings from main process', async () => {
      const mockSettings = {
        GROQ_API_KEY: 'test-key',
        model: 'llama-3.3-70b-versatile',
        theme: 'dark'
      };

      // Setup main process handler
      mockIpcMain.handle('get-settings', () => mockSettings);

      // Simulate renderer request
      const result = await mockIpcRenderer.invoke('get-settings');
      
      expect(result).toEqual(mockSettings);
      expect(mockIpcMain.handle).toHaveBeenCalledWith('get-settings', expect.any(Function));
    });

    test('saves settings to main process', async () => {
      let savedSettings = null;
      
      // Setup main process handler
      mockIpcMain.handle('save-settings', (event, settings) => {
        savedSettings = settings;
        return { success: true };
      });

      const newSettings = {
        GROQ_API_KEY: 'new-key',
        model: 'new-model',
        theme: 'light'
      };

      // Simulate renderer request
      const result = await mockIpcRenderer.invoke('save-settings', newSettings);
      
      expect(result.success).toBe(true);
      expect(savedSettings).toEqual(newSettings);
    });

    test('handles settings validation errors', async () => {
      // Setup main process handler with validation
      mockIpcMain.handle('save-settings', (event, settings) => {
        if (!settings.GROQ_API_KEY) {
          throw new Error('API key is required');
        }
        return { success: true };
      });

      // Simulate renderer request with invalid settings
      await expect(
        mockIpcRenderer.invoke('save-settings', { model: 'test' })
      ).rejects.toThrow('API key is required');
    });
  });

  describe('Chat Message Communication', () => {
    test('sends chat message from renderer to main', async () => {
      let receivedMessage = null;
      
      // Setup main process handler
      mockIpcMain.handle('send-chat-message', async (event, message, images = []) => {
        receivedMessage = { message, images };
        
        // Simulate AI response
        return {
          role: 'assistant',
          content: `Response to: ${message}`,
          timestamp: Date.now()
        };
      });

      const testMessage = 'Hello, how are you?';
      const result = await mockIpcRenderer.invoke('send-chat-message', testMessage);
      
      expect(receivedMessage.message).toBe(testMessage);
      expect(result.role).toBe('assistant');
      expect(result.content).toContain('Response to');
    });

    test('handles streaming responses', async () => {
      const streamChunks = [];
      
      // Setup renderer handler for stream chunks
      messageHandlers.set('renderer:chat-stream', (chunk) => {
        streamChunks.push(chunk);
      });

      // Setup main process handler that sends streaming data
      mockIpcMain.handle('send-chat-message-stream', async (event, message) => {
        const chunks = ['Hello', ' ', 'World', '!'];
        
        for (const chunk of chunks) {
          mockBrowserWindow.webContents.send('chat-stream', {
            type: 'chunk',
            content: chunk
          });
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        
        mockBrowserWindow.webContents.send('chat-stream', {
          type: 'end'
        });
        
        return { success: true };
      });

      await mockIpcRenderer.invoke('send-chat-message-stream', 'Test message');
      
      expect(streamChunks.length).toBe(5); // 4 chunks + end marker
      expect(streamChunks[0].content).toBe('Hello');
      expect(streamChunks[4].type).toBe('end');
    });

    test('handles chat errors', async () => {
      // Setup main process handler that throws error
      mockIpcMain.handle('send-chat-message', async (event, message) => {
        throw new Error('API rate limit exceeded');
      });

      await expect(
        mockIpcRenderer.invoke('send-chat-message', 'Test message')
      ).rejects.toThrow('API rate limit exceeded');
    });
  });

  describe('MCP Tool Communication', () => {
    test('lists available MCP tools', async () => {
      const mockTools = [
        { name: 'file_search', description: 'Search files' },
        { name: 'web_browser', description: 'Browse web' }
      ];

      mockIpcMain.handle('get-mcp-tools', () => mockTools);

      const result = await mockIpcRenderer.invoke('get-mcp-tools');
      
      expect(result).toEqual(mockTools);
      expect(result.length).toBe(2);
    });

    test('executes MCP tool calls', async () => {
      let executedTool = null;
      
      mockIpcMain.handle('execute-mcp-tool', async (event, toolCall) => {
        executedTool = toolCall;
        
        return {
          success: true,
          output: `Executed ${toolCall.function.name} with args: ${toolCall.function.arguments}`
        };
      });

      const toolCall = {
        function: {
          name: 'file_search',
          arguments: '{"query": "test.js"}'
        }
      };

      const result = await mockIpcRenderer.invoke('execute-mcp-tool', toolCall);
      
      expect(executedTool).toEqual(toolCall);
      expect(result.success).toBe(true);
      expect(result.output).toContain('file_search');
    });

    test('handles tool execution errors', async () => {
      mockIpcMain.handle('execute-mcp-tool', async (event, toolCall) => {
        throw new Error('Tool execution failed');
      });

      const toolCall = {
        function: { name: 'invalid_tool', arguments: '{}' }
      };

      await expect(
        mockIpcRenderer.invoke('execute-mcp-tool', toolCall)
      ).rejects.toThrow('Tool execution failed');
    });
  });

  describe('File Operations Communication', () => {
    test('handles file selection dialog', async () => {
      const mockFilePaths = ['/path/to/file1.txt', '/path/to/file2.pdf'];
      
      mockIpcMain.handle('show-open-dialog', async (event, options) => {
        return {
          canceled: false,
          filePaths: mockFilePaths
        };
      });

      const result = await mockIpcRenderer.invoke('show-open-dialog', {
        properties: ['openFile', 'multiSelections']
      });
      
      expect(result.canceled).toBe(false);
      expect(result.filePaths).toEqual(mockFilePaths);
    });

    test('handles file save dialog', async () => {
      const mockFilePath = '/path/to/saved-file.txt';
      
      mockIpcMain.handle('show-save-dialog', async (event, options) => {
        return {
          canceled: false,
          filePath: mockFilePath
        };
      });

      const result = await mockIpcRenderer.invoke('show-save-dialog', {
        defaultPath: 'export.txt'
      });
      
      expect(result.canceled).toBe(false);
      expect(result.filePath).toBe(mockFilePath);
    });

    test('handles file read operations', async () => {
      const mockFileContent = 'File content here';
      
      mockIpcMain.handle('read-file', async (event, filePath) => {
        if (filePath === '/valid/path.txt') {
          return mockFileContent;
        }
        throw new Error('File not found');
      });

      const content = await mockIpcRenderer.invoke('read-file', '/valid/path.txt');
      expect(content).toBe(mockFileContent);

      await expect(
        mockIpcRenderer.invoke('read-file', '/invalid/path.txt')
      ).rejects.toThrow('File not found');
    });
  });

  describe('Window Management Communication', () => {
    test('handles window visibility changes', async () => {
      let windowVisible = true;
      
      // Setup renderer handler for visibility changes
      messageHandlers.set('renderer:window-visibility-changed', (visible) => {
        windowVisible = visible;
      });

      // Simulate main process sending visibility change
      mockBrowserWindow.webContents.send('window-visibility-changed', false);
      
      expect(windowVisible).toBe(false);
    });

    test('handles window focus events', async () => {
      let windowFocused = false;
      
      messageHandlers.set('renderer:window-focus-changed', (focused) => {
        windowFocused = focused;
      });

      mockBrowserWindow.webContents.send('window-focus-changed', true);
      
      expect(windowFocused).toBe(true);
    });

    test('requests window operations from renderer', async () => {
      const operations = [];
      
      mockIpcMain.handle('window-minimize', () => {
        operations.push('minimize');
        return { success: true };
      });

      mockIpcMain.handle('window-maximize', () => {
        operations.push('maximize');
        return { success: true };
      });

      mockIpcMain.handle('window-close', () => {
        operations.push('close');
        return { success: true };
      });

      await mockIpcRenderer.invoke('window-minimize');
      await mockIpcRenderer.invoke('window-maximize');
      await mockIpcRenderer.invoke('window-close');
      
      expect(operations).toEqual(['minimize', 'maximize', 'close']);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('handles channel not found errors', async () => {
      await expect(
        mockIpcRenderer.invoke('non-existent-channel')
      ).rejects.toThrow('No handler for channel: non-existent-channel');
    });

    test('handles async handler errors', async () => {
      mockIpcMain.handle('async-error', async () => {
        throw new Error('Async handler error');
      });

      await expect(
        mockIpcRenderer.invoke('async-error')
      ).rejects.toThrow('Async handler error');
    });

    test('handles large data transmission', async () => {
      const largeData = 'x'.repeat(1000000); // 1MB of data
      
      mockIpcMain.handle('large-data', (event, data) => {
        return { received: data.length };
      });

      const result = await mockIpcRenderer.invoke('large-data', largeData);
      
      expect(result.received).toBe(1000000);
    });

    test('handles rapid sequential messages', async () => {
      const results = [];
      
      mockIpcMain.handle('rapid-message', async (event, id) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return { processed: id };
      });

      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(mockIpcRenderer.invoke('rapid-message', i));
      }

      const responses = await Promise.all(promises);
      
      expect(responses.length).toBe(10);
      responses.forEach((response, index) => {
        expect(response.processed).toBe(index);
      });
    });
  });

  describe('Context Menu Communication', () => {
    test('shows context menu from renderer', async () => {
      let shownMenu = null;
      
      mockIpcMain.handle('show-context-menu', (event, menuItems) => {
        shownMenu = menuItems;
        return { clicked: 'copy' };
      });

      const menuItems = [
        { label: 'Copy', id: 'copy' },
        { label: 'Paste', id: 'paste' },
        { type: 'separator' },
        { label: 'Select All', id: 'select-all' }
      ];

      const result = await mockIpcRenderer.invoke('show-context-menu', menuItems);
      
      expect(shownMenu).toEqual(menuItems);
      expect(result.clicked).toBe('copy');
    });
  });

  describe('Theme Management Communication', () => {
    test('syncs theme changes between main and renderer', async () => {
      let currentTheme = 'light';
      
      // Setup handlers for theme management
      mockIpcMain.handle('get-theme', () => currentTheme);
      mockIpcMain.handle('set-theme', (event, theme) => {
        currentTheme = theme;
        // Broadcast to all windows
        mockBrowserWindow.webContents.send('theme-changed', theme);
        return { success: true };
      });

      messageHandlers.set('renderer:theme-changed', (theme) => {
        currentTheme = theme;
      });

      // Test getting current theme
      let theme = await mockIpcRenderer.invoke('get-theme');
      expect(theme).toBe('light');

      // Test setting new theme
      const result = await mockIpcRenderer.invoke('set-theme', 'dark');
      expect(result.success).toBe(true);
      expect(currentTheme).toBe('dark');
    });
  });
});
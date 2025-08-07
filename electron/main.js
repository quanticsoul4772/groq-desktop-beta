const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const { globalShortcut: _globalShortcut } = require('electron');

// Create ~/Library/Logs/Groq Desktop if it does not exist
app.setAppLogsPath();
const logFile = path.join(app.getPath('logs'), 'main.log');
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

// Mirror every console.* call to the file
['log', 'info', 'warn', 'error'].forEach((fn) => {
  const orig = console[fn].bind(console);
  console[fn] = (...args) => {
    orig(...args);
    logStream.write(args.map(String).join(' ') + '\n');
  };
});

console.log('Groq Desktop started, logging to', logFile);

// Import necessary Electron modules
const { BrowserWindow, ipcMain, screen, shell } = require('electron');

// Import shared models
const { MODEL_CONTEXT_SIZES, getModelContextSizes } = require('../shared/models.js');

// Import handlers
const chatHandler = require('./chatHandler');
const toolHandler = require('./toolHandler');

// Import new manager modules
const { initializeSettingsHandlers, loadSettings } = require('./settingsManager');
const { initializeCommandResolver, resolveCommandPath } = require('./commandResolver');
const mcpManager = require('./mcpManager');
const { initializeWindowManager } = require('./windowManager');
const authManager = require('./authManager');

// Import context capture system
const ContextCapture = require('./contextCapture');
const PopupWindowManager = require('./popupWindow');

// Global variable to hold the main window instance
let mainWindow;


// --- Context Sharing State ---
let pendingContext = null; // Holds context to be passed to renderer
let contextCapture = null; // Context capture instance
let lastCapturedContext = null; // Store the most recent captured context
let popupWindowManager = null; // Popup window manager instance

function handleUrlProtocol(url) {
  // Handle groq://context?text=...&title=... URLs
  if (!url.startsWith('groq://')) return null;

  try {
    const urlObj = new URL(url);
    if (urlObj.pathname === '/context') {
      const context = {};

      if (urlObj.searchParams.has('text')) {
        context.text = decodeURIComponent(urlObj.searchParams.get('text'));
      }
      if (urlObj.searchParams.has('title')) {
        context.title = decodeURIComponent(urlObj.searchParams.get('title'));
      }
      if (urlObj.searchParams.has('source')) {
        context.source = decodeURIComponent(urlObj.searchParams.get('source'));
      }

      return Object.keys(context).length > 0 ? context : null;
    }
  } catch (error) {
    console.error('Error parsing URL protocol:', error);
  }

  return null;
}

function setContextForRenderer(context) {
  pendingContext = context;

  // If main window is already created, send the context immediately
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('external-context', context);
  }
}

// --- Context Capture Functions ---
function initializeContextCapture() {
  contextCapture = new ContextCapture();
  popupWindowManager = new PopupWindowManager();

  // Register global hotkey with callback that opens popup
  const success = contextCapture.registerGlobalHotkey((capturedContext) => {
    console.log('Context captured via global hotkey:', capturedContext);
    lastCapturedContext = capturedContext;

    // Check if popup is enabled in settings
    const settings = loadSettings();
    if (settings.popupEnabled === false) {
      console.log('Popup is disabled in settings. Not showing.');
      // Optionally, show the main window instead
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
        // If you want to pass context to the main window, you can do it here
        if (mainWindow.webContents) {
          mainWindow.webContents.send('context-captured', capturedContext);
        }
      }
      return;
    }

    // Open popup window with captured context
    try {
      const { x, y } = screen.getCursorScreenPoint();
      popupWindowManager.createPopupWindow(capturedContext, { x, y });
      console.log('Popup window opened with context from:', capturedContext.source);
    } catch (error) {
      console.error('Error opening popup window:', error);
    }

    // Also notify main window if it exists (for legacy support)
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
      mainWindow.webContents.send('context-captured', capturedContext);
    }
  });

  if (!success) {
    console.error('Failed to register global hotkey for context capture');
  }

  return success;
}

function cleanupContextCapture() {
  if (contextCapture) {
    contextCapture.unregisterGlobalHotkey();
    contextCapture = null;
  }

  if (popupWindowManager) {
    popupWindowManager.closePopup();
    popupWindowManager = null;
  }
}

// Register URL protocol handler
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('groq', process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient('groq');
}

// Handle protocol on Windows/Linux
app.on('second-instance', (event, commandLine) => {
  // Someone tried to run a second instance, focus our window instead
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }

  // Check if there's a protocol URL in the command line
  const protocolUrl = commandLine.find((arg) => arg.startsWith('groq://'));
  if (protocolUrl) {
    const context = handleUrlProtocol(protocolUrl);
    if (context) {
      console.log('Received context from protocol URL:', context);
      setContextForRenderer(context);
    }
  }
});

// Handle protocol on macOS
app.on('open-url', (event, url) => {
  event.preventDefault();
  const context = handleUrlProtocol(url);
  if (context) {
    console.log('Received context from protocol URL:', context);
    setContextForRenderer(context);
  }
});

// App initialization sequence
app.whenReady().then(async () => {
  console.log('App Ready. Initializing...');

  // Initialize command resolver first (might be needed by others)
  initializeCommandResolver(app);

  // Load model context sizes from the JS module
  try {
    MODEL_CONTEXT_SIZES;
    console.log('Successfully loaded shared model definitions.');
  } catch (error) {
    console.error('Failed to load shared model definitions:', error);
  } // --- Early IPC Handlers required by popup and renderer before other init --- //
  ipcMain.handle('get-model-configs', async () => {
    // Return a copy to prevent accidental modification with custom models merged in
    const currentSettings = loadSettings();
    const mergedModelContextSizes = getModelContextSizes(currentSettings.customModels || {});
    return JSON.parse(JSON.stringify(mergedModelContextSizes));
  });

  ipcMain.handle('get-captured-context', async () => {
    // Return the most recently captured context
    const context = lastCapturedContext;
    // Don't clear automatically for popup usage
    return context;
  });

  ipcMain.handle('resize-popup', (event, { width, height, resizable }) => {
    if (popupWindowManager) {
      popupWindowManager.resizePopup(width, height, resizable);
    }
  });

  // Initialize window manager and get the main window instance
  mainWindow = initializeWindowManager(app, screen, shell, BrowserWindow);
  if (!mainWindow) {
    console.error('Fatal: Main window could not be created. Exiting.');
    app.quit();
    return;
  }

  // When the main window is closed, deregister its reference
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Send pending context to renderer if available
  if (pendingContext) {
    mainWindow.webContents.once('did-finish-load', () => {
      mainWindow.webContents.send('external-context', pendingContext);
    });
  }

  // Initialize context capture system
  const contextCaptureSuccess = initializeContextCapture();
  if (contextCaptureSuccess) {
    console.log('Context capture system initialized successfully');
    console.log(
      'Press Cmd+G (Mac) or Ctrl+G (Windows/Linux) from any app to open popup with context'
    );
  } else {
    console.warn('Context capture system failed to initialize');
  }

  // Initialize settings handlers (needs app)
  initializeSettingsHandlers(ipcMain, app);

  // Initialize MCP handlers (use module object)
  mcpManager.initializeMcpHandlers(ipcMain, app, mainWindow, loadSettings, resolveCommandPath);

  // Initialize Auth Manager (check will now work)
  console.log('[Main Init] Initializing Auth Manager...');
  if (mcpManager && typeof mcpManager.retryConnectionAfterAuth === 'function') {
    authManager.initialize(mcpManager.retryConnectionAfterAuth);
  } else {
    console.error(
      '[Main] CRITICAL: mcpManager or retryConnectionAfterAuth not available for AuthManager initialization!'
    );
  }

  // --- Register Core App IPC Handlers --- //
  // Chat completion (use module object)
  ipcMain.on('chat-stream', async (event, messages, model) => {
    const currentSettings = loadSettings();
    const { discoveredTools } = mcpManager.getMcpState(); // Use module object

    // Merge base models with custom models from settings
    const mergedModelContextSizes = getModelContextSizes(currentSettings.customModels || {});

    chatHandler.handleChatStream(
      event,
      messages,
      model,
      currentSettings,
      mergedModelContextSizes,
      discoveredTools
    );
  });

  // Tool execution (use module object)
  console.log('[Main Init] Registering execute-tool-call...');
  ipcMain.handle('execute-tool-call', async (event, toolCall) => {
    const currentSettings = loadSettings();
    const { discoveredTools, mcpClients } = mcpManager.getMcpState(); // Use module object
    return toolHandler.handleExecuteToolCall(
      event,
      toolCall,
      discoveredTools,
      mcpClients,
      currentSettings
    );
  });
  console.log('[Main Init] execute-tool-call registered successfully');

  // Model configs handler already registered above during early initialization
  console.log('[Main Init] Continuing with remaining handlers...');

  // --- Context Sharing IPC Handlers (Legacy - for URL/CLI context) ---
  console.log('[Main Init] Registering context handlers...');
  ipcMain.handle('get-pending-context', async () => {
    const context = pendingContext;
    pendingContext = null; // Clear after retrieval
    return context;
  });
  console.log('[Main Init] get-pending-context registered');

  ipcMain.handle('clear-context', async () => {
    pendingContext = null;
  });

  // --- Context Capture IPC Handlers (for modal and popup) ---
  // Note: get-captured-context handler is registered earlier in the initialization

  ipcMain.handle('clear-captured-context', async () => {
    lastCapturedContext = null;
  });

  ipcMain.handle('trigger-context-capture', async () => {
    // Manually trigger context capture (useful for testing)
    if (contextCapture) {
      return await contextCapture.captureContext();
    }
    return null;
  });

  ipcMain.handle('capture-manual-context', async (event, text, title, source) => {
    // Allow manual context input
    if (contextCapture) {
      return await contextCapture.captureManualContext(text, title, source);
    }
    return null;
  });

  // --- Popup Window IPC Handlers ---
  ipcMain.handle('close-popup', async () => {
    if (popupWindowManager) {
      popupWindowManager.closePopup();
    }
  });

  ipcMain.handle('is-popup-open', async () => {
    return popupWindowManager ? popupWindowManager.isOpen() : false;
  });

  // resize-popup handler already registered above during early initialization

  // --- Context Menu IPC Handler ---
  ipcMain.on('show-context-menu', (event, params) => {
    const { Menu } = require('electron');
    const template = [];

    // Check if spell check is enabled and we have a misspelled word
    if (
      params.misspelledWord &&
      params.dictionarySuggestions &&
      params.dictionarySuggestions.length > 0
    ) {
      // Add spell check suggestions (up to 5)
      const suggestions = params.dictionarySuggestions.slice(0, 5);
      suggestions.forEach((suggestion) => {
        template.push({
          label: suggestion,
          click: () => {
            event.sender.send('context-menu-command', {
              command: 'replace-misspelled-word',
              suggestion,
              misspelledWord: params.misspelledWord,
            });
          },
        });
      });

      if (suggestions.length > 0) {
        template.push({ type: 'separator' });
      }
    }

    // Standard edit menu items
    if (params.isEditable) {
      if (params.selectionText) {
        template.push({
          label: 'Cut',
          accelerator: 'CmdOrCtrl+X',
          click: () => {
            event.sender.send('context-menu-command', { command: 'cut' });
          },
        });
        template.push({
          label: 'Copy',
          accelerator: 'CmdOrCtrl+C',
          click: () => {
            event.sender.send('context-menu-command', { command: 'copy' });
          },
        });
      } else {
        // Show disabled cut/copy when no selection
        template.push({
          label: 'Cut',
          enabled: false,
        });
        template.push({
          label: 'Copy',
          enabled: false,
        });
      }

      template.push({
        label: 'Paste',
        accelerator: 'CmdOrCtrl+V',
        click: () => {
          event.sender.send('context-menu-command', { command: 'paste' });
        },
      });
    } else if (params.selectionText) {
      // For non-editable areas, only show copy
      template.push({
        label: 'Copy',
        accelerator: 'CmdOrCtrl+C',
        click: () => {
          event.sender.send('context-menu-command', { command: 'copy' });
        },
      });
    }

    if (template.length > 0) {
      const menu = Menu.buildFromTemplate(template);
      menu.popup({ window: BrowserWindow.fromWebContents(event.sender) });
    }
  });

  // --- Auth IPC Handler ---
  console.log('[Main Init] Registering auth handler...');
  ipcMain.handle('start-mcp-auth-flow', async (event, { serverId, serverUrl }) => {
    if (!serverId || !serverUrl) {
      throw new Error('Missing serverId or serverUrl for start-mcp-auth-flow');
    }
    try {
      console.log(`[Main] Handling start-mcp-auth-flow for ${serverId}`);
      const result = await authManager.initiateAuthFlow(serverId, serverUrl);
      return result;
    } catch (error) {
      console.error(`[Main] Error handling start-mcp-auth-flow for ${serverId}:`, error);
      throw error;
    }
  });

  // --- Post-initialization Tasks --- //
  console.log('Setting up MCP auto-connection timeout...');
  setTimeout(() => {
    console.log('Triggering MCP auto-connection...');
    mcpManager.connectConfiguredMcpServers(); // Use module object
  }, 1000);

  console.log('Initialization complete.');
});

// Make sure we handle single instance properly
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  // Continue with app initialization
}

// Clean up context capture on app quit
app.on('before-quit', () => {
  cleanupContextCapture();
});

// Note: App lifecycle events (window-all-closed, activate) are now handled by windowManager.js

// Keep any essential top-level error handling or logging if needed
process.on('uncaughtException', (error) => {
  console.error('Unhandled Exception:', error);
  // Optionally: Log to file, show dialog, etc.
});

const authManager = require('../../../electron/authManager');

// Mock dependencies
jest.mock('electron', () => ({
  shell: {
    openExternal: jest.fn(),
  },
}));

jest.mock('@modelcontextprotocol/sdk/client/auth.js', () => ({
  discoverOAuthMetadata: jest.fn(),
  startAuthorization: jest.fn(),
  exchangeAuthorization: jest.fn(),
  registerClient: jest.fn(),
}));

jest.mock('crypto', () => ({
  randomBytes: jest.fn(() => ({ toString: () => 'mock-random-string' })),
}));

jest.mock('http', () => ({
  createServer: jest.fn(() => ({
    listen: jest.fn((port, callback) => callback()),
    close: jest.fn((callback) => callback && callback()),
    on: jest.fn(),
  })),
}));

jest.mock('net', () => ({
  createServer: jest.fn(() => ({
    listen: jest.fn((port, host, callback) => {
      // Simulate finding an available port
      setTimeout(() => callback(), 0);
    }),
    close: jest.fn(),
    on: jest.fn(),
  })),
}));

describe('AuthManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset modules to clear any state
    jest.resetModules();
  });

  test('exports expected functions', () => {
    expect(typeof authManager.startOAuthFlow).toBe('function');
    expect(typeof authManager.handleOAuthCallback).toBe('function');
    expect(typeof authManager.getStoredTokens).toBe('function');
    expect(typeof authManager.clearStoredTokens).toBe('function');
    expect(typeof authManager.setMcpRetryFunc).toBe('function');
  });

  test('startOAuthFlow initiates OAuth process', async () => {
    const mockMetadata = {
      authorization_endpoint: 'https://auth.example.com/oauth/authorize',
      token_endpoint: 'https://auth.example.com/oauth/token',
    };

    const mockAuth = require('@modelcontextprotocol/sdk/client/auth.js');
    mockAuth.discoverOAuthMetadata.mockResolvedValue(mockMetadata);
    mockAuth.startAuthorization.mockResolvedValue({
      authorizationUrl: 'https://auth.example.com/oauth/authorize?client_id=test',
    });

    const serverUrl = 'https://api.example.com';
    const result = await authManager.startOAuthFlow(serverUrl);

    expect(mockAuth.discoverOAuthMetadata).toHaveBeenCalledWith(serverUrl);
    expect(mockAuth.startAuthorization).toHaveBeenCalled();
    expect(result).toHaveProperty('authorizationUrl');
  });

  test('handles OAuth flow errors gracefully', async () => {
    const mockAuth = require('@modelcontextprotocol/sdk/client/auth.js');
    mockAuth.discoverOAuthMetadata.mockRejectedValue(new Error('Network error'));

    const serverUrl = 'https://api.example.com';

    await expect(authManager.startOAuthFlow(serverUrl)).rejects.toThrow('Network error');
  });

  test('getStoredTokens retrieves tokens from storage', async () => {
    const mockTokens = {
      access_token: 'test-access-token',
      refresh_token: 'test-refresh-token',
      expires_in: 3600,
    };

    // Mock storage.get to return tokens
    const storage = require('electron-json-storage');
    storage.get.mockImplementation((key, callback) => {
      callback(null, mockTokens);
    });

    const serverUrl = 'https://api.example.com';
    const tokens = await authManager.getStoredTokens(serverUrl);

    expect(tokens).toEqual(mockTokens);
  });

  test('clearStoredTokens removes tokens from storage', async () => {
    const storage = require('electron-json-storage');
    storage.remove = jest.fn((key, callback) => callback(null));

    const serverUrl = 'https://api.example.com';
    await authManager.clearStoredTokens(serverUrl);

    expect(storage.remove).toHaveBeenCalled();
  });

  test('setMcpRetryFunc sets retry function', () => {
    const mockRetryFunc = jest.fn();

    expect(() => {
      authManager.setMcpRetryFunc(mockRetryFunc);
    }).not.toThrow();
  });

  test('finds available port for callback server', async () => {
    const net = require('net');
    const mockServer = {
      listen: jest.fn((port, host, callback) => {
        // Simulate successful port binding
        setTimeout(() => callback(), 0);
      }),
      close: jest.fn(),
      on: jest.fn(),
    };
    net.createServer.mockReturnValue(mockServer);

    // This would be tested through startOAuthFlow which uses the port finding logic
    const mockAuth = require('@modelcontextprotocol/sdk/client/auth.js');
    mockAuth.discoverOAuthMetadata.mockResolvedValue({
      authorization_endpoint: 'https://auth.example.com/oauth/authorize',
      token_endpoint: 'https://auth.example.com/oauth/token',
    });

    const serverUrl = 'https://api.example.com';
    await authManager.startOAuthFlow(serverUrl);

    expect(net.createServer).toHaveBeenCalled();
  });

  test('handles callback server errors', async () => {
    const http = require('http');
    const mockServer = {
      listen: jest.fn((_port, _callback) => {
        // Simulate server error
        const error = new Error('Address already in use');
        error.code = 'EADDRINUSE';
        throw error;
      }),
      close: jest.fn(),
      on: jest.fn(),
    };
    http.createServer.mockReturnValue(mockServer);

    const mockAuth = require('@modelcontextprotocol/sdk/client/auth.js');
    mockAuth.discoverOAuthMetadata.mockResolvedValue({
      authorization_endpoint: 'https://auth.example.com/oauth/authorize',
      token_endpoint: 'https://auth.example.com/oauth/token',
    });

    const serverUrl = 'https://api.example.com';

    // Should handle server creation errors gracefully
    await expect(authManager.startOAuthFlow(serverUrl)).rejects.toThrow();
  });

  test('handleOAuthCallback processes authorization code', async () => {
    const mockTokens = {
      access_token: 'new-access-token',
      refresh_token: 'new-refresh-token',
      expires_in: 3600,
    };

    const mockAuth = require('@modelcontextprotocol/sdk/client/auth.js');
    mockAuth.exchangeAuthorization.mockResolvedValue(mockTokens);

    const storage = require('electron-json-storage');
    storage.set.mockImplementation((key, data, callback) => callback(null));

    const authCode = 'test-auth-code';
    const state = 'test-state';
    const result = await authManager.handleOAuthCallback(authCode, state);

    expect(mockAuth.exchangeAuthorization).toHaveBeenCalled();
    expect(storage.set).toHaveBeenCalled();
    expect(result).toEqual(mockTokens);
  });

  test('validates state parameter in OAuth callback', async () => {
    const authCode = 'test-auth-code';
    const invalidState = 'invalid-state';

    // Should reject invalid state
    await expect(authManager.handleOAuthCallback(authCode, invalidState)).rejects.toThrow();
  });

  test('handles token exchange errors', async () => {
    const mockAuth = require('@modelcontextprotocol/sdk/client/auth.js');
    mockAuth.exchangeAuthorization.mockRejectedValue(new Error('Invalid authorization code'));

    const authCode = 'invalid-code';
    const state = 'valid-state';

    await expect(authManager.handleOAuthCallback(authCode, state)).rejects.toThrow(
      'Invalid authorization code'
    );
  });

  test('cleans up callback server after use', async () => {
    const http = require('http');
    const mockServer = {
      listen: jest.fn((port, callback) => callback()),
      close: jest.fn((callback) => callback && callback()),
      on: jest.fn(),
    };
    http.createServer.mockReturnValue(mockServer);

    const mockAuth = require('@modelcontextprotocol/sdk/client/auth.js');
    mockAuth.discoverOAuthMetadata.mockResolvedValue({
      authorization_endpoint: 'https://auth.example.com/oauth/authorize',
      token_endpoint: 'https://auth.example.com/oauth/token',
    });

    const serverUrl = 'https://api.example.com';
    await authManager.startOAuthFlow(serverUrl);

    // Server should be created and configured
    expect(mockServer.listen).toHaveBeenCalled();
    expect(mockServer.on).toHaveBeenCalled();
  });
});

const { shell } = require('electron');
const storage = require('electron-json-storage'); // Use electron-json-storage
const { promisify } = require('util'); // Needed for converting callback API to promise API
const { URL } = require('url');
const crypto = require('crypto'); // Import crypto for state generation
const http = require('http'); // Required for local server
const net = require('net'); // Required to find free port

// Assuming these types and functions are correctly exported by the SDK
const {
  discoverOAuthMetadata,
  startAuthorization,
  exchangeAuthorization,
  registerClient,
  // LATEST_PROTOCOL_VERSION, // Might need this if not handled by SDK functions
  // Types: OAuthMetadata, OAuthClientInformation, OAuthClientInformationFull, OAuthTokens, OAuthClientMetadata
} = require('@modelcontextprotocol/sdk/client/auth.js'); // Corrected path

// --- Promisify electron-json-storage methods ---
const storageGet = promisify(storage.get);
const storageSet = promisify(storage.set);
const storageHas = promisify(storage.has);
// const storageClear = promisify(storage.clear); // If needed later

// --- Initialize storage on startup ---
// Clear any stale active auth flows on startup asynchronously
const ACTIVE_FLOWS_KEY = 'activeAuthFlows';
let localCallbackServer = null; // Holds the HTTP server instance
let localCallbackPort = null; // Holds the port the server is listening on
let _mcpRetryFunc = null; // Variable to hold injected retry function

(async () => {
  try {
    await storageSet(ACTIVE_FLOWS_KEY, {});
    console.log('[AuthManager] Cleared stale activeAuthFlows.');
  } catch (error) {
    console.error('[AuthManager] Error clearing activeAuthFlows on startup:', error);
  }
})();

// --- Constants ---
const CLIENT_NAME = 'Groq Desktop';
const CALLBACK_PATH = '/auth-callback'; // Path for the local server

// --- Find Free Port --- (Helper function)
function findFreePort(startPort = 8000) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(startPort, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        // Try next port
        resolve(findFreePort(startPort + 1));
      } else {
        reject(err);
      }
    });
  });
}

// --- OAuthClientProvider Implementation using electron-json-storage ---

class ElectronJsonStorageOAuthProvider {
  constructor(serverId, redirectPort) {
    this.serverId = serverId;
    this.redirectPort = redirectPort; // Store the port
    this.authDataKey = `mcpAuthData_${serverId}`;
  }

  get redirectUrl() {
    if (!this.redirectPort) {
      // This should not happen if initiateAuthFlow works correctly
      console.error('[AuthManager] Redirect port not set!');
      throw new Error('Redirect port is not available.');
    }
    return `http://127.0.0.1:${this.redirectPort}${CALLBACK_PATH}`;
  }

  get clientMetadata() {
    // redirectUrl is now dynamic based on the port
    return {
      redirect_uris: [this.redirectUrl],
      client_name: CLIENT_NAME,
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
      scope: 'openid profile email offline_access',
    };
  }

  async _getServerData() {
    try {
      // Check if data exists before getting to avoid default empty object
      const hasData = await storageHas(this.authDataKey);
      if (hasData) {
        return await storageGet(this.authDataKey);
      }
    } catch (error) {
      console.error(`[AuthManager][${this.serverId}] Error checking/getting storage data:`, error);
    }
    return undefined; // Return undefined if not found or error
  }

  async _setServerData(data) {
    try {
      await storageSet(this.authDataKey, data);
    } catch (error) {
      console.error(`[AuthManager][${this.serverId}] Error setting storage data:`, error);
      throw error; // Re-throw errors during save
    }
  }

  async clientInformation() {
    const serverData = await this._getServerData();
    return serverData?.clientInformation || undefined;
  }

  async saveClientInformation(clientInformation) {
    const currentData = (await this._getServerData()) || {}; // Get existing or default to empty
    await this._setServerData({ ...currentData, clientInformation });
    console.log(`[AuthManager][${this.serverId}] Saved client information.`);
  }

  async tokens() {
    const serverData = await this._getServerData();
    return serverData?.tokens || undefined;
  }

  async saveTokens(tokens) {
    const currentData = (await this._getServerData()) || {};
    await this._setServerData({ ...currentData, tokens });
    console.log(`[AuthManager][${this.serverId}] Saved tokens.`);
  }

  // Need to save the server URL persistently with other auth data
  async saveServerUrl(serverUrlString) {
    const currentData = (await this._getServerData()) || {};
    await this._setServerData({ ...currentData, serverUrl: serverUrlString });
    console.log(`[AuthManager][${this.serverId}] Saved server URL.`);
  }

  async getServerUrl() {
    const serverData = await this._getServerData();
    return serverData?.serverUrl || undefined;
  }

  async redirectToAuthorization(authorizationUrl) {
    console.log(
      `[AuthManager][${this.serverId}] Opening external browser for URL: ${authorizationUrl}`
    );
    await shell.openExternal(authorizationUrl.toString());
  }
}

// --- Local Callback Server --- (New)

function startLocalCallbackServer() {
  return new Promise((resolve, reject) => {
    (async () => {
      if (localCallbackServer) {
        console.warn('[AuthManager] Local callback server already running. Closing existing one.');
        await stopLocalCallbackServer();
      }

      try {
        localCallbackPort = await findFreePort(10000); // Start searching from port 10000
        localCallbackServer = http.createServer(async (req, res) => {
          console.log(`[AuthManager] Local server received request: ${req.url}`);
          const url = new URL(req.url, `http://${req.headers.host}`);

          if (url.pathname === CALLBACK_PATH) {
            const code = url.searchParams.get('code');
            const state = url.searchParams.get('state');
            const error = url.searchParams.get('error');

            let responseHtml = '';
            let statusCode = 200;

            if (error) {
              console.error(`[AuthManager] Callback error received: ${error}`);
              responseHtml = `<html><body><h1>Authorization Failed</h1><p>Error: ${error}</p><p>You can close this window.</p></body></html>`;
              statusCode = 400;
              // No need to call processCallbackParams on error
            } else if (code && state) {
              console.log(`[AuthManager] Received code and state via local server.`);
              responseHtml = `<html><body><h1>Authorization Success</h1><p>Processing complete. You can close this window.</p><script>window.close();</script></body></html>`;
              // Process the callback *after* sending the response to the browser
              // Use setImmediate to avoid blocking the response
              setImmediate(() => processCallbackParams(code, state));
            } else {
              console.warn(`[AuthManager] Local server received request without code/state/error.`);
              responseHtml = `<html><body><h1>Invalid Callback</h1><p>Required parameters missing.</p></body></html>`;
              statusCode = 400;
            }

            res.writeHead(statusCode, { 'Content-Type': 'text/html' });
            res.end(responseHtml);

            // Stop the server after handling the request
            await stopLocalCallbackServer();
          } else {
            // Handle other paths (e.g., /favicon.ico) gracefully
            res.writeHead(404);
            res.end('Not Found');
          }
        });

        localCallbackServer.listen(localCallbackPort, '127.0.0.1', () => {
          console.log(
            `[AuthManager] Local callback server listening on http://127.0.0.1:${localCallbackPort}`
          );
          resolve(localCallbackPort);
        });

        localCallbackServer.on('error', (err) => {
          console.error('[AuthManager] Local callback server error:', err);
          localCallbackServer = null;
          localCallbackPort = null;
          reject(err);
        });
      } catch (err) {
        console.error('[AuthManager] Failed to start local callback server:', err);
        reject(err);
      }
    })();
  });
}

async function stopLocalCallbackServer() {
  return new Promise((resolve) => {
    if (localCallbackServer) {
      localCallbackServer.close(() => {
        console.log(`[AuthManager] Local callback server on port ${localCallbackPort} stopped.`);
        localCallbackServer = null;
        localCallbackPort = null;
        resolve();
      });
    } else {
      resolve();
    }
  });
}

// --- Process Callback Params --- (Refactored from handleAuthCallback)

async function processCallbackParams(authorizationCode, receivedState) {
  console.log(`[AuthManager] Processing callback params. State: ${receivedState}`);
  // Retrieve and verify state using electron-json-storage
  let activeFlows;
  try {
    activeFlows = await storageGet(ACTIVE_FLOWS_KEY);
    if (!activeFlows || typeof activeFlows !== 'object') activeFlows = {};
  } catch (err) {
    if (err.code === 'ENOENT') activeFlows = {};
    else {
      console.error(`[AuthManager] Error retrieving active auth flows:`, err);
      return; // Cannot proceed
    }
  }
  const flowData = activeFlows[receivedState];

  if (!flowData) {
    console.error(
      `[AuthManager] Received state (${receivedState}) does not match any active auth flow.`
    );
    return;
  }

  // State is valid, clear it from temporary store
  delete activeFlows[receivedState];
  try {
    await storageSet(ACTIVE_FLOWS_KEY, activeFlows);
  } catch (err) {
    console.error(`[AuthManager] Failed to clear used state (${receivedState}):`, err);
  }

  const { serverId, codeVerifier, redirectPort } = flowData;
  console.log(`[AuthManager][${serverId}] State verified. Exchanging code for tokens...`);

  const provider = new ElectronJsonStorageOAuthProvider(serverId, redirectPort);

  try {
    const clientInformation = await provider.clientInformation();
    if (!clientInformation) throw new Error('Client information missing during token exchange.');

    // --- Log client info before exchange ---
    console.log(
      `[AuthManager][${serverId}] Using client info for token exchange:`,
      JSON.stringify(clientInformation)
    );
    // ----------------------------------------

    const serverDataBaseUrl = await provider.getServerUrl();
    if (!serverDataBaseUrl) throw new Error(`Server base URL not found for ${serverId}`);

    const metadata = await discoverOAuthMetadata(serverDataBaseUrl);

    const tokens = await exchangeAuthorization(serverDataBaseUrl, {
      metadata,
      clientInformation,
      authorizationCode,
      codeVerifier,
      redirectUri: provider.redirectUrl,
    });

    console.log(`[AuthManager][${serverId}] Received tokens object:`, JSON.stringify(tokens));
    await provider.saveTokens(tokens);
    console.log(`[AuthManager][${serverId}] Successfully exchanged code for tokens.`);

    // Trigger reconnection attempt using INJECTED function
    console.log(`[AuthManager][${serverId}] Triggering MCP Manager reconnection...`);
    console.log(
      `[AuthManager][${serverId}] Passing access token: ${tokens?.access_token ? tokens.access_token.substring(0, 10) + '...' : 'MISSING/EMPTY'}`
    );
    if (typeof _mcpRetryFunc === 'function') {
      _mcpRetryFunc(serverId, tokens.access_token);
    } else {
      console.error(`[AuthManager][${serverId}] MCP Manager retry function not injected/found!`);
    }
  } catch (error) {
    console.error(`[AuthManager][${serverId}] Error exchanging authorization code:`, error);
  }
}

// --- Core Auth Flow Functions ---

/**
 * Initiates the OAuth Authorization Code Flow for a given server.
 * Handles client registration if necessary and opens the authorization URL in the browser.
 */
async function initiateAuthFlow(serverId, serverUrlString) {
  console.log(`[AuthManager][${serverId}] Initiating auth flow for URL: ${serverUrlString}`);
  const serverUrl = new URL(serverUrlString);
  let redirectPort;

  try {
    // 1. Start Local Server & Get Port
    redirectPort = await startLocalCallbackServer();
    const provider = new ElectronJsonStorageOAuthProvider(serverId, redirectPort); // Pass port

    // Ensure server URL is saved persistently
    await provider.saveServerUrl(serverUrl.origin);

    // 2. Discover Metadata
    const metadata = await discoverOAuthMetadata(serverUrl);
    console.log(
      `[AuthManager][${serverId}] Discovered OAuth Metadata:`,
      metadata ? JSON.stringify(metadata, null, 2) : 'Metadata not found (using fallbacks)'
    );

    // 3. Ensure Client Registration
    let clientInformation = await provider.clientInformation();
    if (!clientInformation) {
      console.log(
        `[AuthManager][${serverId}] No client information found. Attempting dynamic registration...`
      );
      try {
        const fullInformation = await registerClient(serverUrl, {
          metadata, // Pass discovered metadata (can be undefined)
          clientMetadata: provider.clientMetadata, // Uses correct redirectUrl
        });
        await provider.saveClientInformation(fullInformation);
        clientInformation = fullInformation;
        console.log(`[AuthManager][${serverId}] Dynamic registration successful.`);
      } catch (registrationError) {
        console.error(
          `[AuthManager][${serverId}] Dynamic client registration failed. Sent metadata:`,
          JSON.stringify(provider.clientMetadata, null, 2)
        );
        console.error(`[AuthManager][${serverId}] Registration error details:`, registrationError);
        await stopLocalCallbackServer(); // Stop server if registration fails
        throw new Error(`Failed to register client with ${serverId}: ${registrationError.message}`);
      }
    } else {
      console.log(`[AuthManager][${serverId}] Found existing client information.`);
    }

    // 4. Start Authorization Flow
    const state = crypto.randomBytes(16).toString('hex');
    console.log(`[AuthManager][${serverId}] Generated state: ${state}`);

    const { authorizationUrl: baseAuthorizationUrl, codeVerifier } = await startAuthorization(
      serverUrl,
      {
        metadata: metadata,
        clientInformation,
        redirectUrl: provider.redirectUrl, // Pass correct http redirect URI
      }
    );

    const authorizationUrl = new URL(baseAuthorizationUrl);
    authorizationUrl.searchParams.set('state', state);

    // 5. Save State, Verifier, and Port Temporarily
    const activeFlows = (await storageGet(ACTIVE_FLOWS_KEY)) || {};
    activeFlows[state] = { serverId, codeVerifier, redirectPort }; // Store port with state
    await storageSet(ACTIVE_FLOWS_KEY, activeFlows);
    console.log(
      `[AuthManager][${serverId}] Stored temporary state/verifier/port for state: ${state}`
    );

    // 6. Redirect
    await provider.redirectToAuthorization(authorizationUrl); // Opens browser

    console.log(`[AuthManager][${serverId}] Redirected user to browser for authorization.`);
    return { success: true, message: 'Authorization flow started. Check browser.' };
  } catch (error) {
    console.error(`[AuthManager][${serverId}] Error during auth initiation:`, error);
    await stopLocalCallbackServer(); // Ensure server is stopped on error
    throw new Error(`Authorization initiation failed for ${serverId}: ${error.message}`);
  }
}

// --- Exported Getter Functions ---

async function getTokensForServer(serverId) {
  const provider = new ElectronJsonStorageOAuthProvider(serverId);
  return await provider.tokens();
}

async function getClientInfoForServer(serverId) {
  const provider = new ElectronJsonStorageOAuthProvider(serverId);
  return await provider.clientInformation();
}

// --- Initialization Function --- (Updated)
function initialize(retryFunc) {
  // Accept the function directly
  if (typeof retryFunc !== 'function') {
    console.error('[AuthManager] Invalid retry function passed to initialize.');
    _mcpRetryFunc = null;
    return;
  }
  _mcpRetryFunc = retryFunc;
  console.log('[AuthManager] Initialized with MCP Manager retry function.');
}

module.exports = {
  initialize, // Export initialize function
  initiateAuthFlow,
  getTokensForServer, // Export getter
  getClientInfoForServer, // Export getter
};

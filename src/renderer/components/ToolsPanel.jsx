import React, { useState, useEffect } from 'react';
import LogViewerModal from './LogViewerModal';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { cn } from '../lib/utils';

function ToolsPanel({ tools = [], onClose, onDisconnectServer, onReconnectServer }) {
  const [expandedTools, setExpandedTools] = useState({});
  const [configuredServers, setConfiguredServers] = useState([]);
  const [serverStatuses, setServerStatuses] = useState({});
  const [authRequiredServers, setAuthRequiredServers] = useState({});
  const [viewingLogsForServer, setViewingLogsForServer] = useState(null);
  const [actionInProgress, setActionInProgress] = useState(null);

  useEffect(() => {
    const loadConfiguredServers = async () => {
      try {
        const settings = await window.electron.getSettings();
        if (settings && settings.mcpServers) {
          const servers = Object.entries(settings.mcpServers).map(([id, config]) => {
            // Determine transport type accurately
            let transportType = 'stdio'; // Default
            if (config.transport === 'sse') {
                transportType = 'sse';
            } else if (config.transport === 'streamableHttp') {
                transportType = 'streamableHttp';
            }

            return {
              id,
              command: transportType === 'stdio' ? config.command : undefined,
              args: transportType === 'stdio' ? (config.args || []) : [],
              url: (transportType === 'sse' || transportType === 'streamableHttp') ? config.url : undefined,
              transport: transportType // Store the correct transport type
            };
          });
          setConfiguredServers(servers);

          // Determine which servers are currently connected
          const statuses = {};
          servers.forEach(server => {
            // Check if there are tools from this server
            const hasToolsFromServer = tools.some(tool => tool.serverId === server.id);
            statuses[server.id] = hasToolsFromServer ? 'connected' : 'disconnected';
          });
          setServerStatuses(statuses);
        }
      } catch (error) {
        console.error('Error loading configured servers:', error);
      }
    };
    
    loadConfiguredServers();
  }, [tools]);

  // Listener for auth reconnect completion events from main process
  useEffect(() => {
    const removeListener = window.electron.onMcpAuthReconnectComplete?.((data) => {
      console.log('Received mcp-auth-reconnect-complete:', data);
      // Clear the action in progress only if it matches the completed server
      if (data && actionInProgress === data.serverId) {
        setActionInProgress(null);
        if (!data.success) {
             // Optionally show an error toast if reconnect failed after auth
             console.error(`Auth reconnect failed for ${data.serverId}: ${data.error}`);
             // Keep server disconnected, potentially reset authRequired flag?
             // setAuthRequiredServers(prev => ({ ...prev, [data.serverId]: true }));
        } else {
            // Success state is handled by the main status update driven by notifyMcpServerStatus
            // but we should clear the authRequired flag here
            setAuthRequiredServers(prev => {
                 const newState = { ...prev };
                 delete newState[data.serverId];
                 return newState;
            });
        }
      }
    });

    // Cleanup listener on unmount
    return () => {
      if (removeListener) removeListener();
    };
  }, [actionInProgress]); // Depend on actionInProgress to ensure correct serverId check

  // Add event listener for ESC key
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && onClose) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    
    // Clean up the event listener when the component unmounts
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const toggleToolExpand = (toolName) => {
    setExpandedTools(prev => ({
      ...prev,
      [toolName]: !prev[toolName]
    }));
  };

  const handleDisconnect = async (serverId) => {
    if (!onDisconnectServer || serverStatuses[serverId] !== 'connected') return;
    
    setActionInProgress(serverId);
    try {
      const success = await onDisconnectServer(serverId);
      if (success) {
        setServerStatuses(prev => ({ ...prev, [serverId]: 'disconnected' }));
      }
    } catch (error) {
      console.error(`Error disconnecting from server ${serverId}:`, error);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleReconnect = async (serverId) => {
    if (!onReconnectServer || serverStatuses[serverId] !== 'disconnected') return;
    
    setActionInProgress(serverId);
    try {
      const result = await onReconnectServer(serverId);

      if (result && result.requiresAuth) {
        console.warn(`Authorization required for server ${serverId}.`);
        setAuthRequiredServers(prev => ({ ...prev, [serverId]: true }));
        setServerStatuses(prev => ({ ...prev, [serverId]: 'disconnected' })); // Keep disconnected
        // Optionally: show a toast/notification to the user
      } else if (result && result.success) {
        console.log(`Successfully reconnected to server ${serverId}.`);
        setAuthRequiredServers(prev => {
          const newState = { ...prev };
          delete newState[serverId];
          return newState;
        });
        setServerStatuses(prev => ({ ...prev, [serverId]: 'connected' }));
      } else {
        // Handle explicit failure or unexpected result structure
        console.error(`Failed to reconnect to server ${serverId}:`, result?.error || 'Unknown reason');
        setServerStatuses(prev => ({ ...prev, [serverId]: 'disconnected' })); // Ensure disconnected
      }
    } catch (error) {
      console.error(`Error during reconnect handler for ${serverId}:`, error);
      setServerStatuses(prev => ({ ...prev, [serverId]: 'disconnected' })); // Ensure disconnected on catch
    } finally {
      setActionInProgress(null);
    }
  };

  const handleAuthorizeServer = async (serverId) => {
    const server = configuredServers.find(s => s.id === serverId);
    if (!server || server.transport === 'stdio' || !server.url) { // Only allow for SSE with URL
        console.error("Cannot start auth flow: server config is not SSE or URL missing for", serverId);
        // Show error message to user?
        return;
    }
    console.log(`Starting authorization flow for server ${serverId} at ${server.url}...`);
    setActionInProgress(serverId); // Show loading/indicator on the button
    try {
        // Send IPC message to main process
        await window.electron.startMcpAuthFlow({ serverId: server.id, serverUrl: server.url });
        console.log(`Authorization flow initiated for ${serverId}. Please follow browser instructions.`);
        // Keep actionInProgress until user tries to reconnect or main process sends completion signal
    } catch (error) {
        console.error(`Error initiating auth flow for ${serverId}:`, error);
        // Show error message to user?
        setActionInProgress(null);
    }
  };

  // Group tools by server
  const toolsByServer = (tools || []).reduce((acc, tool) => {
    const serverId = tool.serverId || 'unknown';
    if (!acc[serverId]) {
      acc[serverId] = [];
    }
    acc[serverId].push(tool);
    return acc;
  }, {});

  // Servers with no tools (disconnected)
  const disconnectedServers = configuredServers
    .filter(server => !toolsByServer[server.id])
    .map(server => server.id);

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
      <Card className="w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="space-y-1">
            <CardTitle className="text-2xl">Available Tools</CardTitle>
            <CardDescription>
              {tools.length} tools available across {Object.keys(toolsByServer).length} connected servers
            </CardDescription>
          </div>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={onClose}
            className="shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Button>
        </CardHeader>
        
        <CardContent className="flex-1 overflow-y-auto">
          {/* Show configured servers section */}
          {configuredServers.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-4">Configured MCP Servers</h3>
              <Card className="mb-4">
                <CardContent className="p-0">
                  {configuredServers.map((server, index) => (
                    <div key={server.id} className={cn(
                      "p-4 flex justify-between items-center",
                      index !== configuredServers.length - 1 && "border-b"
                    )}>
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <span className="font-medium">{server.id}</span>
                          <Badge variant={serverStatuses[server.id] === 'connected' ? 'default' : 'secondary'}>
                            {serverStatuses[server.id] === 'connected' ? 'Connected' : 'Disconnected'}
                          </Badge>
                        </div>
                        <div className="space-y-1 text-sm text-muted-foreground">
                          {server.transport === 'sse' ? (
                            <>
                              <div><span className="font-mono">Type: SSE</span></div>
                              <div><span className="font-mono">URL: {server.url || 'N/A'}</span></div>
                            </>
                          ) : server.transport === 'streamableHttp' ? (
                            <>
                              <div><span className="font-mono">Type: Streamable HTTP</span></div>
                              <div><span className="font-mono">URL: {server.url || 'N/A'}</span></div>
                            </>
                          ) : (
                            <>
                              <div><span className="font-mono">Type: Stdio</span></div>
                              <div><span className="font-mono">Command: {server.command || 'N/A'}</span></div>
                              {server.args && server.args.length > 0 && (
                                <div><span className="font-mono">Args: {server.args.join(' ')}</span></div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {serverStatuses[server.id] === 'connected' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setViewingLogsForServer({ id: server.id, transport: server.transport })}
                            disabled={actionInProgress === server.id}
                          >
                            Logs
                          </Button>
                        )}
                        {serverStatuses[server.id] === 'connected' ? (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDisconnect(server.id)}
                            disabled={actionInProgress === server.id}
                          >
                            {actionInProgress === server.id ? 'Disconnecting...' : 'Disconnect'}
                          </Button>
                        ) : (
                          authRequiredServers[server.id] ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAuthorizeServer(server.id)}
                              disabled={actionInProgress === server.id}
                              className="border-yellow-300 text-yellow-700 hover:bg-yellow-50"
                            >
                              {actionInProgress === server.id ? 'Authorizing...' : 'Authorize'}
                            </Button>
                          ) : (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleReconnect(server.id)}
                              disabled={actionInProgress === server.id}
                            >
                              {actionInProgress === server.id ? 'Connecting...' : 'Reconnect'}
                            </Button>
                          )
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <p className="text-xs text-muted-foreground">
                These servers are automatically started when the application launches.
                You can manage them in the settings.
              </p>
            </div>
          )}
        
          {/* Available tools section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Available Tools by Server</h3>
            {Object.keys(toolsByServer).length === 0 ? (
              <Card>
                <CardContent className="text-center py-8">
                  <p className="text-muted-foreground">No tools available. All configured servers are disconnected.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {Object.entries(toolsByServer).map(([serverId, serverTools]) => (
                  <Card key={serverId}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-base">
                        Server: {serverId}
                        <Badge variant="outline" className="ml-2">
                          {serverTools.length} tools
                        </Badge>
                      </CardTitle>
                      {serverId !== 'unknown' && serverStatuses[serverId] === 'connected' && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDisconnect(serverId)}
                          disabled={actionInProgress === serverId}
                        >
                          {actionInProgress === serverId ? 'Disconnecting...' : 'Disconnect'}
                        </Button>
                      )}
                    </CardHeader>
                    
                    <CardContent className="space-y-3 pt-2">
                      {serverTools.map((tool) => (
                        <Card key={tool.name} className="overflow-hidden">
                          <div 
                            className="p-4 cursor-pointer hover:bg-accent/50 transition-colors"
                            onClick={() => toggleToolExpand(tool.name)}
                          >
                            <div className="flex justify-between items-start">
                              <div className="space-y-1 flex-1">
                                <h4 className="font-medium">{tool.name}</h4>
                                <p className="text-sm text-muted-foreground">
                                  {tool.description?.substring(0, 100)}
                                  {tool.description?.length > 100 ? '...' : ''}
                                </p>
                              </div>
                              <Button variant="ghost" size="sm" className="shrink-0 ml-2">
                                {expandedTools[tool.name] ? '▼' : '▶'}
                              </Button>
                            </div>
                          </div>
                          
                          {expandedTools[tool.name] && (
                            <div className="border-t p-4 space-y-4 bg-muted/50">
                              <div>
                                <h5 className="font-medium text-sm mb-2">Full Description:</h5>
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{tool.description}</p>
                              </div>
                              
                              <div>
                                <h5 className="font-medium text-sm mb-2">Input Schema:</h5>
                                <pre className="bg-background p-3 rounded-md overflow-x-auto text-xs border">
                                  {JSON.stringify(tool.input_schema, null, 2)}
                                </pre>
                              </div>
                            </div>
                          )}
                        </Card>
                      ))}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </CardContent>
        
        <div className="flex items-center justify-end gap-2 p-6 pt-0">
          <Button onClick={onClose} className="w-full">
            Close
          </Button>
        </div>

        {viewingLogsForServer && (
          <LogViewerModal 
            serverId={viewingLogsForServer.id} 
            transportType={viewingLogsForServer.transport}
            onClose={() => setViewingLogsForServer(null)}
          />
        )}

      </Card>
    </div>
  );
}

export default ToolsPanel; 

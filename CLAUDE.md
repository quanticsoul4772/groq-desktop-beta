# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Groq Desktop is an Electron-based desktop application that provides a chat interface with Groq AI models, featuring MCP (Model Context Protocol) server support and cross-platform compatibility (Windows, macOS, Linux).

## Key Technologies

- **Frontend**: React 19, Vite, TailwindCSS, React Router
- **Backend**: Electron 27, Node.js (CommonJS modules)
- **Build System**: Vite + electron-builder
- **Package Manager**: pnpm (v10.9.0)
- **Key Libraries**: groq-sdk, @modelcontextprotocol/sdk, react-markdown

## Essential Commands

```bash
# Development
pnpm dev              # Run both Vite dev server and Electron in development mode
pnpm dev:vite         # Run Vite dev server only
pnpm dev:electron     # Run Electron only (development mode)

# Building
pnpm build            # Build Vite frontend
pnpm build:electron   # Build Electron app with electron-builder
pnpm dist             # Build everything (frontend + electron)
pnpm dist:mac         # Build for macOS
pnpm dist:win         # Build for Windows  
pnpm dist:linux       # Build for Linux

# Testing
pnpm test:platforms   # Run cross-platform tests (includes Docker test for Linux)
pnpm test:paths       # Test path handling across platforms

# Linting
npx eslint .          # Run ESLint (no dedicated script, but ESLint is configured)
```

## Architecture Overview

### Directory Structure

- **`/electron`**: Main process code (Electron backend)
  - `main.js`: Entry point, initializes app and manages windows
  - `chatHandler.js`: Handles Groq API integration and chat logic
  - `mcpManager.js`: Manages MCP server connections
  - `toolHandler.js`: Handles tool execution and approval
  - `settingsManager.js`: Manages app settings storage
  - `commandResolver.js`: Resolves command paths across platforms
  - `/scripts`: Platform-specific launcher scripts for MCP servers

- **`/src/renderer`**: Renderer process code (React frontend)
  - `App.jsx`: Main React component with chat interface
  - `/components`: UI components (MessageList, ChatInput, ToolsPanel, etc.)
  - `/context`: React contexts (ChatContext for state management)
  - `/pages`: Page components (Settings)

- **`/shared`**: Code shared between main and renderer processes
  - `models.js`: Model definitions and context sizes

### Key Architectural Patterns

1. **IPC Communication**: Main and renderer processes communicate via Electron IPC
   - Chat messages: `chat:sendMessage`, `chat:messageUpdate`
   - Settings: `settings:load`, `settings:save`
   - MCP: `mcp:getServers`, `mcp:updateConfig`
   - Tools: `tool:execute`, `tool:approve`

2. **MCP Server Integration**: Supports multiple MCP server types (node, deno, docker, uvx)
   - Platform-specific scripts in `/electron/scripts`
   - Dynamic command resolution based on OS

3. **Tool Approval System**: 
   - Three modes: prompt (default), always allow, YOLO mode
   - Approval state stored in localStorage
   - Modal UI for tool execution approval

4. **Cross-Platform Support**:
   - Platform detection in `commandResolver.js`
   - Separate scripts for Windows (.cmd/.ps1), macOS/Linux (.sh)
   - Path handling abstracted for different OS path separators

## Development Notes

- The app uses CommonJS modules (`require/module.exports`) in Electron main process
- React components use ES modules (`import/export`)
- Settings are stored using `electron-json-storage`
- Logs are written to `~/Library/Logs/Groq Desktop` (macOS) or equivalent
- The app requires a Groq API key configured in settings
- ESLint is configured but no TypeScript is used in the project
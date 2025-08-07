# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Groq Desktop is an Electron-based desktop application that provides a chat interface with Groq AI models, featuring MCP (Model Context Protocol) server support and cross-platform compatibility (Windows, macOS, Linux).

## Key Technologies

- **Frontend**: React 19, Vite, TailwindCSS, React Router
- **Backend**: Electron 37, Node.js (CommonJS modules)
- **Build System**: Vite + electron-builder
- **Package Manager**: pnpm (v10.9.0)
- **Testing**: Jest with separate configs for React, Electron, and integration tests
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
pnpm test             # Run all tests with import validation
pnpm test:unit        # Run unit tests only
pnpm test:integration # Run integration tests only
pnpm test:watch       # Run tests in watch mode
pnpm test:coverage    # Run tests with coverage report
pnpm test:ci          # Run tests in CI mode
pnpm test:platforms   # Run cross-platform tests (includes Docker test for Linux)
pnpm test:paths       # Test path handling across platforms
pnpm test:settings    # Test settings manager
pnpm test:clear-cache # Clear Jest cache

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
- Node.js v18+ required for development

## Testing Architecture

The project uses Jest with three separate test environments:

1. **React Components** (`jsdom` environment): Tests for UI components in `/src/renderer`
2. **Electron Main Process** (`node` environment): Tests for backend logic in `/electron`
3. **Integration Tests** (`node` environment): End-to-end tests combining multiple modules

Each environment has its own cache directory for improved performance. Tests use mocked versions of ESM modules (react-markdown, remark-gfm, etc.) to avoid compatibility issues.

Coverage thresholds are set to 90% for all metrics (lines, branches, functions, statements).

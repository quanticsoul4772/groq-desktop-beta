# Groq Desktop

[![Latest macOS Build](https://img.shields.io/github/v/release/groq/groq-desktop-beta?include_prereleases&label=latest%20macOS%20.dmg%20build)](https://github.com/groq/groq-desktop-beta/releases/latest)

Groq Desktop features MCP server support for all function calling capable models hosted on Groq. Now available for Windows, macOS, and Linux!

> **Note for macOS Users**: After installing on macOS, you may need to run this command to open the app:
> ```sh
> xattr -c /Applications/Groq\ Desktop.app
> ```

## Table of Contents

- [Unofficial Homebrew Installation (macOS)](#unofficial-homebrew-installation-macos)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Setup](#setup)
- [Troubleshooting](#troubleshooting)
- [Building for Production](#building-for-production)
- [Configuration](#configuration)
- [Testing](#testing)
- [Contributing](#contributing)
<img width="450" alt="Screenshot 2025-08-05 at 11 32 04 AM" src="https://github.com/user-attachments/assets/d4fd9224-8186-4117-bdeb-b477f8a42d49" />
<br>
<br>
<img width="450" alt="Screenshot 2025-08-05 at 11 28 49 AM" src="https://github.com/user-attachments/assets/ced9c517-74f0-46b0-8e91-40ebc88adc3a" />


## Unofficial Homebrew Installation (macOS)

You can install the latest release using [Homebrew](https://brew.sh/) via an unofficial tap:

```sh
brew tap ricklamers/groq-desktop-unofficial
brew install --cask groq-desktop
# Allow the app to run
xattr -c /Applications/Groq\ Desktop.app
```

## Features

- Chat interface with image support
- Local MCP servers
- Dark mode toggle with persistent theme preference

## Prerequisites

- Node.js (v18+)
- pnpm package manager

## Setup

1. Clone this repository
2. Install dependencies:
   ```
   pnpm install
   ```
3. Start the development server:
   ```
   pnpm dev
   ```

## Troubleshooting

### Electron Installation Issues

If you encounter an error like "Electron failed to install correctly" when running `pnpm dev`, this is likely because pnpm blocked the build scripts for security reasons. To fix this:

1. Remove the corrupted installation:
   ```bash
   rm -rf node_modules
   ```

2. Reinstall dependencies:
   ```bash
   pnpm install
   ```

3. Approve the build scripts when prompted (or run manually):
   ```bash
   pnpm approve-builds
   ```
   Select `electron` and `esbuild` when prompted to allow their post-install scripts to run.

4. Try running the dev server again:
   ```bash
   pnpm dev
   ```

## Building for Production

To build the application for production:

```
pnpm dist
```

This will create installable packages in the `release` directory for your current platform.

### Building for Specific Platforms

```bash
# Build for all supported platforms
pnpm dist

# Build for macOS only
pnpm dist:mac

# Build for Windows only
pnpm dist:win

# Build for Linux only
pnpm dist:linux
```

## Development

### Testing

This project maintains comprehensive test coverage with a minimum requirement of 90% across all metrics (lines, branches, functions, and statements).

#### Test Scripts

```bash
# Run all tests
pnpm test

# Run tests with coverage report
pnpm test:coverage

# Run only unit tests
pnpm test:unit

# Run only integration tests
pnpm test:integration

# Run tests in watch mode for development
pnpm test:watch

# Run tests for CI/CD (enforces coverage thresholds)
pnpm test:ci
```

#### Test Structure

- **Unit Tests**: Located in `__tests__/unit/`
  - React components (`__tests__/unit/components/`)
  - Electron main process (`__tests__/unit/electron/`)
  - Utility functions (`__tests__/unit/renderer/`)
- **Integration Tests**: Located in `__tests__/integration/`
  - API resilience and retry logic
  - Cache behavior and performance
  - Electron-renderer communication
- **Test Setup**: Automated mocking for Electron, React, and external APIs

#### Coverage Requirements

All new code must maintain:
- **Lines**: ≥90%
- **Branches**: ≥90% 
- **Functions**: ≥90%
- **Statements**: ≥90%

The build will fail if coverage drops below these thresholds.

#### Running Tests Locally

```bash
# Install dependencies
pnpm install

# Run tests with coverage
pnpm test:coverage

# View coverage report
open coverage/lcov-report/index.html
```

### Testing Cross-Platform Support

This app supports Windows, macOS, and Linux. Legacy platform tests:

```bash
# Run all platform tests (including Docker test for Linux)
pnpm test:platforms

# Run basic path handling test only
pnpm test:paths

# If on Windows, run the PowerShell test script
.\test-windows.ps1
```

The platform testing scripts check:
- Platform detection
- Script file resolution
- Environment variable handling
- Path separators
- Command resolution

## Configuration

In the settings page, add your Groq API key:

```json
{
  "GROQ_API_KEY": "your-api-key"
}
```

You can obtain a Groq API key by signing up at [https://console.groq.com](https://console.groq.com).

### Dark Mode

The app now includes a dark mode toggle in the Settings page. Toggle between light and dark themes, and your preference will persist across app restarts. The theme is applied immediately when changed and stored in your user settings.

## Testing

This project maintains a minimum test coverage of 90% across all metrics (lines, branches, functions, and statements). We use Jest as our testing framework with separate configurations for React components, Electron main process, and integration tests.

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests with coverage report
pnpm test:coverage

# Run only unit tests
pnpm test:unit

# Run only integration tests
pnpm test:integration

# Run tests in watch mode (for development)
pnpm test:watch

# Run tests in CI mode (with coverage enforcement)
pnpm test:ci
```

### Test Structure

- `__tests__/unit/` - Unit tests for utilities and helpers
- `__tests__/integration/` - Integration tests for API and system interactions
- `src/renderer/components/__tests__/` - React component tests
- `electron/__tests__/` - Electron main process module tests

### Coverage Requirements

All code must maintain at least 90% test coverage. The build will fail if coverage falls below:
- Lines: 90%
- Branches: 90%
- Functions: 90%
- Statements: 90%

View the coverage report after running tests:
```bash
pnpm test:coverage
open coverage/index.html
```

### Writing Tests

When contributing new features or fixes:
1. Write tests for all new code
2. Ensure existing tests still pass
3. Update tests when modifying existing functionality
4. Follow the existing test patterns in the codebase

### Continuous Integration

Tests are automatically run on all pull requests and pushes to main. The CI pipeline:
- Runs tests across multiple OS (Ubuntu, macOS, Windows)
- Checks coverage thresholds
- Reports coverage metrics on PRs
- Uploads coverage reports to Codecov

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for detailed setup instructions, development workflows, and coding conventions.

Quick start for contributors:
1. Clone the repository
2. Install dependencies: `pnpm install`
3. Set up your environment: `cp env.example .env` (add your Groq API key)
4. Start development: `pnpm dev` 

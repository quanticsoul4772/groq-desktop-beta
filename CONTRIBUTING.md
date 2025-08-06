# Contributing to Groq Desktop

Thank you for your interest in contributing to Groq Desktop! This guide will help you set up your development environment and understand our contribution process.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher) - [Download from nodejs.org](https://nodejs.org/)
- **pnpm** package manager - Install with `npm install -g pnpm` or follow [pnpm installation guide](https://pnpm.io/installation)
- **Git** for version control

### Platform-Specific Notes

- **macOS**: No additional requirements
- **Windows**: Ensure you have PowerShell or Command Prompt available
- **Linux**: Make sure you have build tools available (`build-essential` on Ubuntu/Debian)

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/quanticsoul4772/groq-desktop-beta.git
cd groq-desktop-beta
```

### 2. Install Dependencies

```bash
pnpm install
```

If you encounter Electron installation issues with pnpm blocking build scripts:

```bash
# Remove corrupted installation
rm -rf node_modules

# Reinstall dependencies
pnpm install

# Approve build scripts when prompted
pnpm approve-builds
# Select 'electron' and 'esbuild' when prompted
```

### 3. Set Up Environment Variables

1. Copy the example environment file:
   ```bash
   cp env.example .env
   ```

2. Edit `.env` and add your Groq API key:
   ```
   GROQ_API_KEY=your_actual_groq_api_key_here
   ```

3. Get your API key from [Groq Console](https://console.groq.com/keys)

### 4. Start Development

```bash
pnpm dev
```

This command:
- Starts the Vite development server for the React frontend
- Launches the Electron app in development mode
- Enables hot reload for both frontend and Electron main process

## Development Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server (Vite + Electron) |
| `pnpm dev:vite` | Start only the Vite dev server |
| `pnpm dev:electron` | Start only Electron (requires built frontend) |
| `pnpm build` | Build the React frontend for production |
| `pnpm dist` | Build production packages for current platform |
| `pnpm dist:mac` | Build for macOS only |
| `pnpm dist:win` | Build for Windows only |
| `pnpm dist:linux` | Build for Linux only |
| `pnpm test:platforms` | Run cross-platform compatibility tests |
| `pnpm test:paths` | Test path handling across platforms |

## Project Structure

```
groq-desktop-beta/
├── electron/                 # Electron main process code
│   ├── main.js              # Main Electron entry point
│   ├── preload.js           # Preload script for renderer security
│   ├── scripts/             # Platform-specific MCP server scripts
│   └── *.js                 # Various Electron modules
├── src/
│   └── renderer/            # React frontend code
│       ├── App.jsx          # Main React app component
│       ├── components/      # React components
│       ├── context/         # React context providers
│       └── pages/           # Main pages (Settings, etc.)
├── shared/                  # Code shared between main and renderer
├── public/                  # Static assets
├── package.json             # Dependencies and scripts
└── vite.config.cjs         # Vite configuration
```

## Testing

### Comprehensive Test Suite

This project maintains **90% minimum coverage** across all metrics. All pull requests must include tests for new functionality.

#### Test Scripts

```bash
# Run all tests
pnpm test

# Run tests with coverage report
pnpm test:coverage

# Run unit tests only
pnpm test:unit

# Run integration tests only  
pnpm test:integration

# Run tests in watch mode (for development)
pnpm test:watch

# Run CI tests (enforces coverage thresholds)
pnpm test:ci
```

#### Writing Tests

**Unit Tests** - Place in `__tests__/unit/`:
- **React Components**: Test rendering, user interactions, props handling
- **Electron Modules**: Test IPC communication, settings, file operations
- **Utilities**: Test helper functions, data transformations

**Integration Tests** - Place in `__tests__/integration/`:
- **API Resilience**: Test retry logic, circuit breakers, rate limiting
- **Cache Behavior**: Test hits/misses, TTL, tag invalidation
- **Cross-Module Communication**: Test Electron main-renderer IPC

#### Test Requirements for PRs

✅ **All new code must have tests**
✅ **Coverage must remain ≥90%**
✅ **Tests must pass on all platforms**
✅ **Integration tests for API-dependent features**
✅ **Mock external dependencies appropriately**

#### Coverage Thresholds

- **Lines**: ≥90%
- **Branches**: ≥90%
- **Functions**: ≥90%
- **Statements**: ≥90%

*The build will fail if coverage drops below these thresholds.*

### Legacy Platform Tests

```bash
# Test cross-platform functionality
pnpm test:platforms

# Test path handling only
pnpm test:paths

# On Windows, you can also run:
.\test-windows.ps1
```

### Manual Testing Checklist

Before submitting a PR, manually verify:

1. **Development Mode**: `pnpm dev` starts without errors
2. **Settings**: API key configuration works in Settings page
3. **Chat Interface**: Basic chat functionality with image support works
4. **MCP Servers**: Local MCP server integration works
5. **Theme Switching**: Light/dark mode toggle works and persists
6. **Cross-Platform**: Test on your target platform(s)

## Branch and Commit Conventions

### Branch Naming

- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation changes
- `refactor/description` - Code refactoring
- `test/description` - Test additions/improvements

### Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
type(scope): brief description

More detailed explanation if needed

- List any breaking changes
- Reference issues: Fixes #123
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**
```
feat(chat): add image upload support
fix(electron): resolve window focus issue on macOS
docs(readme): update installation instructions
```

## Pull Request Process

1. **Create a branch** from `main` for your changes
2. **Make your changes** following the coding conventions
3. **Test thoroughly** on your platform
4. **Update documentation** if needed
5. **Commit your changes** using conventional commit format
6. **Push your branch** and create a Pull Request
7. **Describe your changes** clearly in the PR description
8. **Link any related issues** using "Fixes #issue-number"

### PR Checklist

- [ ] Code follows existing style and conventions
- [ ] **All tests pass** (`pnpm test:ci`)
- [ ] **Coverage remains ≥90%** (`pnpm test:coverage`)
- [ ] **New features have unit tests** (in `__tests__/unit/`)
- [ ] **API changes have integration tests** (in `__tests__/integration/`)
- [ ] Legacy platform tests pass (`pnpm test:platforms`)
- [ ] Documentation updated if needed
- [ ] Commit messages follow conventional format
- [ ] No sensitive information (API keys, etc.) committed
- [ ] Changes tested on at least one platform

#### Testing Requirements

**🔴 PRs will be blocked if:**
- Coverage drops below 90%
- Tests fail on CI
- New code lacks appropriate tests

**✅ All new code must include:**
- Unit tests for functions/components
- Integration tests for cross-module features
- Mocks for external dependencies
- Error handling test cases

## Code Style

- **JavaScript/JSX**: Follow the existing ESLint configuration
- **Formatting**: Use Prettier for consistent formatting
- **React**: Use functional components and hooks
- **Electron**: Follow Node.js best practices for main process code

## Architecture Notes

- **Frontend**: React 19 with Vite for fast development
- **Backend**: Electron main process handles API calls and system integration
- **Communication**: IPC (Inter-Process Communication) between main and renderer
- **Styling**: Tailwind CSS with custom components
- **State Management**: React Context for global state

## Getting Help

- **Issues**: Open an issue for bugs or feature requests
- **Discussions**: Use GitHub Discussions for questions
- **Documentation**: Check the README.md for basic setup info

## Platform-Specific Development

### macOS
- After building, you may need: `xattr -c /Applications/Groq\ Desktop.app`
- Homebrew installation available via unofficial tap

### Windows
- PowerShell scripts available for testing
- Builds create both NSIS installer and portable executable

### Linux
- Builds create AppImage, deb, and rpm packages
- Ensure build tools are installed

## Troubleshooting

### Common Issues

1. **Electron installation fails**: Use `pnpm approve-builds` and select electron
2. **Development server won't start**: Check Node.js version (v18+ required)
3. **API calls fail**: Verify GROQ_API_KEY is set correctly
4. **Build fails**: Ensure all dependencies are installed with `pnpm install`

### Environment Issues

- Clear node_modules and reinstall if experiencing strange issues
- Check that pnpm version matches `packageManager` field in package.json
- Verify environment variables are loaded correctly

---

Thank you for contributing to Groq Desktop! 🚀
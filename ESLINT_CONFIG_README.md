# ESLint Configuration for Groq Desktop

## Overview

This ESLint configuration has been optimized for React 19 and modern JavaScript patterns to reduce false positives and provide a better developer experience.

## Key Changes Made

### React 19 Compatibility

The configuration now properly supports React 19's automatic JSX transform, eliminating the need for explicit React imports in JSX files:

```javascript
// These rules are disabled for React 19 compatibility
'react/jsx-uses-react': 'off',
'react/react-in-jsx-scope': 'off'
```

### Unused Variables Configuration

Enhanced unused variable detection with exceptions for common patterns:

```javascript
'no-unused-vars': ['warn', {
  'argsIgnorePattern': '^_',                     // Allow unused args prefixed with _
  'varsIgnorePattern': '^_|^React$',             // Allow unused React import for compatibility
  'caughtErrors': 'none',                        // Ignore all caught errors
  'destructuredArrayIgnorePattern': '^_'         // Allow unused destructured array elements
}]
```

### Console Statement Rules

Project-specific console rules based on file context:

- **Scripts/Benchmarks/Utilities**: `'no-console': 'off'` - All console methods allowed
- **Electron Main Process**: `'no-console': ['warn', { allow: ['log', 'info', 'warn', 'error'] }]` - Debugging allowed
- **Test Files**: `'no-console': ['warn', { allow: ['log', 'warn', 'error'] }]` - Testing output allowed
- **React Components**: `'no-console': ['warn', { allow: ['warn', 'error'] }]` - Stricter for UI components

### File-Specific Configurations

The ESLint config is divided into targeted sections:

1. **Scripts & Utilities** (`scripts/**/*.js`, `__tests__/benchmarks/**/*.js`, `__tests__/utils/**/*.js`)
2. **Electron Main Process** (`**/*.{js,cjs}` excluding scripts)
3. **Jest/Test Files** (`**/__tests__/**/*.{js,jsx}`, `**/*.test.{js,jsx}`)
4. **React Components** (`src/renderer/**/*.jsx`)

### React-Specific Rules

- `'react/prop-types': 'off'` - Disabled (project doesn't use PropTypes)
- `'react/display-name': 'off'` - Allow anonymous components
- `'react/no-unescaped-entities': 'warn'` - Warn instead of error for unescaped entities

## Benefits Achieved

- ✅ No more false positives for React imports in React 19
- ✅ Appropriate console logging rules per file context
- ✅ Better handling of legitimate unused variables
- ✅ Warnings instead of errors for non-critical issues
- ✅ Consistent linting across different file types

## Running ESLint

Use the following commands:

```bash
# Run ESLint on all files
npx eslint .

# Run ESLint with zero warnings (strict mode)
npx eslint . --max-warnings 0

# Run ESLint on specific file types
npx eslint src/renderer/**/*.jsx  # React components only
npx eslint electron/**/*.js       # Electron main process only
```

## Maintenance

When adding new file patterns or locations, ensure they're properly configured in the appropriate section of `eslint.config.js` to get the right rule set for the file type.
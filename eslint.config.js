const globals = require('globals');
const pluginJs = require('@eslint/js');
const pluginReact = require('eslint-plugin-react');
const pluginJsxRuntime = require('eslint-plugin-react/configs/jsx-runtime');
const babelParser = require('@babel/eslint-parser');

module.exports = [
  // Global ignores
  {
    ignores: [
      "node_modules/",
      "dist/",
      "release/",
      "electron/vendor/",
      "*.config.js",
      "*.config.cjs"
    ]
  },

  // Scripts, benchmarks, and utility files - allow console.log
  {
    files: ["scripts/**/*.js", "__tests__/benchmarks/**/*.js", "__tests__/utils/**/*.js"],
    languageOptions: {
      globals: {
        ...globals.node,
        process: 'readonly',
        __dirname: 'readonly',
        module: 'readonly',
        require: 'readonly'
      }
    },
    rules: {
      ...pluginJs.configs.recommended.rules,
      'no-unused-vars': ['warn', {
          'argsIgnorePattern': '^_',
          'varsIgnorePattern': '^_',
          'caughtErrors': 'none',
          'destructuredArrayIgnorePattern': '^_'
      }],
      'no-unreachable': 'warn',
      'no-console': 'off', // Allow all console methods in scripts and utilities
      'prefer-const': 'warn'
    }
  },

  // JS/CJS specific config (Electron Main, etc.)
  {
    files: ["**/*.{js,cjs}"],
    ignores: ["scripts/**/*.js", "__tests__/benchmarks/**/*.js", "__tests__/utils/**/*.js"],
    languageOptions: {
      globals: {
        ...globals.node,
        process: 'readonly',
        __dirname: 'readonly',
        module: 'readonly',
        require: 'readonly'
      }
    },
    rules: {
        ...pluginJs.configs.recommended.rules, // Base JS rules
        'no-unused-vars': ['warn', {
            'argsIgnorePattern': '^_',
            'varsIgnorePattern': '^_',
            'caughtErrors': 'none', // Ignore all caught errors regardless of name
            'destructuredArrayIgnorePattern': '^_' // Allow unused destructured array elements
        }],
        'no-unreachable': 'warn',
        // Project-specific exceptions for Electron main process
        'no-console': ['warn', { allow: ['log', 'info', 'warn', 'error'] }], // Allow console logging for Electron debugging
        'prefer-const': 'warn' // Warn instead of error
    }
  },

  // Jest/Test files config
  {
    files: ["**/__tests__/**/*.{js,jsx}", "**/__mocks__/**/*.js", "**/*.test.{js,jsx}", "**/jest.*.js"],
    languageOptions: {
      parser: babelParser,
      parserOptions: {
        requireConfigFile: false,
        babelOptions: {
          presets: ["@babel/preset-react"]
        },
        ecmaFeatures: { jsx: true },
        sourceType: "module"
      },
      globals: {
        ...globals.node,
        ...globals.jest,
        jest: 'readonly',
        describe: 'readonly',
        test: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        mockGroqError: 'readonly',
        mockGroqChatSuccess: 'readonly',
        mockGroqRateLimit: 'readonly',
        mockGroqTimeout: 'readonly',
        window: 'readonly',
        document: 'readonly',
        React: 'readonly',
        Element: 'readonly',
        requestAnimationFrame: 'readonly'
      }
    },
    rules: {
      ...pluginJs.configs.recommended.rules,
      // React 19 compatibility for test files with JSX
      'react/jsx-uses-react': 'off',
      'react/react-in-jsx-scope': 'off',
      'no-unused-vars': ['warn', {
          'argsIgnorePattern': '^_',
          'varsIgnorePattern': '^_|^React$', // Allow unused React import for compatibility
          'caughtErrors': 'none',
          'destructuredArrayIgnorePattern': '^_' // Allow unused destructured array elements
      }],
      'no-unreachable': 'warn',
      // Project-specific exceptions for test files
      'no-console': ['warn', { allow: ['log', 'warn', 'error'] }], // Allow console.log, warn, and error in tests
      'prefer-const': 'warn' // Warn instead of error
    }
  },

  // JSX specific config (React Components in Renderer)
  {
    files: ["src/renderer/**/*.jsx"],
    plugins: {
        react: pluginReact
    },
    languageOptions: {
      parser: babelParser,
      parserOptions: {
        requireConfigFile: false,
        babelOptions: {
          presets: ["@babel/preset-react"]
        },
        ecmaFeatures: { jsx: true },
        sourceType: "module"
      },
      globals: {
        ...globals.browser,
        React: 'readonly',
        window: 'readonly',
        document: 'readonly',
        localStorage: 'readonly',
        FileReader: 'readonly',
        alert: 'readonly'
      }
    },
    settings: {
      react: { version: "detect" }
    },
    rules: {
      ...pluginReact.configs.recommended.rules,
      ...pluginJsxRuntime.rules,
      // React 19 compatibility - JSX Transform handles React automatically
      'react/jsx-uses-react': 'off',
      'react/react-in-jsx-scope': 'off',
      // Common rules adjustments
      'react/prop-types': 'off',
      'react/display-name': 'off', // Allow anonymous components
      'react/no-unescaped-entities': 'warn', // Warn instead of error for unescaped entities
      'no-unused-vars': ['warn', {
          'argsIgnorePattern': '^_',
          'varsIgnorePattern': '^_|^React$', // Allow unused React import for compatibility
          'caughtErrors': 'none', // Ignore all caught errors regardless of name
          'destructuredArrayIgnorePattern': '^_' // Allow unused destructured array elements
      }],
      'no-unreachable': 'warn',
      // Project-specific exceptions for React components
      'no-console': ['warn', { allow: ['warn', 'error'] }], // Allow console.warn and console.error (keep stricter for UI components)
      'prefer-const': 'warn' // Warn instead of error
    }
  }
]; 
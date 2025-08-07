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

  // JS/CJS specific config (Electron Main, Scripts, Configs etc.)
  {
    files: ["**/*.{js,cjs}"],
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
            'caughtErrors': 'none' // Ignore all caught errors regardless of name
        }],
        'no-unreachable': 'warn'
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
      'no-unused-vars': ['warn', {
          'argsIgnorePattern': '^_',
          'varsIgnorePattern': '^_',
          'caughtErrors': 'none'
      }],
      'no-unreachable': 'warn'
    }
  },

  // JSX specific config (React Components in Renderer)
  {
    files: ["src/renderer/**/*.{jsx}"],
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
      'react/prop-types': 'off',
      'no-unused-vars': ['warn', {
          'argsIgnorePattern': '^_',
          'varsIgnorePattern': '^_',
          'caughtErrors': 'none' // Ignore all caught errors regardless of name
      }],
      'no-unreachable': 'warn'
    }
  }
]; 
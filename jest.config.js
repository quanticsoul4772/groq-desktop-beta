const { pathsToModuleNameMapper } = require('ts-jest');

module.exports = {
  // Performance optimization
  maxWorkers: '50%',           // parallel tests
  cacheDirectory: '<rootDir>/.jest-cache',
  
  // Test environment configuration
  projects: [
    {
      displayName: 'React Components',
      testEnvironment: 'jsdom',
      testMatch: [
        '<rootDir>/__tests__/unit/components/**/*.test.js',
        '<rootDir>/__tests__/unit/renderer/**/*.test.js'
      ],
      setupFilesAfterEnv: ['<rootDir>/__tests__/setup/react-setup.js'],
      moduleNameMapper: {
        '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
        '\\.(gif|ttf|eot|svg|png)$': '<rootDir>/__mocks__/fileMock.js',
        '^@/(.*)$': '<rootDir>/src/renderer/$1'
      },
      transform: {
        '^.+\\.(js|jsx)$': 'babel-jest'
      },
      collectCoverageFrom: [
        'src/renderer/**/*.{js,jsx}',
        '!src/renderer/main.jsx',
        '!src/renderer/index.css'
      ]
    },
    {
      displayName: 'Electron Main Process',
      testEnvironment: 'node',
      testMatch: [
        '<rootDir>/__tests__/unit/electron/**/*.test.js'
      ],
      setupFilesAfterEnv: ['<rootDir>/__tests__/setup/electron-setup.js'],
      moduleNameMapper: {
        '^@electron/(.*)$': '<rootDir>/electron/$1',
        '^@shared/(.*)$': '<rootDir>/shared/$1'
      },
      transform: {
        '^.+\\.js$': 'babel-jest'
      },
      collectCoverageFrom: [
        'electron/**/*.js',
        '!electron/scripts/**',
        '!electron/main.js'
      ]
    },
    {
      displayName: 'Integration Tests',
      testEnvironment: 'node',
      testMatch: [
        '<rootDir>/__tests__/integration/**/*.test.js'
      ],
      setupFilesAfterEnv: ['<rootDir>/__tests__/setup/integration-setup.js'],
      transform: {
        '^.+\\.js$': 'babel-jest'
      },
      collectCoverageFrom: [
        'src/**/*.{js,jsx}',
        'electron/**/*.js',
        'shared/**/*.js',
        '!**/node_modules/**',
        '!**/__tests__/**',
        '!**/__mocks__/**'
      ]
    }
  ],
  
  // Coverage configuration with 90% thresholds
  coverageThreshold: {
    global: {
      lines: 90,
      branches: 90,
      functions: 90,
      statements: 90
    }
  },
  
  // Coverage settings
  collectCoverage: false, // Only collect when explicitly requested
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov',
    'json'
  ],
  
  // Global settings
  testTimeout: 10000,
  verbose: true,
  clearMocks: true,
  restoreMocks: true,
  
  // Module resolution
  moduleDirectories: ['node_modules', '<rootDir>'],
  
  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/release/',
    '/coverage/'
  ],
  
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/__tests__/',
    '/__mocks__/',
    '/dist/',
    '/release/',
    '/coverage/',
    'test-.*\\.js$',
    'benchmark-tests.js'
  ]
};
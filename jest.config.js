module.exports = {
  // Test environment configuration
  testEnvironment: 'jsdom',
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  
  // Module paths
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': '<rootDir>/__mocks__/styleMock.js',
    '\\.(jpg|jpeg|png|gif|webp|svg)$': '<rootDir>/__mocks__/fileMock.js',
    '^@/(.*)$': '<rootDir>/src/$1',
    '^electron$': '<rootDir>/__mocks__/electron.js'
  },
  
  // Transform configuration
  transform: {
    '^.+\\.(js|jsx)$': 'babel-jest'
  },
  
  // Test match patterns
  testMatch: [
    '**/__tests__/**/*.(test|spec).(js|jsx)',
    '**/?(*.)+(spec|test).(js|jsx)'
  ],
  
  // Coverage configuration
  collectCoverage: false,
  collectCoverageFrom: [
    'src/**/*.{js,jsx}',
    'electron/**/*.js',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/release/**',
    '!**/coverage/**',
    '!**/__tests__/**',
    '!**/__mocks__/**',
    '!**/test-*.js',
    '!**/benchmark-*.js'
  ],
  
  // Coverage thresholds - enforce 90% minimum
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    }
  },
  
  // Coverage reporters
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  
  // Test environment options
  testEnvironmentOptions: {
    url: 'http://localhost'
  },
  
  // Module file extensions
  moduleFileExtensions: ['js', 'jsx', 'json', 'node'],
  
  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/release/',
    '/build/'
  ],
  
  // Projects configuration for different test environments
  projects: [
    {
      displayName: 'React Components',
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/src/**/*.test.(js|jsx)']
    },
    {
      displayName: 'Electron Main Process',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/electron/**/*.test.js']
    },
    {
      displayName: 'Integration Tests',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/__tests__/integration/**/*.test.js']
    }
  ],
  
  // Verbose output
  verbose: true,
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Restore mocks between tests
  restoreMocks: true,
  
  // Max workers for parallel execution
  maxWorkers: '50%'
};

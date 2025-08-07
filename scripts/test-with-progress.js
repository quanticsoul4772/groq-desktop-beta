#!/usr/bin/env node

/**
 * Test script with progress tracking
 * Wraps test execution with visual feedback
 */

const ProgressTracker = require('./progress-tracker');
const { execSync } = require('child_process');

async function runTests() {
  const args = process.argv.slice(2);
  const verbose = args.includes('--verbose') || args.includes('-v');
  const coverage = args.includes('--coverage');
  const watch = args.includes('--watch');
  
  try {
    if (watch) {
      // Don't use progress tracking for watch mode
      console.log('Starting test watch mode...');
      execSync('pnpm test:watch', { stdio: 'inherit' });
    } else if (coverage) {
      // Run tests with coverage
      await ProgressTracker.execWithProgress('pnpm test:coverage', {
        name: 'Jest Tests with Coverage',
        verbose,
        estimatedDuration: 30
      });
    } else {
      // Run regular test suite
      await ProgressTracker.execWithProgress('pnpm test:ci', {
        name: 'Jest Test Suite',
        verbose,
        estimatedDuration: 25
      });
    }

    console.log('✨ Tests completed successfully!');
  } catch (error) {
    console.error('❌ Tests failed:', error.message);
    process.exit(1);
  }
}

function showHelp() {
  console.log(`
Test Script with Progress Tracking

Usage: node scripts/test-with-progress.js [options]

Options:
  --coverage        Run tests with coverage report
  --watch          Run tests in watch mode (no progress tracking)
  --verbose, -v    Show detailed progress output
  --help           Show this help

Examples:
  node scripts/test-with-progress.js
  node scripts/test-with-progress.js --coverage
  node scripts/test-with-progress.js --verbose
  node scripts/test-with-progress.js --watch
  `);
}

if (require.main === module) {
  if (process.argv.includes('--help')) {
    showHelp();
    process.exit(0);
  }
  runTests();
}

module.exports = { runTests };
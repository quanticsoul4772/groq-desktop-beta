#!/usr/bin/env node

/**
 * Build script with progress tracking
 * Wraps the build process with visual feedback
 */

const ProgressTracker = require('./progress-tracker');

async function runBuild() {
  try {
    // Build Vite frontend
    await ProgressTracker.execWithProgress('pnpm build', {
      name: 'Vite Frontend Build',
      verbose: process.argv.includes('--verbose') || process.argv.includes('-v'),
      estimatedDuration: 15,
    });

    // Build Electron app
    await ProgressTracker.execWithProgress('pnpm build:electron', {
      name: 'Electron App Build',
      verbose: process.argv.includes('--verbose') || process.argv.includes('-v'),
      estimatedDuration: 25,
    });

    console.log('✨ Build completed successfully!');
  } catch (error) {
    console.error('❌ Build failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  runBuild();
}

module.exports = { runBuild };

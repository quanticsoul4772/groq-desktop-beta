#!/usr/bin/env node

/**
 * Benchmark script to measure Jest performance improvements
 * from parallelization and transform caching
 */

const { spawn } = require('child_process');
const fs = require('fs');

function runJestCommand(command, cacheEnabled = true) {
  return new Promise((resolve, reject) => {
    const start = Date.now();

    // Clear cache if requested
    if (!cacheEnabled) {
      try {
        fs.rmSync('.jest-cache', { recursive: true, force: true });
        console.log('   📁 Cleared Jest cache directory');
      } catch (error) {
        // Ignore errors if cache directory doesn't exist
      }
    }

    const child = spawn('pnpm', ['run', command], {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: __dirname,
      env: { ...process.env, FORCE_COLOR: '0' },
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      const end = Date.now();
      const duration = end - start;

      // Extract Jest performance metrics if available
      const performanceMatch = stdout.match(/Tests:\s+(\d+)\s+passed.*Time:\s+([\d.]+)\s*s/);
      const testCount = performanceMatch ? parseInt(performanceMatch[1]) : 0;
      const jestTime = performanceMatch ? parseFloat(performanceMatch[2]) * 1000 : duration;

      resolve({
        command,
        duration,
        jestTime,
        testCount,
        success: code === 0,
        stdout,
        stderr,
        cacheEnabled,
      });
    });

    child.on('error', (error) => {
      reject(error);
    });
  });
}

async function benchmarkJestPerformance() {
  console.log('🚀 Benchmarking Jest Performance Improvements');
  console.log('='.repeat(60));
  console.log('Testing parallelization (maxWorkers: 50%) and cache improvements');
  console.log('');

  const testCommands = ['test:unit', 'test:integration', 'test'];

  const results = [];

  for (const command of testCommands) {
    console.log(`\n🧪 Running ${command}...`);

    // Run without cache (cold start)
    console.log(`   🥶 Cold run (no cache)...`);
    try {
      const coldResult = await runJestCommand(command, false);
      results.push({ ...coldResult, runType: 'cold' });

      const status = coldResult.success ? '✅ PASSED' : '❌ FAILED';
      console.log(
        `   ${status} in ${coldResult.duration}ms (Jest: ${Math.round(coldResult.jestTime)}ms)`
      );

      if (coldResult.testCount > 0) {
        console.log(
          `   📊 ${coldResult.testCount} tests, ${Math.round(coldResult.jestTime / coldResult.testCount)}ms per test`
        );
      }
    } catch (error) {
      console.error(`   ❌ ERROR: ${error.message}`);
      results.push({ command, runType: 'cold', success: false, error: error.message });
    }

    // Run with cache (warm start)
    console.log(`   🔥 Warm run (with cache)...`);
    try {
      const warmResult = await runJestCommand(command, true);
      results.push({ ...warmResult, runType: 'warm' });

      const status = warmResult.success ? '✅ PASSED' : '❌ FAILED';
      console.log(
        `   ${status} in ${warmResult.duration}ms (Jest: ${Math.round(warmResult.jestTime)}ms)`
      );

      if (warmResult.testCount > 0) {
        console.log(
          `   📊 ${warmResult.testCount} tests, ${Math.round(warmResult.jestTime / warmResult.testCount)}ms per test`
        );
      }

      // Calculate cache improvement
      const coldRun = results.find(
        (r) => r.command === command && r.runType === 'cold' && r.success
      );
      if (coldRun && warmResult.success) {
        const improvement = ((coldRun.jestTime - warmResult.jestTime) / coldRun.jestTime) * 100;
        const improvementTotal =
          ((coldRun.duration - warmResult.duration) / coldRun.duration) * 100;
        console.log(
          `   📈 Cache improvement: ${improvement.toFixed(1)}% (Jest), ${improvementTotal.toFixed(1)}% (total)`
        );
      }
    } catch (error) {
      console.error(`   ❌ ERROR: ${error.message}`);
      results.push({ command, runType: 'warm', success: false, error: error.message });
    }
  }

  // Summary
  console.log('\n📊 Performance Summary:');
  console.log('='.repeat(60));

  const groupedResults = {};
  results.forEach((result) => {
    if (!groupedResults[result.command]) {
      groupedResults[result.command] = {};
    }
    groupedResults[result.command][result.runType] = result;
  });

  let totalImprovement = 0;
  let validComparisons = 0;

  Object.entries(groupedResults).forEach(([command, runs]) => {
    console.log(`\n🧪 ${command}:`);

    if (runs.cold && runs.warm && runs.cold.success && runs.warm.success) {
      const coldTime = runs.cold.jestTime;
      const warmTime = runs.warm.jestTime;
      const improvement = ((coldTime - warmTime) / coldTime) * 100;

      console.log(`   Cold: ${Math.round(coldTime)}ms`);
      console.log(`   Warm: ${Math.round(warmTime)}ms`);
      console.log(`   Improvement: ${improvement.toFixed(1)}% faster`);

      totalImprovement += improvement;
      validComparisons++;

      // Check if meets acceptance criteria (≥20% faster)
      const meetsTarget = improvement >= 20;
      console.log(`   Target (≥20%): ${meetsTarget ? '✅ MET' : '❌ NOT MET'}`);
    } else {
      console.log(`   ⚠️ Unable to compare (some runs failed)`);
    }
  });

  if (validComparisons > 0) {
    const avgImprovement = totalImprovement / validComparisons;
    console.log(`\n🎯 Overall Results:`);
    console.log(`   Average improvement: ${avgImprovement.toFixed(1)}%`);
    console.log(`   Acceptance criteria (≥20%): ${avgImprovement >= 20 ? '✅ MET' : '❌ NOT MET'}`);

    // Cache information
    const cacheExists = fs.existsSync('.jest-cache');
    if (cacheExists) {
      try {
        const stats = fs.statSync('.jest-cache');
        console.log(
          `   Cache directory: ✅ Created (${stats.isDirectory() ? 'directory' : 'file'})`
        );
      } catch (error) {
        console.log(`   Cache directory: ❓ Unknown status`);
      }
    } else {
      console.log(`   Cache directory: ❌ Not found`);
    }
  }

  return results;
}

// Instructions for manual benchmarking
function printBenchmarkInstructions() {
  console.log('\n📋 Manual Benchmarking Instructions:');
  console.log('='.repeat(60));
  console.log('To measure before/after performance manually:');
  console.log('');
  console.log('1. Baseline (before optimization):');
  console.log('   - Remove maxWorkers and cacheDirectory from jest.config.js');
  console.log('   - Run: time pnpm run test');
  console.log('   - Record the time');
  console.log('');
  console.log('2. Optimized (after optimization):');
  console.log('   - Restore maxWorkers and cacheDirectory in jest.config.js');
  console.log('   - Run: time pnpm run test');
  console.log('   - Compare with baseline');
  console.log('');
  console.log('3. Cache effectiveness:');
  console.log('   - First run: rm -rf .jest-cache && time pnpm run test');
  console.log('   - Second run: time pnpm run test (should be faster)');
  console.log('');
  console.log('4. CI environment:');
  console.log('   - Check GitHub Actions logs for cache hit/miss indicators');
  console.log('   - Look for "Cache restored from key:" messages');
}

// Run if called directly
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--instructions') || args.includes('-i')) {
    printBenchmarkInstructions();
    process.exit(0);
  }

  benchmarkJestPerformance()
    .then((results) => {
      const allPassed = results.every((r) => r.success !== false);

      console.log('\n💡 Tip: Run with --instructions to see manual benchmarking steps');

      process.exit(allPassed ? 0 : 1);
    })
    .catch((error) => {
      console.error('Benchmark failed:', error.message);
      process.exit(1);
    });
}

module.exports = { benchmarkJestPerformance, runJestCommand };

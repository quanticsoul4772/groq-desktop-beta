#!/usr/bin/env node

/**
 * Benchmark script to measure test performance improvements
 * from shared temporary directory optimization
 */

const { spawn } = require('child_process');
const _path = require('path');

function runTest(testFile) {
  return new Promise((resolve, reject) => {
    const start = Date.now();

    const child = spawn('node', [testFile], {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: __dirname,
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

      resolve({
        file: testFile,
        duration,
        success: code === 0,
        stdout,
        stderr,
      });
    });

    child.on('error', (error) => {
      reject(error);
    });
  });
}

async function benchmarkTests() {
  console.log('🎯 Benchmarking Test Performance');
  console.log('='.repeat(50));

  const testFiles = ['test-settingsManager.js', 'test-paths.js', 'test-resolver.js'];

  const results = [];

  for (const testFile of testFiles) {
    console.log(`\n🧪 Running ${testFile}...`);

    try {
      const result = await runTest(testFile);
      results.push(result);

      const status = result.success ? '✅ PASSED' : '❌ FAILED';
      console.log(`   ${status} in ${result.duration}ms`);

      if (!result.success) {
        console.log('   Error output:');
        console.log('   ' + result.stderr.split('\n').slice(0, 5).join('\n   '));
      }
    } catch (error) {
      console.error(`   ❌ ERROR: ${error.message}`);
      results.push({
        file: testFile,
        duration: 0,
        success: false,
        error: error.message,
      });
    }
  }

  // Summary
  console.log('\n📊 Benchmark Results:');
  console.log('='.repeat(50));

  let totalTime = 0;
  let successCount = 0;

  results.forEach((result) => {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${result.file}: ${result.duration}ms`);
    totalTime += result.duration;
    if (result.success) successCount++;
  });

  console.log('-'.repeat(50));
  console.log(`Total time: ${totalTime}ms`);
  console.log(`Tests passed: ${successCount}/${results.length}`);

  // Breakdown by category
  const settingsManagerResult = results.find((r) => r.file === 'test-settingsManager.js');
  if (settingsManagerResult) {
    console.log(`\n🎯 Performance Focus:`);
    console.log(
      `test-settingsManager.js (12 tests with temp dirs): ${settingsManagerResult.duration}ms`
    );
    console.log(`Average per test: ${Math.round(settingsManagerResult.duration / 12)}ms`);
  }

  return results;
}

// Run if called directly
if (require.main === module) {
  benchmarkTests()
    .then((results) => {
      const allPassed = results.every((r) => r.success);
      process.exit(allPassed ? 0 : 1);
    })
    .catch((error) => {
      console.error('Benchmark failed:', error.message);
      process.exit(1);
    });
}

module.exports = { benchmarkTests, runTest };

#!/usr/bin/env node

/**
 * Pipeline Parity Test Suite
 * Simulates CI environment conditions locally to catch issues before pushing
 *
 * Phases implemented:
 * - Phase 1: Core Parity Script (Environment simulation, ESLint, Tests)
 * - Phase 2: Coverage Enforcement (90% threshold validation)
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const ProgressTracker = require('./progress-tracker');

class PipelineParity {
  constructor(options = {}) {
    this.options = {
      quick: false,
      full: false,
      coverageOnly: false,
      autoRunTests: true, // Automatically run tests when coverage is requested
      nodeVersions: ['20'], // Default to current, expandable later
      reportFormat: 'github',
      verbose: false, // Show detailed progress output
      ...options,
    };

    this.results = {
      environment: { status: 'pending', details: [] },
      linting: { status: 'pending', details: [] },
      imports: { status: 'pending', details: [] },
      tests: { status: 'pending', details: [] },
      coverage: { status: 'pending', details: [] },
    };

    this.startTime = Date.now();
    this.config = this.loadConfig();
  }

  loadConfig() {
    const configPath = path.join(process.cwd(), '.pipeline-parityrc.json');
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }

    // Default configuration matching CI
    return {
      nodeVersions: ['18', '20'],
      coverageThresholds: {
        lines: 90,
        branches: 90,
        functions: 90,
        statements: 90,
      },
      checks: {
        eslint: true,
        prettier: true,
        imports: true,
        tests: true,
        coverage: true,
        build: false,
      },
      autoRunTests: true, // Auto-run tests when coverage is requested
      environments: ['local'],
      reportFormat: 'github',
      cacheDirectory: '.pipeline-parity',
    };
  }

  log(message, level = 'info') {
    const timestamp = new Date().toISOString().split('T')[1].substring(0, 8);
    const levelMap = {
      info: '🔍',
      success: '✅',
      warning: '⚠️',
      error: '❌',
      debug: '🐛',
    };

    console.log(`${levelMap[level]} [${timestamp}] ${message}`);
  }

  async run() {
    this.printHeader();

    try {
      // Setup environment
      await this.setupEnvironment();

      // Run checks based on mode
      if (this.options.coverageOnly) {
        // Validate test dependency for coverage-only mode
        await this.validateCoverageDependencies();
        await this.runCoverageCheck();
      } else {
        if (this.config.checks.eslint) await this.runLinting();
        if (this.config.checks.prettier) await this.runFormatCheck();
        if (this.config.checks.imports) await this.runImportValidation();
        if (this.config.checks.tests) await this.runTests();
        if (this.config.checks.coverage) await this.runCoverageCheck();
      }

      // Generate final report
      this.generateReport();
    } catch (error) {
      this.log(`Pipeline failed: ${error.message}`, 'error');
      process.exit(1);
    }
  }

  printHeader() {
    console.log('');
    console.log('🔍 Pipeline Parity Tests v1.0.0');
    console.log('================================');
    console.log('');
  }

  async setupEnvironment() {
    this.log('Setting up CI-like environment...', 'info');

    // Set CI environment variables
    process.env.CI = 'true';
    process.env.NODE_ENV = 'test';

    // Create cache directory
    const cacheDir = path.join(process.cwd(), this.config.cacheDirectory);
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
      fs.mkdirSync(path.join(cacheDir, 'coverage'), { recursive: true });
      fs.mkdirSync(path.join(cacheDir, 'logs'), { recursive: true });
      fs.mkdirSync(path.join(cacheDir, 'reports'), { recursive: true });
    }

    this.results.environment.status = 'success';
    this.results.environment.details = [
      `Node version: ${process.version}`,
      'CI environment variables set',
      `Cache directory: ${cacheDir}`,
      `OS: ${os.platform()} ${os.arch()}`,
    ];

    this.log('Environment setup complete', 'success');
  }

  async runLinting() {
    const maxWarnings = this.config.eslintConfig?.maxWarnings ?? 0;

    try {
      // Run ESLint with progress tracking
      await ProgressTracker.execWithProgress(`npx eslint . --max-warnings ${maxWarnings}`, {
        name: 'ESLint Check',
        verbose: this.options.verbose,
        estimatedDuration: 10, // ESLint usually takes 5-15 seconds
      });

      this.results.linting.status = 'success';
      this.results.linting.details = ['✅ ESLint: 0 warnings, 0 errors'];
      this.log('ESLint passed', 'success');
    } catch (error) {
      this.results.linting.status = 'failed';
      this.results.linting.details = [
        '❌ ESLint failed with warnings/errors',
        error.stdout || error.message,
      ];
      this.log('ESLint failed - fix warnings/errors before pushing', 'error');
      throw new Error('Linting failed');
    }
  }

  async runFormatCheck() {
    try {
      await ProgressTracker.execWithProgress('pnpm format:check', {
        name: 'Prettier Check',
        verbose: this.options.verbose,
        estimatedDuration: 5,
      });
      this.results.linting.details.push('✅ Prettier: All files formatted correctly');
      this.log('Prettier check passed', 'success');
    } catch (error) {
      this.results.linting.status = 'failed';
      this.results.linting.details.push('❌ Prettier: Files need formatting');
      this.log('Format check failed - run "pnpm format" to fix', 'warning');
      // Don't throw - this can be auto-fixed
    }
  }

  async runImportValidation() {
    try {
      await ProgressTracker.execWithProgress('node scripts/validate-test-imports.js', {
        name: 'Import Validation',
        verbose: this.options.verbose,
        estimatedDuration: 3,
      });

      this.results.imports.status = 'success';
      this.results.imports.details = ['✅ Import validation passed'];
      this.log('Import validation passed', 'success');
    } catch (error) {
      this.results.imports.status = 'failed';
      this.results.imports.details = ['❌ Import validation failed', error.stdout || error.message];
      this.log('Import validation failed', 'error');
      throw new Error('Import validation failed');
    }
  }

  async runTests() {
    try {
      // Use the same command as CI with progress tracking
      const result = await ProgressTracker.execWithProgress('pnpm test:ci', {
        name: 'Jest Test Suite',
        verbose: this.options.verbose,
        estimatedDuration: 25, // Tests usually take 15-35 seconds
      });

      // Parse test results from output
      const lines = result.split('\n');
      const testLine = lines.find((line) => line.includes('Tests:') || line.includes('passed'));

      this.results.tests.status = 'success';
      this.results.tests.details = [
        '✅ Jest tests passed',
        testLine || 'All tests completed successfully',
      ];
      this.log('Tests passed', 'success');
    } catch (error) {
      this.results.tests.status = 'failed';
      this.results.tests.details = ['❌ Tests failed', error.stdout || error.message];
      this.log('Tests failed', 'error');
      throw new Error('Tests failed');
    }
  }

  async validateCoverageDependencies() {
    this.log('Validating coverage dependencies...', 'info');

    const coveragePath = path.join(process.cwd(), 'coverage', 'coverage-summary.json');
    const coverageExists = fs.existsSync(coveragePath);

    if (!coverageExists) {
      const autoRun = this.options.autoRunTests ?? this.config.autoRunTests ?? true;

      if (autoRun) {
        this.log('Coverage report not found. Running tests to generate coverage...', 'warning');
        await this.runTests();
      } else {
        throw new Error(
          'Coverage report not found and auto-run tests is disabled. ' +
            'Please run tests first with "pnpm test:ci" or enable auto-run tests.'
        );
      }
    } else {
      // Check if coverage report is fresh (generated after any test file changes)
      const coverageStats = fs.statSync(coveragePath);
      const testFiles = this.findTestFiles();

      if (testFiles.length > 0) {
        const newestTestFile = testFiles
          .map((file) => ({ file, mtime: fs.statSync(file).mtime }))
          .sort((a, b) => b.mtime - a.mtime)[0];

        if (newestTestFile.mtime > coverageStats.mtime) {
          this.log('Test files are newer than coverage report. Re-running tests...', 'warning');
          await this.runTests();
        } else {
          this.log('Coverage report is up-to-date', 'success');
        }
      }
    }
  }

  findTestFiles() {
    const testPatterns = [
      path.join(process.cwd(), '__tests__/**/*.js'),
      path.join(process.cwd(), '**/*.test.js'),
      path.join(process.cwd(), '**/*.spec.js'),
      path.join(process.cwd(), 'test/**/*.js'),
    ];

    const glob = require('glob');
    const testFiles = [];

    for (const pattern of testPatterns) {
      try {
        const files = glob.sync(pattern);
        testFiles.push(...files);
      } catch (error) {
        // Ignore glob errors for patterns that don't match
      }
    }

    return [...new Set(testFiles)]; // Remove duplicates
  }

  async runCoverageCheck() {
    this.log('Validating coverage thresholds...', 'info');

    try {
      const coveragePath = path.join(process.cwd(), 'coverage', 'coverage-summary.json');

      if (!fs.existsSync(coveragePath)) {
        throw new Error(
          'Coverage report not found. This indicates tests were not run successfully or ' +
            'coverage collection failed. Please check test execution logs.'
        );
      }

      const coverage = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
      const total = coverage.total;
      const threshold = this.config.coverageThresholds;

      // Check each metric
      const metrics = ['lines', 'branches', 'functions', 'statements'];
      const results = [];
      const failed = [];

      for (const metric of metrics) {
        const pct = total[metric].pct;
        const required = threshold[metric];
        const status = pct >= required ? '✅' : '❌';

        results.push(
          `${status} ${metric.charAt(0).toUpperCase() + metric.slice(1)}: ${pct}% (threshold: ${required}%)`
        );

        if (pct < required) {
          failed.push(metric);
        }
      }

      if (failed.length > 0) {
        this.results.coverage.status = 'failed';
        this.results.coverage.details = [
          '❌ Coverage thresholds not met:',
          ...results,
          `Failed metrics: ${failed.join(', ')}`,
        ];
        this.log(`Coverage thresholds not met for: ${failed.join(', ')}`, 'error');
        throw new Error('Coverage thresholds not met');
      } else {
        this.results.coverage.status = 'success';
        this.results.coverage.details = results;
        this.log('All coverage thresholds met', 'success');
      }
    } catch (error) {
      if (!this.results.coverage.status) {
        this.results.coverage.status = 'failed';
        this.results.coverage.details = ['❌ Coverage check failed', error.message];
      }
      this.log(`Coverage validation failed: ${error.message}`, 'error');
      throw error;
    }
  }

  generateReport() {
    const duration = ((Date.now() - this.startTime) / 1000).toFixed(1);

    // Only check status of enabled checks
    const enabledChecks = Object.keys(this.config.checks).filter(
      (check) => this.config.checks[check]
    );
    const enabledResults = enabledChecks.map((check) => this.results[check]).filter(Boolean);
    const allPassed = enabledResults.every((r) => r.status === 'success');

    console.log('');
    console.log('📊 Pipeline Parity Report');
    console.log('=========================');
    console.log('');

    // Environment
    console.log('Environment Setup:');
    this.results.environment.details.forEach((detail) => console.log(`   ${detail}`));
    console.log('');

    // Linting
    if (this.results.linting.details.length > 0) {
      console.log('Linting Checks:');
      this.results.linting.details.forEach((detail) => console.log(`   ${detail}`));
      console.log('');
    }

    // Imports
    if (this.results.imports.details.length > 0) {
      console.log('Import Validation:');
      this.results.imports.details.forEach((detail) => console.log(`   ${detail}`));
      console.log('');
    }

    // Tests
    if (this.results.tests.details.length > 0) {
      console.log('Test Execution:');
      this.results.tests.details.forEach((detail) => console.log(`   ${detail}`));
      console.log('');
    }

    // Coverage
    if (this.results.coverage.details.length > 0) {
      console.log('Coverage Report:');
      this.results.coverage.details.forEach((detail) => console.log(`   ${detail}`));
      console.log('');
    }

    // Final status
    if (allPassed) {
      console.log('✨ Pipeline parity check PASSED!');
      console.log('   CI build prediction: WILL PASS');
    } else {
      console.log('💥 Pipeline parity check FAILED!');
      console.log('   CI build prediction: WILL FAIL');
      console.log('   Fix the issues above before pushing');
    }

    console.log('');
    console.log(`Time: ${duration}s`);
    console.log('');

    // Save report to file
    this.saveReport({ allPassed, duration });

    if (!allPassed) {
      process.exit(1);
    }
  }

  saveReport({ allPassed, duration }) {
    const reportPath = path.join(
      process.cwd(),
      this.config.cacheDirectory,
      'reports',
      `pipeline-parity-${Date.now()}.json`
    );

    const report = {
      timestamp: new Date().toISOString(),
      duration,
      passed: allPassed,
      nodeVersion: process.version,
      platform: os.platform(),
      results: this.results,
      config: this.config,
    };

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    this.log(`Report saved to: ${reportPath}`, 'debug');
  }
}

// CLI handling
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--quick':
        options.quick = true;
        break;
      case '--full':
        options.full = true;
        break;
      case '--coverage-only':
        options.coverageOnly = true;
        break;
      case '--no-auto-tests':
        options.autoRunTests = false;
        break;
      case '--node-versions':
        options.nodeVersions = args[++i].split(',');
        break;
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      case '--help':
        console.log(`
Pipeline Parity Tests - Simulate CI locally

Usage: node scripts/pipeline-parity.js [options]

Options:
  --quick           Quick mode (skip some checks)
  --full            Full mode (all checks, multi-platform)
  --coverage-only   Only run coverage validation
  --no-auto-tests   Disable automatic test execution for coverage
  --verbose, -v     Show detailed progress output
  --node-versions   Comma-separated Node versions to test
  --help           Show this help

Examples:
  pnpm test:pipeline
  pnpm test:pipeline --quick
  pnpm test:pipeline --verbose
  pnpm test:pipeline --coverage-only
  pnpm test:pipeline --coverage-only --no-auto-tests
        `);
        process.exit(0);
        break;
    }
  }

  return options;
}

// Run if called directly
if (require.main === module) {
  const options = parseArgs();
  const parity = new PipelineParity(options);
  parity.run().catch((error) => {
    console.error('Pipeline parity failed:', error.message);
    process.exit(1);
  });
}

module.exports = PipelineParity;

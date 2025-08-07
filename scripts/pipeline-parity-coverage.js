#!/usr/bin/env node

/**
 * Pipeline Parity - Coverage Checker
 * Dedicated script for coverage validation with detailed reporting
 */

const fs = require('fs');
const path = require('path');

class CoverageChecker {
  constructor(options = {}) {
    this.thresholds = options.thresholds || {
      lines: 90,
      branches: 90,
      functions: 90,
      statements: 90,
    };
    this.reportFormat = options.reportFormat || 'detailed';
  }

  async check() {
    const coveragePath = path.join(process.cwd(), 'coverage', 'coverage-summary.json');

    if (!fs.existsSync(coveragePath)) {
      throw new Error('Coverage report not found. Run tests with coverage first.');
    }

    const coverage = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
    const total = coverage.total;

    const results = {
      passed: true,
      metrics: {},
      summary: {},
    };

    // Check each metric
    for (const [metric, threshold] of Object.entries(this.thresholds)) {
      const actual = total[metric].pct;
      const passed = actual >= threshold;

      results.metrics[metric] = {
        actual,
        threshold,
        passed,
        covered: total[metric].covered,
        total: total[metric].total,
        skipped: total[metric].skipped || 0,
      };

      if (!passed) {
        results.passed = false;
      }
    }

    // Generate summary
    results.summary = {
      totalMetrics: Object.keys(this.thresholds).length,
      passedMetrics: Object.values(results.metrics).filter((m) => m.passed).length,
      overallPassed: results.passed,
    };

    return results;
  }

  formatResults(results) {
    if (this.reportFormat === 'github') {
      return this.formatGitHubSummary(results);
    } else if (this.reportFormat === 'json') {
      return JSON.stringify(results, null, 2);
    } else {
      return this.formatDetailed(results);
    }
  }

  formatDetailed(results) {
    let output = '\n📊 Coverage Report\n';
    output += '==================\n\n';

    // Metrics table
    output += '| Metric     | Coverage | Required | Status | Covered/Total |\n';
    output += '|------------|----------|----------|--------|---------------|\n';

    for (const [metric, data] of Object.entries(results.metrics)) {
      const status = data.passed ? '✅ Pass' : '❌ Fail';
      const coverage = `${data.actual}%`;
      const required = `${data.threshold}%`;
      const fraction = `${data.covered}/${data.total}`;

      output += `| ${metric.padEnd(10)} | ${coverage.padEnd(8)} | ${required.padEnd(8)} | ${status.padEnd(6)} | ${fraction.padEnd(13)} |\n`;
    }

    output += '\n';

    // Summary
    const summaryIcon = results.passed ? '✅' : '❌';
    const summaryText = results.passed ? 'PASSED' : 'FAILED';
    output += `${summaryIcon} Overall Status: ${summaryText}\n`;
    output += `   Metrics Passed: ${results.summary.passedMetrics}/${results.summary.totalMetrics}\n`;

    if (!results.passed) {
      const failedMetrics = Object.entries(results.metrics)
        .filter(([, data]) => !data.passed)
        .map(([metric]) => metric);
      output += `   Failed Metrics: ${failedMetrics.join(', ')}\n`;
    }

    output += '\n';
    return output;
  }

  formatGitHubSummary(results) {
    let output = '## 📊 Coverage Report\n\n';
    output += '| Metric | Coverage | Status |\n';
    output += '|--------|----------|--------|\n';

    for (const [metric, data] of Object.entries(results.metrics)) {
      const status = data.passed ? '✅' : '❌';
      output += `| ${metric.charAt(0).toUpperCase() + metric.slice(1)} | ${data.actual}% | ${status} |\n`;
    }

    output += '\n**Minimum Required Coverage:** 90%\n\n';

    if (results.passed) {
      output += '✅ All coverage thresholds met!';
    } else {
      output += '❌ Coverage thresholds not met. Please add more tests.';
    }

    return output;
  }
}

// CLI handling
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {
    reportFormat: 'detailed',
  };

  // Parse args
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--format' && args[i + 1]) {
      options.reportFormat = args[++i];
    }
  }

  const checker = new CoverageChecker(options);

  checker
    .check()
    .then((results) => {
      const formatted = checker.formatResults(results);
      console.log(formatted);

      if (!results.passed) {
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('Coverage check failed:', error.message);
      process.exit(1);
    });
}

module.exports = CoverageChecker;

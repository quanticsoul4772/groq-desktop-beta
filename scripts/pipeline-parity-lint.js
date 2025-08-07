#!/usr/bin/env node

/**
 * Pipeline Parity - Linting Checker
 * Dedicated script for linting validation matching CI requirements
 */

const { execSync } = require('child_process');
// File system operations (if needed later)
// const fs = require('fs');
const path = require('path');

class LintChecker {
  constructor(options = {}) {
    this.options = {
      maxWarnings: 0,
      checkPrettier: true,
      ...options,
    };
    this.results = {
      eslint: { passed: false, errors: 0, warnings: 0, details: [] },
      prettier: { passed: false, details: [] },
    };
  }

  async checkESLint() {
    console.log('🔍 Running ESLint with CI configuration...');

    try {
      const result = execSync(
        `npx eslint . --max-warnings ${this.options.maxWarnings} --format=json`,
        {
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe'],
        }
      );

      const eslintOutput = JSON.parse(result);
      let totalErrors = 0;
      let totalWarnings = 0;

      eslintOutput.forEach((file) => {
        totalErrors += file.errorCount;
        totalWarnings += file.warningCount;

        if (file.messages.length > 0) {
          this.results.eslint.details.push({
            file: file.filePath,
            messages: file.messages.map((msg) => ({
              line: msg.line,
              column: msg.column,
              rule: msg.ruleId,
              message: msg.message,
              severity: msg.severity === 2 ? 'error' : 'warning',
            })),
          });
        }
      });

      this.results.eslint.errors = totalErrors;
      this.results.eslint.warnings = totalWarnings;
      this.results.eslint.passed = totalErrors === 0 && totalWarnings <= this.options.maxWarnings;

      if (this.results.eslint.passed) {
        console.log('✅ ESLint: No errors or warnings found');
      } else {
        console.log(`❌ ESLint: ${totalErrors} errors, ${totalWarnings} warnings`);
      }
    } catch (error) {
      // ESLint returns non-zero when issues found
      try {
        const eslintOutput = JSON.parse(error.stdout);
        let totalErrors = 0;
        let totalWarnings = 0;

        eslintOutput.forEach((file) => {
          totalErrors += file.errorCount;
          totalWarnings += file.warningCount;

          if (file.messages.length > 0) {
            this.results.eslint.details.push({
              file: path.relative(process.cwd(), file.filePath),
              messages: file.messages.map((msg) => ({
                line: msg.line,
                column: msg.column,
                rule: msg.ruleId,
                message: msg.message,
                severity: msg.severity === 2 ? 'error' : 'warning',
              })),
            });
          }
        });

        this.results.eslint.errors = totalErrors;
        this.results.eslint.warnings = totalWarnings;
        this.results.eslint.passed = false;

        console.log(`❌ ESLint: ${totalErrors} errors, ${totalWarnings} warnings`);
      } catch (parseError) {
        this.results.eslint.passed = false;
        this.results.eslint.details.push({
          error: error.message || 'ESLint execution failed',
        });
        console.log('❌ ESLint: Execution failed');
      }
    }
  }

  async checkPrettier() {
    if (!this.options.checkPrettier) {
      return;
    }

    console.log('🔍 Checking Prettier formatting...');

    try {
      execSync('pnpm format:check', {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      this.results.prettier.passed = true;
      this.results.prettier.details.push('All files are properly formatted');
      console.log('✅ Prettier: All files formatted correctly');
    } catch (error) {
      this.results.prettier.passed = false;

      // Parse the output to find unformatted files
      const output = error.stdout || error.stderr || '';
      const lines = output.split('\n').filter((line) => line.trim());

      if (lines.length > 0) {
        this.results.prettier.details = lines.filter(
          (line) => !line.includes('Checking formatting') && line.trim()
        );
      } else {
        this.results.prettier.details.push('Some files need formatting');
      }

      console.log('⚠️  Prettier: Some files need formatting');
      console.log('   Run "pnpm format" to fix automatically');
    }
  }

  generateReport() {
    const allPassed =
      this.results.eslint.passed && (this.results.prettier.passed || !this.options.checkPrettier);

    console.log('\n📋 Linting Report');
    console.log('==================');

    // ESLint summary
    console.log(`\nESLint: ${this.results.eslint.passed ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`  Errors: ${this.results.eslint.errors}`);
    console.log(`  Warnings: ${this.results.eslint.warnings}`);
    console.log(`  Max warnings allowed: ${this.options.maxWarnings}`);

    // Show detailed errors if any
    if (this.results.eslint.details.length > 0 && !this.results.eslint.passed) {
      console.log('\n  Issues found:');
      this.results.eslint.details.forEach((detail) => {
        if (detail.file) {
          console.log(`    ${detail.file}:`);
          detail.messages.forEach((msg) => {
            console.log(
              `      ${msg.line}:${msg.column} ${msg.severity} ${msg.message} [${msg.rule}]`
            );
          });
        }
      });
    }

    // Prettier summary
    if (this.options.checkPrettier) {
      console.log(
        `\nPrettier: ${this.results.prettier.passed ? '✅ PASSED' : '⚠️  NEEDS FORMATTING'}`
      );
      if (!this.results.prettier.passed) {
        console.log('  Files needing formatting:');
        this.results.prettier.details.forEach((detail) => {
          console.log(`    ${detail}`);
        });
      }
    }

    console.log(`\nOverall: ${allPassed ? '✅ PASSED' : '❌ FAILED'}`);

    return allPassed;
  }

  async run() {
    await this.checkESLint();
    if (this.options.checkPrettier) {
      await this.checkPrettier();
    }

    return this.generateReport();
  }
}

// CLI handling
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--max-warnings':
        options.maxWarnings = parseInt(args[++i]) || 0;
        break;
      case '--no-prettier':
        options.checkPrettier = false;
        break;
      case '--help':
        console.log(`
Pipeline Parity - Linting Checker

Usage: node scripts/pipeline-parity-lint.js [options]

Options:
  --max-warnings N   Maximum warnings allowed (default: 0)
  --no-prettier      Skip Prettier format check
  --help            Show this help
        `);
        process.exit(0);
        break;
    }
  }

  const checker = new LintChecker(options);

  checker
    .run()
    .then((passed) => {
      if (!passed) {
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('Lint check failed:', error.message);
      process.exit(1);
    });
}

module.exports = LintChecker;

#!/usr/bin/env node

/**
 * Check test coverage against thresholds
 * This script mirrors the coverage threshold check from the GitHub Actions workflow
 */

const fs = require('fs');
const path = require('path');

const COVERAGE_FILE = path.join(process.cwd(), 'coverage', 'coverage-summary.json');
const THRESHOLD = 90;

function checkCoverage() {
  // Check if coverage file exists
  if (!fs.existsSync(COVERAGE_FILE)) {
    console.error('❌ Coverage file not found at:', COVERAGE_FILE);
    console.error('Make sure to run tests with coverage first: pnpm run test:ci');
    process.exit(1);
  }

  let coverage;
  try {
    coverage = JSON.parse(fs.readFileSync(COVERAGE_FILE, 'utf8'));
  } catch (error) {
    console.error('❌ Failed to parse coverage file:', error.message);
    process.exit(1);
  }

  const total = coverage.total;
  
  console.log('📊 Coverage Summary:');
  console.log('Lines:', total.lines.pct + '%');
  console.log('Branches:', total.branches.pct + '%');
  console.log('Functions:', total.functions.pct + '%');
  console.log('Statements:', total.statements.pct + '%');
  
  const failed = [];
  if (total.lines.pct < THRESHOLD) failed.push('Lines');
  if (total.branches.pct < THRESHOLD) failed.push('Branches');
  if (total.functions.pct < THRESHOLD) failed.push('Functions');
  if (total.statements.pct < THRESHOLD) failed.push('Statements');
  
  if (failed.length > 0) {
    console.error('\n❌ Coverage threshold not met for:', failed.join(', '));
    console.error('Required:', THRESHOLD + '%');
    console.error('\nPlease add more tests to meet the coverage requirements.');
    process.exit(1);
  } else {
    console.log('\n✅ All coverage thresholds met!');
    console.log('Required:', THRESHOLD + '%');
  }
}

if (require.main === module) {
  checkCoverage();
}

module.exports = { checkCoverage };
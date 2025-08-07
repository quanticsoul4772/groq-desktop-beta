#!/usr/bin/env node

/**
 * Pipeline Parity - Report Generator
 * Generates comprehensive reports for pipeline parity tests
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

class ReportGenerator {
  constructor(options = {}) {
    this.options = {
      format: 'html', // html, markdown, json, console
      outputPath: null,
      ...options,
    };
  }

  generateReport(results, metadata = {}) {
    const reportData = {
      ...metadata,
      timestamp: new Date().toISOString(),
      results,
      summary: this.generateSummary(results),
      environment: {
        nodeVersion: process.version,
        platform: os.platform(),
        arch: os.arch(),
        cwd: process.cwd(),
        ci: process.env.CI === 'true',
      },
    };

    switch (this.options.format) {
      case 'html':
        return this.generateHTML(reportData);
      case 'markdown':
        return this.generateMarkdown(reportData);
      case 'json':
        return JSON.stringify(reportData, null, 2);
      case 'github':
        return this.generateGitHubSummary(reportData);
      default:
        return this.generateConsole(reportData);
    }
  }

  generateSummary(results) {
    const checks = Object.keys(results);
    const passed = checks.filter((check) => results[check].status === 'success').length;
    const failed = checks.filter((check) => results[check].status === 'failed').length;
    const pending = checks.filter((check) => results[check].status === 'pending').length;

    return {
      total: checks.length,
      passed,
      failed,
      pending,
      success: failed === 0 && pending === 0,
    };
  }

  generateHTML(data) {
    const { results, summary, environment } = data;

    return `
<!DOCTYPE html>
<html>
<head>
    <title>Pipeline Parity Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .summary { display: flex; gap: 20px; margin-bottom: 20px; }
        .metric { background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #28a745; flex: 1; }
        .metric.failed { border-color: #dc3545; }
        .metric.pending { border-color: #ffc107; }
        .section { margin-bottom: 30px; }
        .check { background: white; padding: 15px; border-radius: 8px; margin-bottom: 10px; border-left: 4px solid #e9ecef; }
        .check.success { border-color: #28a745; }
        .check.failed { border-color: #dc3545; }
        .check.pending { border-color: #ffc107; }
        .details { margin-top: 10px; font-family: monospace; background: #f8f9fa; padding: 10px; border-radius: 4px; }
        .status-icon { font-size: 1.2em; margin-right: 8px; }
        .timestamp { color: #6c757d; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔍 Pipeline Parity Report</h1>
        <p class="timestamp">Generated: ${new Date(data.timestamp).toLocaleString()}</p>
        <p>Duration: ${data.duration || 'N/A'}s | Node: ${environment.nodeVersion} | Platform: ${environment.platform}</p>
    </div>
    
    <div class="summary">
        <div class="metric ${summary.success ? 'success' : 'failed'}">
            <h3>Overall Status</h3>
            <p><strong>${summary.success ? '✅ PASSED' : '❌ FAILED'}</strong></p>
        </div>
        <div class="metric">
            <h3>Checks Passed</h3>
            <p><strong>${summary.passed}/${summary.total}</strong></p>
        </div>
        <div class="metric">
            <h3>CI Prediction</h3>
            <p><strong>${summary.success ? 'WILL PASS' : 'WILL FAIL'}</strong></p>
        </div>
    </div>
    
    <div class="section">
        <h2>Check Results</h2>
        ${Object.entries(results)
          .map(
            ([check, result]) => `
            <div class="check ${result.status}">
                <h3>
                    <span class="status-icon">${result.status === 'success' ? '✅' : result.status === 'failed' ? '❌' : '⏳'}</span>
                    ${check.charAt(0).toUpperCase() + check.slice(1)}
                </h3>
                ${
                  result.details && result.details.length > 0
                    ? `
                    <div class="details">
                        ${result.details.map((detail) => `<div>${detail}</div>`).join('')}
                    </div>
                `
                    : ''
                }
            </div>
        `
          )
          .join('')}
    </div>
    
    <div class="section">
        <h2>Environment Information</h2>
        <div class="details">
            <div>Node Version: ${environment.nodeVersion}</div>
            <div>Platform: ${environment.platform} ${environment.arch}</div>
            <div>Working Directory: ${environment.cwd}</div>
            <div>CI Environment: ${environment.ci ? 'Yes' : 'No'}</div>
        </div>
    </div>
</body>
</html>
    `.trim();
  }

  generateMarkdown(data) {
    const { results, summary, environment } = data;

    let markdown = `# 🔍 Pipeline Parity Report\n\n`;
    markdown += `**Generated:** ${new Date(data.timestamp).toLocaleString()}  \n`;
    markdown += `**Duration:** ${data.duration || 'N/A'}s  \n`;
    markdown += `**Node Version:** ${environment.nodeVersion}  \n`;
    markdown += `**Platform:** ${environment.platform} ${environment.arch}  \n\n`;

    // Summary
    markdown += `## Summary\n\n`;
    markdown += `| Metric | Value |\n`;
    markdown += `|--------|-------|\n`;
    markdown += `| Overall Status | ${summary.success ? '✅ PASSED' : '❌ FAILED'} |\n`;
    markdown += `| Checks Passed | ${summary.passed}/${summary.total} |\n`;
    markdown += `| CI Prediction | ${summary.success ? 'WILL PASS' : 'WILL FAIL'} |\n\n`;

    // Check results
    markdown += `## Check Results\n\n`;

    Object.entries(results).forEach(([check, result]) => {
      const icon = result.status === 'success' ? '✅' : result.status === 'failed' ? '❌' : '⏳';
      markdown += `### ${icon} ${check.charAt(0).toUpperCase() + check.slice(1)}\n\n`;

      if (result.details && result.details.length > 0) {
        markdown += `\`\`\`\n${result.details.join('\n')}\n\`\`\`\n\n`;
      }
    });

    // Environment
    markdown += `## Environment\n\n`;
    markdown += `- **Node Version:** ${environment.nodeVersion}\n`;
    markdown += `- **Platform:** ${environment.platform} ${environment.arch}\n`;
    markdown += `- **Working Directory:** ${environment.cwd}\n`;
    markdown += `- **CI Environment:** ${environment.ci ? 'Yes' : 'No'}\n`;

    return markdown;
  }

  generateGitHubSummary(data) {
    const { results, summary } = data;

    let output = `## 🔍 Pipeline Parity Summary\n\n`;
    output += `| Check | Status | Details |\n`;
    output += `|-------|--------|----------|\n`;

    Object.entries(results).forEach(([check, result]) => {
      const status =
        result.status === 'success'
          ? '✅ Passed'
          : result.status === 'failed'
            ? '❌ Failed'
            : '⏳ Pending';
      const details =
        result.details && result.details.length > 0 ? result.details[0] : 'No details';

      output += `| ${check.charAt(0).toUpperCase() + check.slice(1)} | ${status} | ${details} |\n`;
    });

    output += `\n**Overall Result:** ${summary.success ? '✅ PASSED' : '❌ FAILED'}\n`;
    output += `**CI Prediction:** ${summary.success ? 'Build will pass' : 'Build will fail'}\n`;

    if (!summary.success) {
      output += `\n> ⚠️ **Action Required:** Fix the failed checks above before pushing to avoid CI failures.\n`;
    }

    return output;
  }

  generateConsole(data) {
    const { results, summary, environment } = data;

    let output = `\n📊 Pipeline Parity Report\n`;
    output += `=========================\n\n`;

    output += `Generated: ${new Date(data.timestamp).toLocaleString()}\n`;
    output += `Duration: ${data.duration || 'N/A'}s\n`;
    output += `Node: ${environment.nodeVersion} | Platform: ${environment.platform}\n\n`;

    // Summary
    output += `Summary:\n`;
    output += `  Overall: ${summary.success ? '✅ PASSED' : '❌ FAILED'}\n`;
    output += `  Checks: ${summary.passed}/${summary.total} passed\n`;
    output += `  Prediction: CI will ${summary.success ? 'PASS' : 'FAIL'}\n\n`;

    // Results
    Object.entries(results).forEach(([check, result]) => {
      const icon = result.status === 'success' ? '✅' : result.status === 'failed' ? '❌' : '⏳';
      output += `${icon} ${check.charAt(0).toUpperCase() + check.slice(1)}:\n`;

      if (result.details && result.details.length > 0) {
        result.details.forEach((detail) => {
          output += `   ${detail}\n`;
        });
      }
      output += `\n`;
    });

    return output;
  }

  saveReport(content, filename) {
    const outputPath =
      this.options.outputPath || path.join(process.cwd(), '.pipeline-parity', 'reports', filename);

    // Ensure directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(outputPath, content);
    return outputPath;
  }
}

module.exports = ReportGenerator;

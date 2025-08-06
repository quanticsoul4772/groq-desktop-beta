#!/usr/bin/env node

/**
 * Validates that all import/require paths in test files actually exist
 * This prevents broken imports from causing test failures in CI
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Colors for console output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(color, message) {
  console.log(`${color}${message}${colors.reset}`);
}

function findTestFiles(dir) {
  const testFiles = [];
  
  function walkDir(currentPath) {
    const entries = fs.readdirSync(currentPath);
    
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        walkDir(fullPath);
      } else if (entry.endsWith('.test.js')) {
        testFiles.push(fullPath);
      }
    }
  }
  
  walkDir(dir);
  return testFiles;
}

function extractImportPaths(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const imports = [];
  
  // Match require() statements with relative paths
  const requireMatches = content.match(/require\(['"`]([./][^'"`]+)['"`]\)/g);
  if (requireMatches) {
    requireMatches.forEach(match => {
      const pathMatch = match.match(/require\(['"`]([./][^'"`]+)['"`]\)/);
      if (pathMatch) {
        imports.push({
          type: 'require',
          path: pathMatch[1],
          line: content.substring(0, content.indexOf(match)).split('\n').length
        });
      }
    });
  }
  
  // Match import statements with relative paths
  const importMatches = content.match(/import\s+.*\s+from\s+['"`]([./][^'"`]+)['"`]/g);
  if (importMatches) {
    importMatches.forEach(match => {
      const pathMatch = match.match(/from\s+['"`]([./][^'"`]+)['"`]/);
      if (pathMatch) {
        imports.push({
          type: 'import',
          path: pathMatch[1],
          line: content.substring(0, content.indexOf(match)).split('\n').length
        });
      }
    });
  }
  
  return imports;
}

function resolveImportPath(testFilePath, importPath) {
  const testDir = path.dirname(testFilePath);
  const resolvedPath = path.resolve(testDir, importPath);
  
  // Try different file extensions
  const extensions = ['.js', '.jsx', '.ts', '.tsx', ''];
  
  for (const ext of extensions) {
    const fullPath = resolvedPath + ext;
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }
  
  // Try as directory with index file
  for (const ext of ['.js', '.jsx', '.ts', '.tsx']) {
    const indexPath = path.join(resolvedPath, `index${ext}`);
    if (fs.existsSync(indexPath)) {
      return indexPath;
    }
  }
  
  return null;
}

function validateTestImports() {
  const projectRoot = path.resolve(__dirname, '..');
  const testsDir = path.join(projectRoot, '__tests__');
  
  log(colors.blue + colors.bold, '\n🔍 Validating test import paths...\n');
  
  if (!fs.existsSync(testsDir)) {
    log(colors.yellow, '⚠️  No __tests__ directory found, skipping validation');
    return true;
  }
  
  const testFiles = findTestFiles(testsDir);
  let totalImports = 0;
  let brokenImports = 0;
  const issues = [];
  
  for (const testFile of testFiles) {
    const relativePath = path.relative(projectRoot, testFile);
    const imports = extractImportPaths(testFile);
    
    if (imports.length > 0) {
      log(colors.blue, `📄 Checking ${relativePath}:`);
      
      for (const importInfo of imports) {
        totalImports++;
        const resolvedPath = resolveImportPath(testFile, importInfo.path);
        
        if (resolvedPath) {
          const relativeResolvedPath = path.relative(projectRoot, resolvedPath);
          log(colors.green, `  ✅ Line ${importInfo.line}: ${importInfo.path} → ${relativeResolvedPath}`);
        } else {
          brokenImports++;
          const issue = {
            file: relativePath,
            line: importInfo.line,
            path: importInfo.path,
            type: importInfo.type
          };
          issues.push(issue);
          log(colors.red, `  ❌ Line ${importInfo.line}: ${importInfo.path} (FILE NOT FOUND)`);
        }
      }
      
      console.log(''); // Empty line for readability
    }
  }
  
  // Summary
  log(colors.bold, '📊 Summary:');
  log(colors.blue, `  • Test files scanned: ${testFiles.length}`);
  log(colors.blue, `  • Total imports checked: ${totalImports}`);
  
  if (brokenImports === 0) {
    log(colors.green + colors.bold, `  ✅ All imports valid!`);
    return true;
  } else {
    log(colors.red + colors.bold, `  ❌ Broken imports: ${brokenImports}`);
    
    log(colors.red + colors.bold, '\n🚨 Issues found:');
    for (const issue of issues) {
      log(colors.red, `  • ${issue.file}:${issue.line} - ${issue.type}('${issue.path}')`);
    }
    
    log(colors.yellow, '\n💡 To fix these issues:');
    log(colors.yellow, '  1. Check if the file paths are correct');
    log(colors.yellow, '  2. Verify the files exist in the expected locations');
    log(colors.yellow, '  3. Update import paths or create missing files');
    
    return false;
  }
}

// Main execution
if (require.main === module) {
  const success = validateTestImports();
  process.exit(success ? 0 : 1);
}

module.exports = { validateTestImports };
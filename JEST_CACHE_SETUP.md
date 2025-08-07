# Jest Cache Configuration for CI/CD

## Overview

This setup implements Jest cache support in GitHub Actions to improve test execution performance.

## Changes Made

### 1. Jest Configuration (`jest.config.js`)

Added cache configuration:

- `cacheDirectory: '.jest-cache'` - Specifies where Jest stores its cache
- `cache: true` - Enables caching of transform results
- `maxWorkers: '50%'` - Already configured for parallel execution

### 2. GitHub Actions Workflow (`.github/workflows/test.yml`)

Created a new workflow with:

- **pnpm caching**: Uses GitHub Actions cache for pnpm dependencies
- **Jest cache**: Caches the `.jest-cache` directory between workflow runs
- **Cache key strategy**: Based on OS, lock files, and Jest config
- **Cache restoration**: Uses restore-keys for partial cache matches

### 3. Git Ignore (`.gitignore`)

Added entries to prevent caching artifacts from being committed:

- `coverage/` - Test coverage reports
- `.jest-cache/` - Jest transform cache

## How It Works

### Cache Key Strategy

The cache key is composed of:

```
jest-cache-${{ runner.os }}-${{ hashFiles('**/package-lock.json', '**/pnpm-lock.yaml', '**/jest.config.js') }}
```

This ensures cache invalidation when:

- Dependencies change (lock files)
- Jest configuration changes
- Running on different OS

### Cache Restoration

Uses `restore-keys` for graceful fallback:

```
jest-cache-${{ runner.os }}-
```

This allows partial cache restoration even if exact match isn't found.

## Expected Performance Benefits

### Initial Run

- No cache available
- Full transform of all test files
- Baseline performance

### Subsequent Runs (with cache)

- **Transform caching**: 20-40% faster for unchanged files
- **Parallel execution**: Using 50% of available workers
- **Dependency caching**: pnpm modules cached by GitHub Actions

## Monitoring Cache Effectiveness

### In GitHub Actions logs, look for:

1. **Cache restoration**:

   ```
   Cache restored from key: jest-cache-Linux-abc123...
   ```

2. **Cache save**:

   ```
   Cache saved with key: jest-cache-Linux-abc123...
   ```

3. **Test execution time**: Compare run times between cached and non-cached runs

## Best Practices

### 1. Cache Invalidation

- Cache automatically invalidates when dependencies or config changes
- Manual invalidation: Delete `.jest-cache` locally or update workflow cache key version

### 2. Local Development

Run with cache locally:

```bash
pnpm test                 # Uses cache
pnpm test --no-cache     # Bypasses cache
rm -rf .jest-cache       # Clear cache manually
```

### 3. Troubleshooting

If tests behave differently with cache:

1. Clear local cache: `rm -rf .jest-cache`
2. Run tests with `--no-cache` flag
3. Check for test isolation issues

## Integration with Existing Workflows

This `test.yml` workflow complements the existing `test-coverage.yml`:

- **test.yml**: Quick feedback on all pushes and PRs
- **test-coverage.yml**: Comprehensive testing across multiple OS and Node versions

## Performance Metrics

To measure improvement:

1. Note execution time before cache implementation
2. After 2-3 runs with cache, compare times
3. Expected improvement: 20-40% reduction in test execution time

## Maintenance

### Regular Cache Cleanup

GitHub Actions automatically manages cache:

- 10GB limit per repository
- LRU eviction policy
- 7-day retention for unused caches

### Manual Cache Management

If needed, caches can be managed via:

- GitHub UI: Settings → Actions → Caches
- GitHub CLI: `gh cache delete`
- API: GitHub REST API cache endpoints

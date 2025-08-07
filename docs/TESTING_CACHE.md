# Testing with Jest Cache

## Quick Start

### Running Tests with Cache

```bash
# Standard test run (uses cache if available)
pnpm test

# CI test run (with coverage and optimizations)
pnpm test:ci

# Watch mode for development
pnpm test:watch

# Clear Jest cache
pnpm test:clear-cache

# Test cache performance
pnpm test:cache-perf
```

## Cache Performance

The project is configured with Jest caching for improved test performance:

- **Transform caching**: Babel transformations are cached in `.jest-cache/`
- **Parallel execution**: Tests run with 50% of available CPU cores
- **CI optimization**: GitHub Actions caches both dependencies and Jest cache

### Expected Performance Improvements

- **Local development**: 20-40% faster on subsequent runs
- **CI/CD pipeline**: 20-30% faster with warm cache
- **Large test suites**: Greater improvements with more test files

### Testing Cache Effectiveness

Run the performance test script:

```bash
pnpm test:cache-perf
```

This will:

1. Clear existing cache
2. Run tests without cache (cold start)
3. Run tests with cache (warm start)
4. Show performance improvement metrics

## GitHub Actions Integration

The `.github/workflows/test.yml` workflow includes:

- Automatic Jest cache management
- Cache key based on dependencies and config
- Graceful cache restoration with fallback

### Cache Key Strategy

```yaml
key: jest-cache-${{ runner.os }}-${{ hashFiles('**/pnpm-lock.yaml', '**/jest.config.js') }}
```

### Monitoring in CI

Look for these messages in GitHub Actions logs:

- `Cache restored from key: jest-cache-...` - Cache hit
- `Cache not found for key: jest-cache-...` - Cache miss
- `Cache saved with key: jest-cache-...` - Cache saved

## Troubleshooting

### Cache Issues

If tests behave unexpectedly:

```bash
# Clear cache and run tests
pnpm test:clear-cache && pnpm test

# Run without cache
pnpm test --no-cache
```

### Performance Not Improving?

1. Check cache directory exists: `ls -la .jest-cache/`
2. Verify cache is being used: `pnpm test --showConfig | grep cache`
3. Run performance test: `pnpm test:cache-perf`

## Best Practices

1. **Regular cache clearing**: Clear cache after major dependency updates
2. **CI cache management**: GitHub Actions handles this automatically
3. **Local development**: Cache persists between runs for faster iteration
4. **Debugging**: Use `--no-cache` flag when debugging transformation issues

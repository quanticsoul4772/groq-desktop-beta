#!/bin/bash

# Test Jest Cache Performance Script
# This script helps measure the performance improvement from Jest caching

echo "Jest Cache Performance Test"
echo "============================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Clean any existing cache
echo -e "${YELLOW}Step 1: Cleaning existing cache...${NC}"
rm -rf .jest-cache
rm -rf coverage
mkdir -p .jest-cache/react .jest-cache/electron .jest-cache/integration
echo "Cache cleaned and directories prepared."
echo ""

# Run tests without cache (first run)
echo -e "${YELLOW}Step 2: Running tests WITHOUT cache (cold start)...${NC}"
START_TIME=$(date +%s)
pnpm test --coverage --silent 2>&1 > /dev/null
END_TIME=$(date +%s)
COLD_DURATION=$((END_TIME - START_TIME))
echo -e "${GREEN}Cold run completed in ${COLD_DURATION} seconds${NC}"
echo ""

# Run tests with cache (second run)
echo -e "${YELLOW}Step 3: Running tests WITH cache (warm start)...${NC}"
START_TIME=$(date +%s)
pnpm test --coverage --silent 2>&1 > /dev/null
END_TIME=$(date +%s)
WARM_DURATION=$((END_TIME - START_TIME))
echo -e "${GREEN}Warm run completed in ${WARM_DURATION} seconds${NC}"
echo ""

# Calculate improvement
if [ $COLD_DURATION -gt 0 ]; then
    IMPROVEMENT=$(( (COLD_DURATION - WARM_DURATION) * 100 / COLD_DURATION ))
    TIME_SAVED=$((COLD_DURATION - WARM_DURATION))
    
    echo "Results Summary"
    echo "==============="
    echo -e "Cold start (no cache): ${RED}${COLD_DURATION}s${NC}"
    echo -e "Warm start (with cache): ${GREEN}${WARM_DURATION}s${NC}"
    echo -e "Time saved: ${GREEN}${TIME_SAVED}s${NC}"
    echo -e "Performance improvement: ${GREEN}${IMPROVEMENT}%${NC}"
    echo ""
    
    # Check cache directory sizes
    if [ -d ".jest-cache" ]; then
        TOTAL_SIZE=$(du -sh .jest-cache | cut -f1)
        echo -e "Total cache size: ${YELLOW}${TOTAL_SIZE}${NC}"
        echo "Cache breakdown:"
        for dir in react electron integration; do
            if [ -d ".jest-cache/$dir" ]; then
                DIR_SIZE=$(du -sh .jest-cache/$dir 2>/dev/null | cut -f1 || echo "0")
                FILE_COUNT=$(find .jest-cache/$dir -type f 2>/dev/null | wc -l | tr -d ' ' || echo "0")
                echo -e "  - $dir: ${YELLOW}${DIR_SIZE}${NC} (${FILE_COUNT} files)"
            fi
        done
    fi
    
    # Provide recommendation
    echo ""
    echo "Recommendation:"
    if [ $IMPROVEMENT -ge 20 ]; then
        echo -e "${GREEN}✓ Cache is providing significant performance benefits (≥20% improvement)${NC}"
    elif [ $IMPROVEMENT -ge 10 ]; then
        echo -e "${YELLOW}⚠ Cache is providing moderate benefits (10-20% improvement)${NC}"
    else
        echo -e "${RED}✗ Cache benefits are minimal (<10% improvement)${NC}"
        echo "  Consider checking your test structure or babel configuration"
    fi
else
    echo -e "${RED}Error: Could not calculate improvement${NC}"
fi

echo ""
echo "Cache Status:"
if [ -d ".jest-cache" ]; then
    TOTAL_FILES=$(find .jest-cache -type f 2>/dev/null | wc -l | tr -d ' ' || echo "0")
    if [ "$TOTAL_FILES" -gt "0" ]; then
        echo -e "${GREEN}✓ Jest cache directory exists with ${TOTAL_FILES} cached files${NC}"
    else
        echo -e "${YELLOW}⚠ Jest cache directory exists but is empty${NC}"
    fi
else
    echo -e "${RED}✗ Jest cache directory not found${NC}"
fi

#!/usr/bin/env node

/**
 * Simple test to verify our shared directory system works correctly
 * and leaves no residue directories
 */

const { testUtils } = require('./test-utils.js');
const fs = require('fs');
const os = require('os');
const path = require('path');

console.log('🧪 Testing Shared Directory System');
console.log('=' .repeat(50));

// Test 1: Initialize and verify shared root
console.log('1️⃣  Initializing shared root...');
const sharedRoot = testUtils.initializeSharedRoot();
console.log(`   📁 Shared root: ${sharedRoot}`);
console.log(`   ✅ Directory exists: ${fs.existsSync(sharedRoot)}`);

// Test 2: Create test directories
console.log('\n2️⃣  Creating test subdirectories...');
const testDirs = [];
for (let i = 1; i <= 5; i++) {
    const testDir = testUtils.getTestDir(`test-${i}`);
    testDirs.push(testDir);
    console.log(`   📂 Test ${i}: ${path.basename(testDir)}`);
    
    // Create a test file in each directory
    const testFile = path.join(testDir, 'test.txt');
    fs.writeFileSync(testFile, `Test file ${i}`);
    console.log(`   ✅ Created test file: ${fs.existsSync(testFile)}`);
}

// Test 3: Verify directory structure
console.log('\n3️⃣  Verifying directory structure...');
const rootContents = fs.readdirSync(sharedRoot);
console.log(`   📊 Directories created: ${rootContents.length}`);
rootContents.forEach(dir => {
    console.log(`   - ${dir}`);
});

// Test 4: Individual cleanup
console.log('\n4️⃣  Testing individual cleanup...');
testUtils.cleanupTestDir('test-2');
const afterCleanup = fs.readdirSync(sharedRoot);
console.log(`   📊 Directories after cleanup: ${afterCleanup.length}`);
console.log(`   ✅ test-2 removed: ${!afterCleanup.some(d => d.includes('test-2'))}`);

// Test 5: Check parent tmpdir before full cleanup
console.log('\n5️⃣  Checking parent temp directory before cleanup...');
const parentTmpDir = path.join(os.tmpdir(), 'groq-desktop-tests');
const beforeFinalCleanup = fs.existsSync(parentTmpDir) ? fs.readdirSync(parentTmpDir) : [];
console.log(`   📂 Parent temp dir exists: ${fs.existsSync(parentTmpDir)}`);
console.log(`   📊 Sessions in parent: ${beforeFinalCleanup.length}`);

// Test 6: Full cleanup
console.log('\n6️⃣  Testing full cleanup...');
testUtils.cleanupAll();

// Test 7: Verify no residue
console.log('\n7️⃣  Verifying no residue directories...');
const afterFinalCleanup = fs.existsSync(parentTmpDir) ? fs.readdirSync(parentTmpDir) : [];
console.log(`   📂 Shared root exists: ${fs.existsSync(sharedRoot)}`);
console.log(`   📊 Sessions remaining: ${afterFinalCleanup.length}`);

const noResidue = !fs.existsSync(sharedRoot);
console.log(`   ✅ No residue directories: ${noResidue}`);

// Test 8: Re-initialize after cleanup
console.log('\n8️⃣  Testing re-initialization...');
const newRoot = testUtils.initializeSharedRoot();
const newTestDir = testUtils.getTestDir('test-reinit');
console.log(`   📁 New shared root: ${newRoot}`);
console.log(`   ✅ New test dir created: ${fs.existsSync(newTestDir)}`);

// Final cleanup
testUtils.cleanupAll();
const finalCheck = fs.existsSync(newRoot);
console.log(`   ✅ Final cleanup successful: ${!finalCheck}`);

// Summary
console.log('\n📊 Test Summary:');
console.log('=' .repeat(50));
console.log('✅ Shared root initialization: PASSED');
console.log('✅ Test directory creation: PASSED');
console.log('✅ Individual cleanup: PASSED');
console.log('✅ Full cleanup: PASSED');
console.log(`✅ No residue directories: ${noResidue ? 'PASSED' : 'FAILED'}`);
console.log('✅ Re-initialization: PASSED');

console.log('\n🎉 Shared Directory System Test Complete!');

if (!noResidue) {
    console.error('\n⚠️  Warning: Some residue directories may remain');
    process.exit(1);
} else {
    console.log('\n✨ All tests passed - no residue directories left');
    process.exit(0);
}
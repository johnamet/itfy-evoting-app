#!/usr/bin/env node
/**
 * Test Level-Based Authorization
 * 
 * Tests the level-based authorization middleware to ensure it works correctly
 * across different user levels and operations.
 */

import { authenticate, requireLevel, requireCreate, requireRead, requireUpdate, requireDelete } from './app/middleware/auth.js';

// Mock request and response objects
const createMockReq = (userLevel, userId = 'test-user-123') => ({
    headers: {
        'x-dev-user-id': userId,
        'x-dev-user-level': userLevel.toString()
    },
    user: null,
    userId: null
});

const createMockRes = () => {
    const res = {
        status: function(code) { 
            this.statusCode = code; 
            return this; 
        },
        json: function(data) { 
            this.jsonData = data; 
            return this; 
        },
        statusCode: 200,
        jsonData: null
    };
    return res;
};

const createMockNext = () => {
    let called = false;
    const next = () => { called = true; };
    next.wasCalled = () => called;
    return next;
};

// Test function
const testAuthorization = async (middleware, userLevel, expectedResult, operation = '') => {
    const req = createMockReq(userLevel);
    const res = createMockRes();
    const next = createMockNext();

    // First authenticate the user
    await new Promise((resolve) => {
        authenticate(req, res, () => {
            resolve();
        });
    });

    // Then test the authorization middleware
    await new Promise((resolve) => {
        middleware(req, res, () => {
            resolve();
        });
    });

    const success = next.wasCalled() && res.statusCode !== 401 && res.statusCode !== 403;
    const description = operation ? `${operation} operation` : 'access';
    
    console.log(`Level ${userLevel} ${description}: ${success ? '✅ ALLOWED' : '❌ DENIED'} ${success === expectedResult ? '(CORRECT)' : '(INCORRECT)'}`);
    
    if (!success && res.jsonData) {
        console.log(`  Error: ${res.jsonData.message}`);
    }
    
    return success === expectedResult;
};

// Run tests
console.log('🧪 Testing Level-Based Authorization System\n');
console.log('Level System:');
console.log('- Level 1: Read only (R)');
console.log('- Level 2: Read, Update (RU)');
console.log('- Level 3: Create, Read, Update (CRU)');
console.log('- Level 4: Create, Read, Update, Delete (CRUD)\n');

const runTests = async () => {
    // Set NODE_ENV to development for testing
    process.env.NODE_ENV = 'development';
    
    let passedTests = 0;
    let totalTests = 0;

    const tests = [
        // Level 1 tests (Read only)
        [requireRead, 1, true, 'Read'],
        [requireUpdate, 1, false, 'Update'],
        [requireCreate, 1, false, 'Create'],
        [requireDelete, 1, false, 'Delete'],
        
        // Level 2 tests (Read, Update)
        [requireRead, 2, true, 'Read'],
        [requireUpdate, 2, true, 'Update'],
        [requireCreate, 2, false, 'Create'],
        [requireDelete, 2, false, 'Delete'],
        
        // Level 3 tests (Create, Read, Update)
        [requireRead, 3, true, 'Read'],
        [requireUpdate, 3, true, 'Update'],
        [requireCreate, 3, true, 'Create'],
        [requireDelete, 3, false, 'Delete'],
        
        // Level 4 tests (Create, Read, Update, Delete)
        [requireRead, 4, true, 'Read'],
        [requireUpdate, 4, true, 'Update'],
        [requireCreate, 4, true, 'Create'],
        [requireDelete, 4, true, 'Delete'],
        
        // Specific level requirements
        [requireLevel(3), 2, false, 'Level 3+ access'],
        [requireLevel(3), 3, true, 'Level 3+ access'],
        [requireLevel(3), 4, true, 'Level 3+ access'],
        [requireLevel(4), 3, false, 'Level 4+ access'],
        [requireLevel(4), 4, true, 'Level 4+ access'],
    ];

    console.log('Running authorization tests...\n');

    for (const [middleware, userLevel, expectedResult, operation] of tests) {
        totalTests++;
        const result = await testAuthorization(middleware, userLevel, expectedResult, operation);
        if (result) passedTests++;
    }

    console.log(`\n📊 Test Results: ${passedTests}/${totalTests} tests passed`);
    
    if (passedTests === totalTests) {
        console.log('🎉 All authorization tests passed! Level-based system is working correctly.');
    } else {
        console.log('❌ Some tests failed. Please review the authorization implementation.');
    }
    
    return passedTests === totalTests;
};

// Run the tests
runTests().then(success => {
    process.exit(success ? 0 : 1);
}).catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
});

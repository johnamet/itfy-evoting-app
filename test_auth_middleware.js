#!/usr/bin/env node
/**
 * Test script for authentication middleware
 * Tests level-based authorization system
 */

import { 
    authenticate, 
    requireLevel, 
    requireCreate, 
    requireRead, 
    requireUpdate, 
    requireDelete,
    requireOperations,
    generateToken 
} from './app/middleware/auth.js';

// Mock request and response objects
const createMockReq = (user = null, headers = {}) => ({
    user,
    headers,
    userId: user?.id
});

const createMockRes = () => {
    const res = {
        statusCode: 200,
        json: (data) => {
            res.data = data;
            return res;
        },
        status: (code) => {
            res.statusCode = code;
            return res;
        }
    };
    return res;
};

const mockNext = () => console.log('✓ Middleware passed - next() called');

// Test users with different levels
const testUsers = {
    readOnly: { id: '1', email: 'read@test.com', role: 'user', roleLevel: 1 },
    readUpdate: { id: '2', email: 'update@test.com', role: 'user', roleLevel: 2 },
    createReadUpdate: { id: '3', email: 'create@test.com', role: 'moderator', roleLevel: 3 },
    fullAccess: { id: '4', email: 'admin@test.com', role: 'admin', roleLevel: 4 }
};

console.log('🔐 Testing Level-Based Authentication Middleware');
console.log('===============================================\n');

// Test 1: Level requirements
console.log('📊 Test 1: Level Requirements');
console.log('-----------------------------');

const testLevel = (user, requiredLevel, shouldPass) => {
    const req = createMockReq(user);
    const res = createMockRes();
    const middleware = requireLevel(requiredLevel);
    
    console.log(`Testing user level ${user.roleLevel} against required level ${requiredLevel}:`);
    
    middleware(req, res, () => {
        if (shouldPass) {
            console.log(`✓ PASS: User level ${user.roleLevel} can access level ${requiredLevel}\n`);
        } else {
            console.log(`❌ UNEXPECTED: User level ${user.roleLevel} should NOT access level ${requiredLevel}\n`);
        }
    });
    
    if (res.statusCode === 403 && !shouldPass) {
        console.log(`✓ PASS: User level ${user.roleLevel} correctly blocked from level ${requiredLevel}`);
        console.log(`   Message: ${res.data.message}\n`);
    } else if (res.statusCode === 403 && shouldPass) {
        console.log(`❌ FAIL: User level ${user.roleLevel} incorrectly blocked from level ${requiredLevel}`);
        console.log(`   Message: ${res.data.message}\n`);
    }
};

// Test level 1 (read only) access
testLevel(testUsers.readOnly, 1, true);  // Should pass
testLevel(testUsers.readOnly, 2, false); // Should fail
testLevel(testUsers.readOnly, 3, false); // Should fail
testLevel(testUsers.readOnly, 4, false); // Should fail

// Test level 2 (read/update) access
testLevel(testUsers.readUpdate, 1, true);  // Should pass
testLevel(testUsers.readUpdate, 2, true);  // Should pass
testLevel(testUsers.readUpdate, 3, false); // Should fail
testLevel(testUsers.readUpdate, 4, false); // Should fail

// Test level 3 (create/read/update) access
testLevel(testUsers.createReadUpdate, 1, true); // Should pass
testLevel(testUsers.createReadUpdate, 2, true); // Should pass
testLevel(testUsers.createReadUpdate, 3, true); // Should pass
testLevel(testUsers.createReadUpdate, 4, false); // Should fail

// Test level 4 (full access) access
testLevel(testUsers.fullAccess, 1, true); // Should pass
testLevel(testUsers.fullAccess, 2, true); // Should pass
testLevel(testUsers.fullAccess, 3, true); // Should pass
testLevel(testUsers.fullAccess, 4, true); // Should pass

// Test 2: Operation-specific middleware
console.log('\n🔧 Test 2: Operation-Specific Middleware');
console.log('----------------------------------------');

const testOperation = (user, operation, middleware, shouldPass) => {
    const req = createMockReq(user);
    const res = createMockRes();
    
    console.log(`Testing ${operation} operation for user level ${user.roleLevel}:`);
    
    middleware(req, res, () => {
        if (shouldPass) {
            console.log(`✓ PASS: User level ${user.roleLevel} can perform ${operation}\n`);
        } else {
            console.log(`❌ UNEXPECTED: User level ${user.roleLevel} should NOT perform ${operation}\n`);
        }
    });
    
    if (res.statusCode === 403 && !shouldPass) {
        console.log(`✓ PASS: User level ${user.roleLevel} correctly blocked from ${operation}`);
        console.log(`   Message: ${res.data.message}\n`);
    } else if (res.statusCode === 403 && shouldPass) {
        console.log(`❌ FAIL: User level ${user.roleLevel} incorrectly blocked from ${operation}`);
        console.log(`   Message: ${res.data.message}\n`);
    }
};

// Test read operations (level 1+)
testOperation(testUsers.readOnly, 'read', requireRead(), true);
testOperation(testUsers.readUpdate, 'read', requireRead(), true);
testOperation(testUsers.createReadUpdate, 'read', requireRead(), true);
testOperation(testUsers.fullAccess, 'read', requireRead(), true);

// Test update operations (level 2+)
testOperation(testUsers.readOnly, 'update', requireUpdate(), false);
testOperation(testUsers.readUpdate, 'update', requireUpdate(), true);
testOperation(testUsers.createReadUpdate, 'update', requireUpdate(), true);
testOperation(testUsers.fullAccess, 'update', requireUpdate(), true);

// Test create operations (level 3+)
testOperation(testUsers.readOnly, 'create', requireCreate(), false);
testOperation(testUsers.readUpdate, 'create', requireCreate(), false);
testOperation(testUsers.createReadUpdate, 'create', requireCreate(), true);
testOperation(testUsers.fullAccess, 'create', requireCreate(), true);

// Test delete operations (level 4 only)
testOperation(testUsers.readOnly, 'delete', requireDelete(), false);
testOperation(testUsers.readUpdate, 'delete', requireDelete(), false);
testOperation(testUsers.createReadUpdate, 'delete', requireDelete(), false);
testOperation(testUsers.fullAccess, 'delete', requireDelete(), true);

// Test 3: Multiple operations
console.log('\n🔄 Test 3: Multiple Operations Middleware');
console.log('----------------------------------------');

const testMultipleOps = (user, operations, minLevel, shouldPass) => {
    const req = createMockReq(user);
    const res = createMockRes();
    const middleware = requireOperations(operations, minLevel);
    
    console.log(`Testing operations [${operations.join(', ')}] for user level ${user.roleLevel}:`);
    
    middleware(req, res, () => {
        if (shouldPass) {
            console.log(`✓ PASS: User level ${user.roleLevel} can perform [${operations.join(', ')}]\n`);
        } else {
            console.log(`❌ UNEXPECTED: User level ${user.roleLevel} should NOT perform [${operations.join(', ')}]\n`);
        }
    });
    
    if (res.statusCode === 403 && !shouldPass) {
        console.log(`✓ PASS: User level ${user.roleLevel} correctly blocked from [${operations.join(', ')}]`);
        console.log(`   Message: ${res.data.message}\n`);
    }
};

// Test combinations
testMultipleOps(testUsers.readOnly, ['read'], 1, true);
testMultipleOps(testUsers.readOnly, ['read', 'update'], 2, false);
testMultipleOps(testUsers.readUpdate, ['read', 'update'], 2, true);
testMultipleOps(testUsers.readUpdate, ['create', 'read', 'update'], 3, false);
testMultipleOps(testUsers.createReadUpdate, ['create', 'read', 'update'], 3, true);
testMultipleOps(testUsers.createReadUpdate, ['create', 'read', 'update', 'delete'], 4, false);
testMultipleOps(testUsers.fullAccess, ['create', 'read', 'update', 'delete'], 4, true);

console.log('\n✅ Authentication middleware testing complete!');
console.log('\n📋 Summary:');
console.log('- Level 1: Read only (R)');
console.log('- Level 2: Read and Update (RU)');
console.log('- Level 3: Create, Read, Update (CRU)');
console.log('- Level 4: Create, Read, Update, Delete (CRUD)');

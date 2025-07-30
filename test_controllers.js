#!/usr/bin/env node
/**
 * Test script to verify all controllers and their methods
 */

import ActivityController from './app/controllers/ActivityController.js';
import AuthController from './app/controllers/AuthController.js';
import BaseController from './app/controllers/BaseController.js';
import CacheController from './app/controllers/CacheController.js';
import CandidateController from './app/controllers/CandidateController.js';
import CategoryController from './app/controllers/CategoryController.js';
import CouponController from './app/controllers/CouponController.js';
import EventController from './app/controllers/EventController.js';
import FileController from './app/controllers/FileController.js';
import FormController from './app/controllers/FormController.js';
import SlideController from './app/controllers/SlideController.js';
import UserController from './app/controllers/UserController.js';
import VotingController from './app/controllers/VotingController.js';

console.log('🚀 Starting controller verification...\n');

// Test helper function
function testControllerInstantiation(ControllerClass, name) {
    try {
        const controller = new ControllerClass();
        console.log(`✅ ${name} instantiated successfully`);
        return controller;
    } catch (error) {
        console.log(`❌ ${name} instantiation failed:`, error.message);
        return null;
    }
}

function testControllerMethods(controller, name, expectedMethods) {
    console.log(`\n📋 Testing ${name} methods:`);
    let methodCount = 0;
    let successCount = 0;

    expectedMethods.forEach(method => {
        methodCount++;
        if (typeof controller[method] === 'function') {
            console.log(`  ✅ ${method}`);
            successCount++;
        } else {
            console.log(`  ❌ ${method} - method missing`);
        }
    });

    console.log(`📊 ${name}: ${successCount}/${methodCount} methods found`);
    return successCount === methodCount;
}

// Test all controllers
console.log('🔧 Testing controller instantiation:\n');

const controllers = {
    ActivityController: {
        class: ActivityController,
        methods: [
            'getActivities', 'getActivityById', 'getActivitiesByUser', 
            'getActivitiesByEntity', 'logActivity', 'getActivityStats',
            'getRecentActivities', 'exportActivityLog', 'cleanupOldActivities',
            'getActivityTypes'
        ]
    },
    AuthController: {
        class: AuthController,
        methods: [
            'register', 'login', 'logout', 'getProfile', 'updateProfile',
            'changePassword', 'forgotPassword', 'resetPassword', 'refreshToken'
        ]
    },
    BaseController: {
        class: BaseController,
        methods: [
            'sendSuccess', 'sendError', 'handleError'
        ]
    },
    CacheController: {
        class: CacheController,
        methods: [
            'getCacheStats', 'clearAllCaches', 'clearCacheByType', 'clearCacheByPattern',
            'invalidateUserCache', 'invalidateEventCache', 'getCacheHealth',
            'warmUpCaches', 'getCacheConfig', 'updateCacheConfig', 'getCacheKeys',
            'getCachedValue', 'deleteCacheKey'
        ]
    },
    CandidateController: {
        class: CandidateController,
        methods: [
            'createCandidate', 'getCandidates', 'getCandidateById', 'updateCandidate',
            'deleteCandidate', 'getCandidatesByEvent', 'getCandidatesByCategory',
            'getCandidateVoteCount', 'uploadCandidateImage', 'updateCandidateStatus',
            'getCandidateStats'
        ]
    },
    CategoryController: {
        class: CategoryController,
        methods: [
            'createCategory', 'getCategories', 'getCategoryById', 'updateCategory',
            'deleteCategory', 'getCategoriesByEvent', 'updateCategoryStatus',
            'getCategoryStats', 'reorderCategories'
        ]
    },
    CouponController: {
        class: CouponController,
        methods: [
            'createCoupon', 'getCoupons', 'getCouponById', 'getCouponByCode',
            'updateCoupon', 'deleteCoupon', 'validateCoupon', 'useCoupon',
            'getCouponStats', 'getCouponUsageHistory', 'generateBulkCoupons',
            'updateCouponStatus', 'exportCoupons'
        ]
    },
    EventController: {
        class: EventController,
        methods: [
            'createEvent', 'getEvents', 'getEventById', 'updateEvent', 'deleteEvent',
            'getEventStats', 'getEventParticipants', 'registerForEvent',
            'unregisterFromEvent', 'updateEventStatus', 'getUpcomingEvents',
            'getPastEvents'
        ]
    },
    FileController: {
        class: FileController,
        methods: [
            'uploadFile', 'uploadMultipleFiles', 'getFileById', 'downloadFile',
            'getFiles', 'getFilesByEntity', 'updateFileMetadata', 'deleteFile',
            'getFileThumbnail', 'getStorageStats', 'cleanupTempFiles',
            'validateFile', 'generateDownloadLink'
        ]
    },
    FormController: {
        class: FormController,
        methods: [
            'createForm', 'getForms', 'getFormById', 'updateForm', 'deleteForm',
            'submitForm', 'getFormSubmissions', 'exportFormSubmissions',
            'duplicateForm', 'updateFormStatus', 'getFormAnalytics',
            'getFormsByModel', 'getFormByModelAndModelID', 'createFormForModel'
        ]
    },
    SlideController: {
        class: SlideController,
        methods: [
            'createSlide', 'getSlides', 'getSlideById', 'updateSlide', 'deleteSlide',
            'getSlidesByEvent', 'reorderSlides', 'uploadSlideMedia', 'updateSlideStatus',
            'duplicateSlide', 'getSlidePreview'
        ]
    },
    UserController: {
        class: UserController,
        methods: [
            'getUsers', 'getUserById', 'updateUser', 'deleteUser', 'updateUserRole',
            'updateUserStatus', 'getUserActivity', 'uploadAvatar', 'getUserStats',
            'searchUsers', 'getUsersByRole', 'bulkUpdateUsers',
            // Role management methods
            'getRoles', 'createRole', 'getRoleById', 'updateRole', 'deleteRole',
            'getRolePermissions', 'updateRolePermissions', 'assignRoleToUser',
            'removeRoleFromUser', 'getUserRoles'
        ]
    },
    VotingController: {
        class: VotingController,
        methods: [
            'castVote', 'getEventResults', 'getCategoryResults', 'getUserVotingHistory',
            'checkVotingEligibility', 'getVoteBundle', 'createVoteBundle',
            'getVotingStats', 'verifyVote', 'getVotingUpdates', 'exportResults',
            'auditVoting'
        ]
    }
};

let totalControllers = 0;
let successfulControllers = 0;
let totalMethods = 0;
let successfulMethods = 0;

Object.entries(controllers).forEach(([name, config]) => {
    totalControllers++;
    const controller = testControllerInstantiation(config.class, name);
    
    if (controller) {
        successfulControllers++;
        const methodsSuccess = testControllerMethods(controller, name, config.methods);
        totalMethods += config.methods.length;
        
        // Count successful methods
        config.methods.forEach(method => {
            if (typeof controller[method] === 'function') {
                successfulMethods++;
            }
        });
    }
});

console.log('\n' + '='.repeat(60));
console.log('📊 CONTROLLER VERIFICATION SUMMARY');
console.log('='.repeat(60));
console.log(`Controllers: ${successfulControllers}/${totalControllers} instantiated successfully`);
console.log(`Methods: ${successfulMethods}/${totalMethods} methods found`);

if (successfulControllers === totalControllers && successfulMethods === totalMethods) {
    console.log('\n🎉 ALL CONTROLLERS VERIFIED SUCCESSFULLY!');
    console.log('\n✨ Your e-voting application controllers are ready!');
    console.log('\n📋 Available controller features:');
    console.log('  🔐 Authentication & User Management');
    console.log('  👥 Role & Permission Management');
    console.log('  📊 Event Management');
    console.log('  👥 Candidate Management');
    console.log('  🏷️  Category Management');
    console.log('  🗳️  Voting Operations');
    console.log('  📁 File Management');
    console.log('  📝 Form Management');
    console.log('  🎨 Slide Management');
    console.log('  🎫 Coupon Management');
    console.log('  💾 Cache Management');
    console.log('  📈 Activity Logging & Audit');
    console.log('\n🚀 Ready to handle comprehensive e-voting operations!');
} else {
    console.log('\n⚠️  Some issues found. Please check the errors above.');
    process.exit(1);
}

console.log('\n' + '='.repeat(60));

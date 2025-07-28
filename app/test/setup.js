#!/usr/bin/env node

/**
 * Jest test setup file
 * Configures test environment and database for all tests
 */

import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import chai from 'chai';
import sinonChai from 'chai-sinon';

// Configure chai with sinon support
chai.use(sinonChai);

let mongoServer;

// Setup before all tests
beforeAll(async () => {
    // Start in-memory MongoDB instance
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    
    // Connect to the in-memory database
    await mongoose.connect(mongoUri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    });
});

// Cleanup after each test
afterEach(async () => {
    // Clear all collections after each test
    const collections = mongoose.connection.collections;
    for (const key in collections) {
        const collection = collections[key];
        await collection.deleteMany({});
    }
});

// Cleanup after all tests
afterAll(async () => {
    // Close database connection
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    
    // Stop the in-memory MongoDB instance
    await mongoServer.stop();
});

// Global test configuration
// Remove jest.setTimeout since it's not available in ES modules
// Individual tests can set their own timeout if needed
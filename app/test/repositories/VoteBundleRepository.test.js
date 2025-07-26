#!/usr/bin/env node
/**
 * VoteBundle Repository test suite
 * This file contains tests for the VoteBundleRepository class, ensuring that it correctly manages vote bundle operations.
 */
import { expect } from 'chai';
import sinon from 'sinon';
import mongoose from 'mongoose';
import VoteBundleRepository from '../../repositories/VoteBundleRepository.js';
import { after, afterEach, beforeEach, describe, it } from 'mocha';

describe('VoteBundleRepository', () => {
    let voteBundleRepository;
    let sandbox;
    let voteBundle;
    let eventIds;
    let categoryIds;
    let userId;
    let couponIds;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        voteBundleRepository = new VoteBundleRepository();
        
        eventIds = [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()];
        categoryIds = [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()];
        userId = new mongoose.Types.ObjectId();
        couponIds = [new mongoose.Types.ObjectId()];
        
        voteBundle = {
            _id: new mongoose.Types.ObjectId(),
            name: 'Basic Vote Bundle',
            description: 'Perfect for small campaigns',
            votes: 100,
            price: 25.99,
            currency: 'GHS',
            popular: true,
            isActive: true,
            features: ['Email Support', 'Basic Analytics'],
            createdBy: userId,
            applicableEvents: eventIds,
            applicableCategories: categoryIds,
            applicableCoupons: couponIds
        };
    });

    afterEach(() => {
        sandbox.restore();
    });

    after(() => {
        mongoose.connection.close();
    });

    describe('Create vote bundle', () => {
        it('should create a new vote bundle with valid data', async () => {
            sandbox.stub(voteBundleRepository, 'createBundle').resolves(voteBundle);
            
            const result = await voteBundleRepository.createBundle(voteBundle);
            
            expect(result).to.have.property('_id');
            expect(result.name).to.equal('Basic Vote Bundle');
            expect(result.votes).to.equal(100);
            expect(result.price).to.equal(25.99);
            expect(result.currency).to.equal('GHS');
            expect(result.isActive).to.be.true;
        });

        it('should normalize features array during creation', async () => {
            const bundleWithStringFeature = {
                ...voteBundle,
                features: 'Single Feature'
            };
            const normalizedBundle = {
                ...bundleWithStringFeature,
                features: ['Single Feature']
            };
            
            sandbox.stub(voteBundleRepository, 'createBundle').resolves(normalizedBundle);
            
            const result = await voteBundleRepository.createBundle(bundleWithStringFeature);
            
            expect(result.features).to.be.an('array');
            expect(result.features).to.include('Single Feature');
        });

        it('should set default currency to GHS if not provided', async () => {
            const bundleWithoutCurrency = { ...voteBundle };
            delete bundleWithoutCurrency.currency;
            const bundleWithDefaultCurrency = { ...bundleWithoutCurrency, currency: 'GHS' };
            
            sandbox.stub(voteBundleRepository, 'createBundle').resolves(bundleWithDefaultCurrency);
            
            const result = await voteBundleRepository.createBundle(bundleWithoutCurrency);
            
            expect(result.currency).to.equal('GHS');
        });

        it('should throw error for invalid bundle data', async () => {
            const invalidBundle = { name: '', votes: -5, price: -10 };
            
            sandbox.stub(voteBundleRepository, 'createBundle').throws(new Error('Name is required'));
            
            try {
                await voteBundleRepository.createBundle(invalidBundle);
            } catch (error) {
                expect(error.message).to.include('Name is required');
            }
        });
    });

    describe('Find by popularity', () => {
        it('should find popular bundles', async () => {
            const popularBundles = [voteBundle, { ...voteBundle, _id: new mongoose.Types.ObjectId() }];
            sandbox.stub(voteBundleRepository, 'findByPopularity').resolves(popularBundles);
            
            const result = await voteBundleRepository.findByPopularity(true);
            
            expect(result).to.be.an('array');
            expect(result).to.have.length(2);
            expect(result[0].popular).to.be.true;
        });

        it('should find non-popular bundles', async () => {
            const nonPopularBundle = { ...voteBundle, popular: false };
            sandbox.stub(voteBundleRepository, 'findByPopularity').resolves([nonPopularBundle]);
            
            const result = await voteBundleRepository.findByPopularity(false);
            
            expect(result).to.be.an('array');
            expect(result[0].popular).to.be.false;
        });

        it('should only return active bundles', async () => {
            const activeBundles = [voteBundle];
            sandbox.stub(voteBundleRepository, 'findByPopularity').resolves(activeBundles);
            
            const result = await voteBundleRepository.findByPopularity(true);
            
            expect(result[0].isActive).to.be.true;
        });
    });

    describe('Find by price range', () => {
        it('should find bundles within price range', async () => {
            const bundlesInRange = [voteBundle];
            sandbox.stub(voteBundleRepository, 'findByPriceRange').resolves(bundlesInRange);
            
            const result = await voteBundleRepository.findByPriceRange(20.00, 30.00);
            
            expect(result).to.be.an('array');
            expect(result[0].price).to.be.at.least(20.00);
            expect(result[0].price).to.be.at.most(30.00);
        });

        it('should filter by currency when specified', async () => {
            const ghsBundles = [voteBundle];
            sandbox.stub(voteBundleRepository, 'findByPriceRange').resolves(ghsBundles);
            
            const result = await voteBundleRepository.findByPriceRange(20.00, 30.00, 'GHS');
            
            expect(result[0].currency).to.equal('GHS');
        });

        it('should return empty array if no bundles in range', async () => {
            sandbox.stub(voteBundleRepository, 'findByPriceRange').resolves([]);
            
            const result = await voteBundleRepository.findByPriceRange(100.00, 200.00);
            
            expect(result).to.be.an('array');
            expect(result).to.have.length(0);
        });
    });

    describe('Find by vote range', () => {
        it('should find bundles with minimum vote count', async () => {
            const bundlesWithVotes = [voteBundle];
            sandbox.stub(voteBundleRepository, 'findByVoteRange').resolves(bundlesWithVotes);
            
            const result = await voteBundleRepository.findByVoteRange(50);
            
            expect(result[0].votes).to.be.at.least(50);
        });

        it('should find bundles within vote range', async () => {
            const bundlesInVoteRange = [voteBundle];
            sandbox.stub(voteBundleRepository, 'findByVoteRange').resolves(bundlesInVoteRange);
            
            const result = await voteBundleRepository.findByVoteRange(50, 150);
            
            expect(result[0].votes).to.be.at.least(50);
            expect(result[0].votes).to.be.at.most(150);
        });
    });

    describe('Find by event', () => {
        it('should find bundles applicable to specific event', async () => {
            const eventBundles = [voteBundle];
            sandbox.stub(voteBundleRepository, 'findByEvent').resolves(eventBundles);
            
            const result = await voteBundleRepository.findByEvent(eventIds[0]);
            
            expect(result).to.be.an('array');
            expect(result[0].applicableEvents).to.include(eventIds[0]);
        });

        it('should populate related data when finding by event', async () => {
            const populatedBundle = {
                ...voteBundle,
                applicableEvents: [{ _id: eventIds[0], name: 'Summer Campaign', status: 'active' }],
                applicableCategories: [{ _id: categoryIds[0], name: 'Politics' }],
                createdBy: { _id: userId, name: 'John Admin', email: 'john@admin.com' }
            };
            
            sandbox.stub(voteBundleRepository, 'findByEvent').resolves([populatedBundle]);
            
            const result = await voteBundleRepository.findByEvent(eventIds[0]);
            
            expect(result[0].applicableEvents[0]).to.have.property('name', 'Summer Campaign');
            expect(result[0].createdBy).to.have.property('name', 'John Admin');
        });
    });

    describe('Find by category', () => {
        it('should find bundles applicable to specific category', async () => {
            const categoryBundles = [voteBundle];
            sandbox.stub(voteBundleRepository, 'findByCategory').resolves(categoryBundles);
            
            const result = await voteBundleRepository.findByCategory(categoryIds[0]);
            
            expect(result[0].applicableCategories).to.include(categoryIds[0]);
        });
    });

    describe('Find by event and category', () => {
        it('should find bundles applicable to both event and category', async () => {
            const specificBundles = [voteBundle];
            sandbox.stub(voteBundleRepository, 'findByEventAndCategory').resolves(specificBundles);
            
            const result = await voteBundleRepository.findByEventAndCategory(eventIds[0], categoryIds[0]);
            
            expect(result[0].applicableEvents).to.include(eventIds[0]);
            expect(result[0].applicableCategories).to.include(categoryIds[0]);
        });
    });

    describe('Find by creator', () => {
        it('should find bundles created by specific user', async () => {
            const userBundles = [voteBundle];
            sandbox.stub(voteBundleRepository, 'findByCreator').resolves(userBundles);
            
            const result = await voteBundleRepository.findByCreator(userId);
            
            expect(result[0].createdBy).to.equal(userId);
        });
    });

    describe('Find by features', () => {
        it('should find bundles with specific features', async () => {
            const featuredBundles = [voteBundle];
            sandbox.stub(voteBundleRepository, 'findByFeatures').resolves(featuredBundles);
            
            const result = await voteBundleRepository.findByFeatures(['Email Support']);
            
            expect(result[0].features).to.include('Email Support');
        });

        it('should handle single feature as string', async () => {
            const featuredBundles = [voteBundle];
            sandbox.stub(voteBundleRepository, 'findByFeatures').resolves(featuredBundles);
            
            const result = await voteBundleRepository.findByFeatures('Email Support');
            
            expect(result[0].features).to.include('Email Support');
        });
    });

    describe('Find active/inactive bundles', () => {
        it('should find only active bundles', async () => {
            const activeBundles = [voteBundle];
            sandbox.stub(voteBundleRepository, 'findActive').resolves(activeBundles);
            
            const result = await voteBundleRepository.findActive();
            
            expect(result[0].isActive).to.be.true;
        });

        it('should find only inactive bundles', async () => {
            const inactiveBundle = { ...voteBundle, isActive: false };
            sandbox.stub(voteBundleRepository, 'findInactive').resolves([inactiveBundle]);
            
            const result = await voteBundleRepository.findInactive();
            
            expect(result[0].isActive).to.be.false;
        });
    });

    describe('Find coupon eligible bundles', () => {
        it('should find bundles with applicable coupons', async () => {
            const couponEligibleBundles = [voteBundle];
            sandbox.stub(voteBundleRepository, 'findCouponEligible').resolves(couponEligibleBundles);
            
            const result = await voteBundleRepository.findCouponEligible();
            
            expect(result[0].applicableCoupons).to.not.be.empty;
        });

        it('should include bundles above minimum price threshold', async () => {
            const expensiveBundle = { ...voteBundle, applicableCoupons: [], price: 15.00 };
            sandbox.stub(voteBundleRepository, 'findCouponEligible').resolves([expensiveBundle]);
            
            const result = await voteBundleRepository.findCouponEligible();
            
            expect(result[0].price).to.be.at.least(10);
        });
    });

    describe('Get best value bundles', () => {
        it('should calculate and return best value bundles', async () => {
            const bestValueBundles = [
                { ...voteBundle, valueRatio: 3.85 }, // 100 votes / 25.99 price
                { ...voteBundle, _id: new mongoose.Types.ObjectId(), votes: 50, price: 15.99, valueRatio: 3.13 }
            ];
            
            sandbox.stub(voteBundleRepository, 'getBestValueBundles').resolves(bestValueBundles);
            
            const result = await voteBundleRepository.getBestValueBundles(2);
            
            expect(result).to.have.length(2);
            expect(result[0].valueRatio).to.be.greaterThan(result[1].valueRatio);
        });

        it('should filter by currency when specified', async () => {
            const ghsBestValue = [{ ...voteBundle, valueRatio: 3.85, currency: 'GHS' }];
            sandbox.stub(voteBundleRepository, 'getBestValueBundles').resolves(ghsBestValue);
            
            const result = await voteBundleRepository.getBestValueBundles(5, 'GHS');
            
            expect(result[0].currency).to.equal('GHS');
        });
    });

    describe('Update pricing', () => {
        it('should update bundle price successfully', async () => {
            const updatedBundle = { ...voteBundle, price: 29.99 };
            sandbox.stub(voteBundleRepository, 'updatePricing').resolves(updatedBundle);
            
            const result = await voteBundleRepository.updatePricing(voteBundle._id, 29.99);
            
            expect(result.price).to.equal(29.99);
        });

        it('should throw error for negative price', async () => {
            sandbox.stub(voteBundleRepository, 'updatePricing').throws(new Error('Price cannot be negative'));
            
            try {
                await voteBundleRepository.updatePricing(voteBundle._id, -5.00);
            } catch (error) {
                expect(error.message).to.equal('Price cannot be negative');
            }
        });
    });

    describe('Toggle popularity', () => {
        it('should toggle popularity status', async () => {
            const toggledBundle = { ...voteBundle, popular: false };
            sandbox.stub(voteBundleRepository, 'togglePopularity').resolves(toggledBundle);
            
            const result = await voteBundleRepository.togglePopularity(voteBundle._id);
            
            expect(result.popular).to.be.false;
        });

        it('should throw error if bundle not found', async () => {
            sandbox.stub(voteBundleRepository, 'togglePopularity').throws(new Error('Vote bundle not found'));
            
            try {
                await voteBundleRepository.togglePopularity(new mongoose.Types.ObjectId());
            } catch (error) {
                expect(error.message).to.equal('Vote bundle not found');
            }
        });
    });

    describe('Toggle active status', () => {
        it('should toggle active status', async () => {
            const deactivatedBundle = { ...voteBundle, isActive: false };
            sandbox.stub(voteBundleRepository, 'toggleActiveStatus').resolves(deactivatedBundle);
            
            const result = await voteBundleRepository.toggleActiveStatus(voteBundle._id);
            
            expect(result.isActive).to.be.false;
        });
    });

    describe('Activate/Deactivate bundle', () => {
        it('should activate bundle', async () => {
            const activatedBundle = { ...voteBundle, isActive: true };
            sandbox.stub(voteBundleRepository, 'activateBundle').resolves(activatedBundle);
            
            const result = await voteBundleRepository.activateBundle(voteBundle._id);
            
            expect(result.isActive).to.be.true;
        });

        it('should deactivate bundle', async () => {
            const deactivatedBundle = { ...voteBundle, isActive: false };
            sandbox.stub(voteBundleRepository, 'deactivateBundle').resolves(deactivatedBundle);
            
            const result = await voteBundleRepository.deactivateBundle(voteBundle._id);
            
            expect(result.isActive).to.be.false;
        });
    });

    describe('Feature management', () => {
        it('should add features to bundle', async () => {
            const bundleWithNewFeatures = { 
                ...voteBundle, 
                features: ['Email Support', 'Basic Analytics', 'Priority Support'] 
            };
            sandbox.stub(voteBundleRepository, 'addFeatures').resolves(bundleWithNewFeatures);
            
            const result = await voteBundleRepository.addFeatures(voteBundle._id, 'Priority Support');
            
            expect(result.features).to.include('Priority Support');
        });

        it('should remove features from bundle', async () => {
            const bundleWithRemovedFeature = { 
                ...voteBundle, 
                features: ['Basic Analytics'] 
            };
            sandbox.stub(voteBundleRepository, 'removeFeatures').resolves(bundleWithRemovedFeature);
            
            const result = await voteBundleRepository.removeFeatures(voteBundle._id, 'Email Support');
            
            expect(result.features).to.not.include('Email Support');
            expect(result.features).to.include('Basic Analytics');
        });

        it('should handle array of features', async () => {
            const bundleWithMultipleFeatures = { 
                ...voteBundle, 
                features: ['Email Support', 'Basic Analytics', 'SMS Support', 'Phone Support'] 
            };
            sandbox.stub(voteBundleRepository, 'addFeatures').resolves(bundleWithMultipleFeatures);
            
            const result = await voteBundleRepository.addFeatures(voteBundle._id, ['SMS Support', 'Phone Support']);
            
            expect(result.features).to.include('SMS Support');
            expect(result.features).to.include('Phone Support');
        });
    });

    describe('Event management', () => {
        it('should add applicable events', async () => {
            const newEventId = new mongoose.Types.ObjectId();
            const bundleWithNewEvent = { 
                ...voteBundle, 
                applicableEvents: [...eventIds, newEventId] 
            };
            sandbox.stub(voteBundleRepository, 'addApplicableEvents').resolves(bundleWithNewEvent);
            
            const result = await voteBundleRepository.addApplicableEvents(voteBundle._id, newEventId);
            
            expect(result.applicableEvents).to.include(newEventId);
        });

        it('should remove applicable events', async () => {
            const bundleWithRemovedEvent = { 
                ...voteBundle, 
                applicableEvents: [eventIds[1]] 
            };
            sandbox.stub(voteBundleRepository, 'removeApplicableEvents').resolves(bundleWithRemovedEvent);
            
            const result = await voteBundleRepository.removeApplicableEvents(voteBundle._id, eventIds[0]);
            
            expect(result.applicableEvents).to.not.include(eventIds[0]);
            expect(result.applicableEvents).to.include(eventIds[1]);
        });
    });

    describe('Category management', () => {
        it('should add applicable categories', async () => {
            const newCategoryId = new mongoose.Types.ObjectId();
            const bundleWithNewCategory = { 
                ...voteBundle, 
                applicableCategories: [...categoryIds, newCategoryId] 
            };
            sandbox.stub(voteBundleRepository, 'addApplicableCategories').resolves(bundleWithNewCategory);
            
            const result = await voteBundleRepository.addApplicableCategories(voteBundle._id, newCategoryId);
            
            expect(result.applicableCategories).to.include(newCategoryId);
        });

        it('should remove applicable categories', async () => {
            const bundleWithRemovedCategory = { 
                ...voteBundle, 
                applicableCategories: [categoryIds[1]] 
            };
            sandbox.stub(voteBundleRepository, 'removeApplicableCategories').resolves(bundleWithRemovedCategory);
            
            const result = await voteBundleRepository.removeApplicableCategories(voteBundle._id, categoryIds[0]);
            
            expect(result.applicableCategories).to.not.include(categoryIds[0]);
            expect(result.applicableCategories).to.include(categoryIds[1]);
        });
    });

    describe('Bundle statistics', () => {
        it('should return comprehensive bundle statistics', async () => {
            const mockStats = {
                totalBundles: 25,
                popularBundles: 15,
                nonPopularBundles: 10,
                avgPrice: 32.50,
                maxPrice: 99.99,
                minPrice: 9.99,
                priceRange: 90.00,
                totalVotes: 2500,
                avgVotes: 100,
                maxVotes: 500,
                minVotes: 25,
                voteRange: 475
            };
            
            sandbox.stub(voteBundleRepository, 'getBundleStats').resolves(mockStats);
            
            const result = await voteBundleRepository.getBundleStats();
            
            expect(result).to.have.property('totalBundles', 25);
            expect(result).to.have.property('popularBundles', 15);
            expect(result).to.have.property('avgPrice', 32.50);
            expect(result).to.have.property('totalVotes', 2500);
        });

        it('should return default statistics when no bundles exist', async () => {
            const defaultStats = {
                totalBundles: 0,
                popularBundles: 0,
                nonPopularBundles: 0,
                avgPrice: 0,
                maxPrice: 0,
                minPrice: 0,
                priceRange: 0,
                totalVotes: 0,
                avgVotes: 0,
                maxVotes: 0,
                minVotes: 0,
                voteRange: 0
            };
            
            sandbox.stub(voteBundleRepository, 'getBundleStats').resolves(defaultStats);
            
            const result = await voteBundleRepository.getBundleStats();
            
            expect(result.totalBundles).to.equal(0);
            expect(result.avgPrice).to.equal(0);
        });
    });

    describe('Search bundles', () => {
        it('should search bundles by name', async () => {
            const searchResults = [voteBundle];
            sandbox.stub(voteBundleRepository, 'searchBundles').resolves(searchResults);
            
            const result = await voteBundleRepository.searchBundles('Basic');
            
            expect(result[0].name).to.include('Basic');
        });

        it('should search bundles by description', async () => {
            const searchResults = [voteBundle];
            sandbox.stub(voteBundleRepository, 'searchBundles').resolves(searchResults);
            
            const result = await voteBundleRepository.searchBundles('campaign');
            
            expect(result[0].description).to.include('campaign');
        });

        it('should search bundles by features', async () => {
            const searchResults = [voteBundle];
            sandbox.stub(voteBundleRepository, 'searchBundles').resolves(searchResults);
            
            const result = await voteBundleRepository.searchBundles('Email');
            
            expect(result[0].features).to.include('Email Support');
        });
    });

    describe('Get bundles for budget', () => {
        it('should find bundles within budget', async () => {
            const budgetBundles = [voteBundle];
            sandbox.stub(voteBundleRepository, 'getBundlesForBudget').resolves(budgetBundles);
            
            const result = await voteBundleRepository.getBundlesForBudget(30.00);
            
            expect(result[0].price).to.be.at.most(30.00);
        });

        it('should return empty array if no bundles within budget', async () => {
            sandbox.stub(voteBundleRepository, 'getBundlesForBudget').resolves([]);
            
            const result = await voteBundleRepository.getBundlesForBudget(5.00);
            
            expect(result).to.be.an('array');
            expect(result).to.have.length(0);
        });
    });

    describe('Bulk operations', () => {
        it('should bulk update popularity status', async () => {
            const updateResult = { modifiedCount: 5, matchedCount: 5 };
            sandbox.stub(voteBundleRepository, 'bulkUpdatePopularity').resolves(updateResult);
            
            const criteria = { price: { $lt: 20 } };
            const result = await voteBundleRepository.bulkUpdatePopularity(criteria, false);
            
            expect(result.modifiedCount).to.equal(5);
            expect(result.matchedCount).to.equal(5);
        });
    });

    describe('Delete bundle', () => {
        it('should delete bundle if not used in votes', async () => {
            sandbox.stub(voteBundleRepository, 'deleteBundle').resolves(voteBundle);
            
            const result = await voteBundleRepository.deleteBundle(voteBundle._id);
            
            expect(result).to.have.property('_id');
        });

        it('should throw error if bundle is used in existing votes', async () => {
            sandbox.stub(voteBundleRepository, 'deleteBundle').throws(new Error('Cannot delete vote bundle used in existing votes'));
            
            try {
                await voteBundleRepository.deleteBundle(voteBundle._id);
            } catch (error) {
                expect(error.message).to.include('Cannot delete vote bundle used in existing votes');
            }
        });
    });

    describe('Data validation', () => {
        it('should validate required fields', async () => {
            const invalidBundle = { name: '', description: '', votes: 0, price: -1 };
            
            sandbox.stub(voteBundleRepository, 'createBundle').throws(new Error('Name is required'));
            
            try {
                await voteBundleRepository.createBundle(invalidBundle);
            } catch (error) {
                expect(error.message).to.include('Name is required');
            }
        });

        it('should validate positive vote count', async () => {
            const invalidBundle = { ...voteBundle, votes: -5 };
            
            sandbox.stub(voteBundleRepository, 'createBundle').throws(new Error('Votes must be a positive number'));
            
            try {
                await voteBundleRepository.createBundle(invalidBundle);
            } catch (error) {
                expect(error.message).to.include('Votes must be a positive number');
            }
        });

        it('should validate non-negative price', async () => {
            const invalidBundle = { ...voteBundle, price: -10 };
            
            sandbox.stub(voteBundleRepository, 'createBundle').throws(new Error('Price must be a non-negative number'));
            
            try {
                await voteBundleRepository.createBundle(invalidBundle);
            } catch (error) {
                expect(error.message).to.include('Price must be a non-negative number');
            }
        });
    });

    describe('Error handling', () => {
        it('should handle database errors gracefully', async () => {
            sandbox.stub(voteBundleRepository, 'findByEvent').throws(new Error('Database connection error'));
            
            try {
                await voteBundleRepository.findByEvent(eventIds[0]);
            } catch (error) {
                expect(error.message).to.include('Database connection error');
            }
        });

        it('should handle invalid ObjectId errors', async () => {
            sandbox.stub(voteBundleRepository, 'findByEvent').throws(new Error('Invalid ObjectId'));
            
            try {
                await voteBundleRepository.findByEvent('invalid-id');
            } catch (error) {
                expect(error.message).to.include('Invalid ObjectId');
            }
        });

        it('should handle aggregation pipeline errors', async () => {
            sandbox.stub(voteBundleRepository, 'getBestValueBundles').throws(new Error('Aggregation failed'));
            
            try {
                await voteBundleRepository.getBestValueBundles();
            } catch (error) {
                expect(error.message).to.include('Aggregation failed');
            }
        });
    });

    describe('Edge cases', () => {
        it('should handle zero-priced bundles', async () => {
            const freeBund = { ...voteBundle, price: 0.00 };
            sandbox.stub(voteBundleRepository, 'createBundle').resolves(freeBund);
            
            const result = await voteBundleRepository.createBundle(freeBund);
            
            expect(result.price).to.equal(0.00);
        });

        it('should handle bundles with no features', async () => {
            const noFeaturesBundle = { ...voteBundle, features: [] };
            sandbox.stub(voteBundleRepository, 'createBundle').resolves(noFeaturesBundle);
            
            const result = await voteBundleRepository.createBundle(noFeaturesBundle);
            
            expect(result.features).to.be.an('array');
            expect(result.features).to.have.length(0);
        });

        it('should handle bundles with no applicable events or categories', async () => {
            const restrictedBundle = { ...voteBundle, applicableEvents: [], applicableCategories: [] };
            sandbox.stub(voteBundleRepository, 'createBundle').resolves(restrictedBundle);
            
            const result = await voteBundleRepository.createBundle(restrictedBundle);
            
            expect(result.applicableEvents).to.be.an('array');
            expect(result.applicableEvents).to.have.length(0);
            expect(result.applicableCategories).to.be.an('array');
            expect(result.applicableCategories).to.have.length(0);
        });

        it('should handle very large vote counts', async () => {
            const megaBundle = { ...voteBundle, votes: 1000000 };
            sandbox.stub(voteBundleRepository, 'createBundle').resolves(megaBundle);
            
            const result = await voteBundleRepository.createBundle(megaBundle);
            
            expect(result.votes).to.equal(1000000);
        });
    });
});

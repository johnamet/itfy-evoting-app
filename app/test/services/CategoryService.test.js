#!/usr/bin/env node
/**
 * CategoryService Tests
 * 
 * Unit tests for the CategoryService class
 */

import { expect } from 'chai';
import sinon from 'sinon';
import CategoryService from '../../services/CategoryService.js';
import CategoryRepository from '../../repositories/CategoryRepository.js';
import EventRepository from '../../repositories/EventRepository.js';
import CandidateRepository from '../../repositories/CandidateRepository.js';
import ActivityRepository from '../../repositories/ActivityRepository.js';

describe('CategoryService', () => {
    let categoryService;
    let categoryRepositoryStub;
    let eventRepositoryStub;
    let candidateRepositoryStub;
    let activityRepositoryStub;

    beforeEach(() => {
        categoryService = new CategoryService();
        
        categoryRepositoryStub = sinon.createStubInstance(CategoryRepository);
        eventRepositoryStub = sinon.createStubInstance(EventRepository);
        candidateRepositoryStub = sinon.createStubInstance(CandidateRepository);
        activityRepositoryStub = sinon.createStubInstance(ActivityRepository);

        categoryService.categoryRepository = categoryRepositoryStub;
        categoryService.eventRepository = eventRepositoryStub;
        categoryService.candidateRepository = candidateRepositoryStub;
        categoryService.activityRepository = activityRepositoryStub;
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('createCategory', () => {
        const validCategoryData = {
            name: 'Presidential',
            description: 'Presidential election category',
            event: '507f1f77bcf86cd799439011'
        };
        const createdBy = '507f1f77bcf86cd799439013';

        beforeEach(() => {
            eventRepositoryStub.findById.resolves({
                _id: '507f1f77bcf86cd799439011',
                name: 'Test Event',
                status: 'draft'
            });

            categoryRepositoryStub.findByEventAndName.resolves(null);
            categoryRepositoryStub.createCategory.resolves({
                _id: '507f1f77bcf86cd799439012',
                name: 'Presidential',
                description: 'Presidential election category',
                event: '507f1f77bcf86cd799439011',
                createdAt: new Date()
            });

            activityRepositoryStub.logActivity.resolves();
        });

        it('should create category successfully', async () => {
            const result = await categoryService.createCategory(validCategoryData, createdBy);

            expect(result.success).to.be.true;
            expect(result.category.name).to.equal('Presidential');
            expect(categoryRepositoryStub.createCategory.calledOnce).to.be.true;
            expect(activityRepositoryStub.logActivity.calledOnce).to.be.true;
        });

        it('should throw error for missing required fields', async () => {
            const invalidData = { name: 'Presidential' }; // missing event

            try {
                await categoryService.createCategory(invalidData, createdBy);
                expect.fail('Should have thrown validation error');
            } catch (error) {
                expect(error.message).to.include('Missing required field');
            }
        });

        it('should throw error if event not found', async () => {
            eventRepositoryStub.findById.resolves(null);

            try {
                await categoryService.createCategory(validCategoryData, createdBy);
                expect.fail('Should have thrown error');
            } catch (error) {
               expect(error.message).to.include('Event not found');
            }
        });

        it('should throw error for completed event', async () => {
            eventRepositoryStub.findById.resolves({
                status: 'completed'
            });

            try {
                await categoryService.createCategory(validCategoryData, createdBy);
                expect.fail('Should have thrown error');
            } catch (error) {
               expect(error.message).to.include('Cannot add categories to completed event');
            }
        });

        it('should throw error for duplicate category name', async () => {
            categoryRepositoryStub.findByEventAndName.resolves({
                _id: 'existing-category',
                name: 'Presidential'
            });

            try {
                await categoryService.createCategory(validCategoryData, createdBy);
                expect.fail('Should have thrown error');
            } catch (error) {
               expect(error.message).to.include('Category with this name already exists in the event');
            }
        });

        it('should throw error for short category name', async () => {
            const shortNameData = { ...validCategoryData, name: 'A' };

            try {
                await categoryService.createCategory(shortNameData, createdBy);
                expect.fail('Should have thrown error');
            } catch (error) {
               expect(error.message).to.include('Category name must be at least 2 characters long');
            }
        });
    });

    describe('updateCategory', () => {
        const categoryId = '507f1f77bcf86cd799439012';
        const updatedBy = '507f1f77bcf86cd799439013';
        const updateData = {
            name: 'Presidential Updated',
            description: 'Updated description'
        };

        beforeEach(() => {
            categoryRepositoryStub.findById.resolves({
                _id: categoryId,
                name: 'Presidential',
                event: '507f1f77bcf86cd799439011'
            });

            eventRepositoryStub.findById.resolves({
                status: 'draft'
            });

            categoryRepositoryStub.findByEventAndName.resolves(null);
            categoryRepositoryStub.updateById.resolves({
                _id: categoryId,
                name: 'Presidential Updated',
                description: 'Updated description',
                updatedAt: new Date()
            });

            activityRepositoryStub.logActivity.resolves();
        });

        it('should update category successfully', async () => {
            const result = await categoryService.updateCategory(categoryId, updateData, updatedBy);

            expect(result.success).to.be.true;
            expect(result.category.name).to.equal('Presidential Updated');
            expect(categoryRepositoryStub.updateById.calledOnce).to.be.true;
            expect(activityRepositoryStub.logActivity.calledOnce).to.be.true;
        });

        it('should throw error if category not found', async () => {
            categoryRepositoryStub.findById.resolves(null);

            try {
                await categoryService.updateCategory(categoryId, updateData, updatedBy);
                expect.fail('Should have thrown error');
            } catch (error) {
               expect(error.message).to.include('Category not found');
            }
        });

        it('should throw error for completed event', async () => {
            eventRepositoryStub.findById.resolves({
                status: 'completed'
            });

            try {
                await categoryService.updateCategory(categoryId, updateData, updatedBy);
                expect.fail('Should have thrown error');
            } catch (error) {
               expect(error.message).to.include('Cannot update category in completed event');
            }
        });
    });

    describe('deleteCategory', () => {
        const categoryId = '507f1f77bcf86cd799439012';
        const deletedBy = '507f1f77bcf86cd799439013';

        beforeEach(() => {
            categoryRepositoryStub.findById.resolves({
                _id: categoryId,
                name: 'Presidential',
                event: '507f1f77bcf86cd799439011'
            });

            eventRepositoryStub.findById.resolves({
                status: 'draft'
            });

            candidateRepositoryStub.findByCategory.resolves([]);
            categoryRepositoryStub.deleteCategory.resolves();
            activityRepositoryStub.logActivity.resolves();
        });

        it('should delete category successfully', async () => {
            const result = await categoryService.deleteCategory(categoryId, deletedBy);

            expect(result.success).to.be.true;
            expect(result.message).to.equal('Category deleted successfully');
            expect(categoryRepositoryStub.deleteCategory.calledOnce).to.be.true;
            expect(activityRepositoryStub.logActivity.calledOnce).to.be.true;
        });

        it('should throw error if category has candidates', async () => {
            candidateRepositoryStub.findByCategory.resolves([
                { _id: 'candidate1', name: 'John Doe' }
            ]);

            try {
                await categoryService.deleteCategory(categoryId, deletedBy);
                expect.fail('Should have thrown error');
            } catch (error) {
               expect(error.message).to.include('Cannot delete category with existing candidates');
            }
        });

        it('should throw error for active event', async () => {
            eventRepositoryStub.findById.resolves({
                status: 'active'
            });

            try {
                await categoryService.deleteCategory(categoryId, deletedBy);
                expect.fail('Should have thrown error');
            } catch (error) {
               expect(error.message).to.include('Cannot delete category from active or completed event');
            }
        });
    });

    describe('getCategoryById', () => {
        const categoryId = '507f1f77bcf86cd799439012';

        it('should get category with candidates', async () => {
            const mockCategory = {
                _id: categoryId,
                name: 'Presidential',
                candidateCount: 3,
                candidates: [
                    { _id: '1', name: 'Candidate 1' },
                    { _id: '2', name: 'Candidate 2' }
                ]
            };

            categoryRepositoryStub.getCategoryWithCandidates.resolves(mockCategory);

            const result = await categoryService.getCategoryById(categoryId);

            expect(result.success).to.be.true;
            expect(result.category).to.deep.equal(mockCategory);
        });

        it('should throw error if category not found', async () => {
            categoryRepositoryStub.getCategoryWithCandidates.resolves(null);

            try {
                await categoryService.getCategoryById(categoryId);
                expect.fail('Should have thrown error');
            } catch (error) {
               expect(error.message).to.include('Category not found');
            }
        });
    });

    describe('getCategoriesByEvent', () => {
        const eventId = '507f1f77bcf86cd799439011';

        it('should get categories for event', async () => {
            const mockCategories = [
                { _id: '1', name: 'Presidential', candidateCount: 3 },
                { _id: '2', name: 'Vice Presidential', candidateCount: 2 }
            ];

            eventRepositoryStub.findById.resolves({
                _id: eventId,
                name: 'Test Event'
            });

            categoryRepositoryStub.getCategoriesWithCandidateCount.resolves(mockCategories);

            const result = await categoryService.getCategoriesByEvent(eventId);

            expect(result.success).to.be.true;
            expect(result.data.categories).to.deep.equal(mockCategories);
        });

        it('should throw error if event not found', async () => {
            eventRepositoryStub.findById.resolves(null);

            try {
                await categoryService.getCategoriesByEvent(eventId);
                expect.fail('Should have thrown error');
            } catch (error) {
               expect(error.message).to.include('Event not found');
            }
        });
    });

    describe('reorderCategories', () => {
        const eventId = '507f1f77bcf86cd799439011';
        const categoryOrder = [
            '507f1f77bcf86cd799439012',
            '507f1f77bcf86cd799439013'
        ];
        const reorderedBy = '507f1f77bcf86cd799439014';

        beforeEach(() => {
            eventRepositoryStub.findById.resolves({
                _id: eventId,
                status: 'draft'
            });

            categoryRepositoryStub.findById
                .withArgs('507f1f77bcf86cd799439012')
                .resolves({ _id: '507f1f77bcf86cd799439012', event: eventId })
                .withArgs('507f1f77bcf86cd799439013')
                .resolves({ _id: '507f1f77bcf86cd799439013', event: eventId });

            categoryRepositoryStub.updateCategoryOrder.resolves();
            activityRepositoryStub.logActivity.resolves();
        });

        it('should reorder categories successfully', async () => {
            const result = await categoryService.reorderCategories(eventId, categoryOrder, reorderedBy);

            expect(result.success).to.be.true;
            expect(result.message).to.equal('Categories reordered successfully');
            expect(categoryRepositoryStub.updateCategoryOrder.calledTwice).to.be.true;
            expect(activityRepositoryStub.logActivity.calledOnce).to.be.true;
        });

        it('should throw error for active event', async () => {
            eventRepositoryStub.findById.resolves({
                status: 'active'
            });

            try {
                await categoryService.reorderCategories(eventId, categoryOrder, reorderedBy);
                expect.fail('Should have thrown error');
            } catch (error) {
               expect(error.message).to.include('Cannot reorder categories in active or completed event');
            }
        });

        it('should throw error for category not in event', async () => {
            categoryRepositoryStub.findById
                .withArgs('507f1f77bcf86cd799439013')
                .resolves({ _id: '507f1f77bcf86cd799439013', event: 'different-event' });

            try {
                await categoryService.reorderCategories(eventId, categoryOrder, reorderedBy);
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.include('does not belong to the specified event');
            }
        });
    });

    describe('getCategoryStatistics', () => {
        const categoryId = '507f1f77bcf86cd799439012';

        it('should get category statistics', async () => {
            const mockStats = {
                categoryId,
                candidateCount: 5,
                totalVotes: 100,
                topCandidate: { name: 'Winner', votes: 40 }
            };

            categoryRepositoryStub.getCategoryStatistics.resolves(mockStats);

            const result = await categoryService.getCategoryStatistics(categoryId);

            expect(result.success).to.be.true;
            expect(result.data.candidateCount).to.equal(5);
            expect(result.data).to.have.property('generatedAt');
        });
    });

    describe('bulkCreateCategories', () => {
        const categoriesData = [
            {
                name: 'Presidential',
                description: 'Presidential category',
                event: '507f1f77bcf86cd799439011'
            },
            {
                name: 'Vice Presidential',
                description: 'VP category',
                event: '507f1f77bcf86cd799439011'
            }
        ];
        const createdBy = '507f1f77bcf86cd799439013';

        beforeEach(() => {
            eventRepositoryStub.findById.resolves({
                status: 'draft'
            });

            categoryRepositoryStub.bulkCreateCategories.resolves({
                success: [
                    { _id: '1', name: 'Presidential' },
                    { _id: '2', name: 'Vice Presidential' }
                ],
                errors: [],
                successCount: 2,
                errorCount: 0
            });

            activityRepositoryStub.logActivity.resolves();
        });

        it('should bulk create categories successfully', async () => {
            const result = await categoryService.bulkCreateCategories(categoriesData, createdBy);

            expect(result.success).to.be.true;
            expect(result.data.successCount).to.equal(2);
            expect(activityRepositoryStub.logActivity.calledTwice).to.be.true;
        });

        it('should throw error for empty array', async () => {
            try {
                await categoryService.bulkCreateCategories([], createdBy);
                expect.fail('Should have thrown error');
            } catch (error) {
               expect(error.message).to.include('Categories data must be a non-empty array');
            }
        });
    });
});

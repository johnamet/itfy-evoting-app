#!/usr/bin/env node
/**
 * CandidateService Tests
 * 
 * Unit tests for the CandidateService class
 */

import { expect } from 'chai';
import sinon from 'sinon';
import CandidateService from '../../services/CandidateService.js';
import CandidateRepository from '../../repositories/CandidateRepository.js';
import EventRepository from '../../repositories/EventRepository.js';
import CategoryRepository from '../../repositories/CategoryRepository.js';
import VoteRepository from '../../repositories/VoteRepository.js';
import ActivityRepository from '../../repositories/ActivityRepository.js';
import FileService from '../../services/FileService.js';

describe('CandidateService', () => {
    let candidateService;
    let candidateRepositoryStub;
    let eventRepositoryStub;
    let categoryRepositoryStub;
    let voteRepositoryStub;
    let activityRepositoryStub;
    let fileServiceStub;

    beforeEach(() => {
        candidateService = new CandidateService();
        
        // Create stubs for all dependencies
        candidateRepositoryStub = sinon.createStubInstance(CandidateRepository);
        eventRepositoryStub = sinon.createStubInstance(EventRepository);
        categoryRepositoryStub = sinon.createStubInstance(CategoryRepository);
        voteRepositoryStub = sinon.createStubInstance(VoteRepository);
        activityRepositoryStub = sinon.createStubInstance(ActivityRepository);
        fileServiceStub = sinon.createStubInstance(FileService);

        // Replace repository instances
        candidateService.candidateRepository = candidateRepositoryStub;
        candidateService.eventRepository = eventRepositoryStub;
        candidateService.categoryRepository = categoryRepositoryStub;
        candidateService.voteRepository = voteRepositoryStub;
        candidateService.activityRepository = activityRepositoryStub;
        candidateService.fileService = fileServiceStub;
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('createCandidate', () => {
        const validCandidateData = {
            name: 'John Doe',
            event: '507f1f77bcf86cd799439011',
            categories: ['507f1f77bcf86cd799439012'],
            bio: 'Candidate bio'
        };
        const createdBy = '507f1f77bcf86cd799439013';

        beforeEach(() => {
            eventRepositoryStub.findById.resolves({
                _id: '507f1f77bcf86cd799439011',
                name: 'Test Event',
                status: 'draft'
            });

            candidateRepositoryStub.createCandidate.resolves({
                _id: '507f1f77bcf86cd799439014',
                name: 'John Doe',
                event: '507f1f77bcf86cd799439011',
                categories: ['507f1f77bcf86cd799439012'],
                bio: 'Candidate bio',
                createdAt: new Date()
            });

            activityRepositoryStub.logActivity.resolves();
        });

        it('should create candidate successfully', async () => {
            const result = await candidateService.createCandidate(validCandidateData, createdBy);

            expect(result.success).to.be.true;
            expect(result.candidate).to.have.property('name', 'John Doe');
            expect(candidateRepositoryStub.createCandidate.calledOnce).to.be.true;
            expect(activityRepositoryStub.logActivity.calledOnce).to.be.true;
        });

        it('should throw error for missing required fields', async () => {
            const invalidData = { name: 'John Doe' }; // missing event and category

            try {
                await candidateService.createCandidate(invalidData, createdBy);
                expect.fail('Should have thrown validation error');
            } catch (error) {
                expect(error.message).to.include('Missing required field');
            }
        });

        it('should throw error for completed event', async () => {
            eventRepositoryStub.findById.resolves({
                status: 'completed'
            });

            try {
                await candidateService.createCandidate(validCandidateData, createdBy);
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.include('Error in create_candidate: Cannot add candidates to completed event');
            }
        });

        it('should throw error for active event', async () => {
            eventRepositoryStub.findById.resolves({
                status: 'active'
            });

            try {
                await candidateService.createCandidate(validCandidateData, createdBy);
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.include('Error in create_candidate: Cannot add candidates to active event');
            }
        });

        it('should throw error for short candidate name', async () => {
            const shortNameData = { ...validCandidateData, name: 'A' };

            try {
                await candidateService.createCandidate(shortNameData, createdBy);
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.include('Error in create_candidate: Candidate name must be at least 2 characters long');
            }
        });

        it('should throw error for long candidate name', async () => {
            const longNameData = { 
                ...validCandidateData, 
                name: 'A'.repeat(101) 
            };

            try {
                await candidateService.createCandidate(longNameData, createdBy);
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.include('Error in create_candidate: Candidate name must be less than 100 characters');
            }
        });
    });

    describe('updateCandidate', () => {
        const candidateId = '507f1f77bcf86cd799439014';
        const updatedBy = '507f1f77bcf86cd799439013';
        const updateData = { name: 'Jane Doe', bio: 'Updated bio' };

        beforeEach(() => {
            candidateRepositoryStub.findById.resolves({
                _id: candidateId,
                name: 'John Doe',
                event: '507f1f77bcf86cd799439011',
                categories: ['507f1f77bcf86cd799439012']
            });

            eventRepositoryStub.findById.resolves({
                status: 'draft'
            });

            candidateRepositoryStub.updateById.resolves({
                _id: candidateId,
                name: 'Jane Doe',
                bio: 'Updated bio',
                updatedAt: new Date()
            });

            activityRepositoryStub.logActivity.resolves();
        });

        it('should update candidate successfully', async () => {
            const result = await candidateService.updateCandidate(candidateId, updateData, updatedBy);

            expect(result.success).to.be.true;
            expect(result.candidate.name).to.equal('Jane Doe');
            expect(candidateRepositoryStub.updateById.calledOnce).to.be.true;
            expect(activityRepositoryStub.logActivity.calledOnce).to.be.true;
        });

        it('should throw error if candidate not found', async () => {
            candidateRepositoryStub.findById.resolves(null);

            try {
                await candidateService.updateCandidate(candidateId, updateData, updatedBy);
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.include('Error in update_candidate: Candidate not found');
            }
        });

        it('should throw error for completed event', async () => {
            eventRepositoryStub.findById.resolves({
                status: 'completed'
            });

            try {
                await candidateService.updateCandidate(candidateId, updateData, updatedBy);
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.include('Error in update_candidate: Cannot update candidate in completed event');
            }
        });
    });

    describe('deleteCandidate', () => {
        const candidateId = '507f1f77bcf86cd799439014';
        const deletedBy = '507f1f77bcf86cd799439013';

        beforeEach(() => {
            candidateRepositoryStub.findById.resolves({
                _id: candidateId,
                name: 'John Doe',
                event: '507f1f77bcf86cd799439011',
                categories: ['507f1f77bcf86cd799439012']
            });

            eventRepositoryStub.findById.resolves({
                status: 'draft'
            });

            voteRepositoryStub.countVotesForCandidate.resolves(0);
            candidateRepositoryStub.deleteCandidate.resolves();
            activityRepositoryStub.logActivity.resolves();
        });

        it('should delete candidate successfully', async () => {
            const result = await candidateService.deleteCandidate(candidateId, deletedBy);

            expect(result.success).to.be.true;
            expect(result.message).to.equal('Candidate deleted successfully');
            expect(candidateRepositoryStub.deleteCandidate.calledOnce).to.be.true;
            expect(activityRepositoryStub.logActivity.calledOnce).to.be.true;
        });

        it('should throw error if candidate has votes', async () => {
            voteRepositoryStub.countVotesForCandidate.resolves(5);

            try {
                await candidateService.deleteCandidate(candidateId, deletedBy);
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.include('Error in delete_candidate: Cannot delete candidate with existing votes');
            }
        });

        it('should throw error for active event', async () => {
            eventRepositoryStub.findById.resolves({
                status: 'active'
            });

            try {
                await candidateService.deleteCandidate(candidateId, deletedBy);
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.include('Error in delete_candidate: Cannot delete candidate from active or completed event');
            }
        });
    });

    describe('addCategoryToCandidate', () => {
        const candidateId = '507f1f77bcf86cd799439014';
        const categoryId = '507f1f77bcf86cd799439015';
        const updatedBy = '507f1f77bcf86cd799439013';

        beforeEach(() => {
            candidateRepositoryStub.findById.resolves({
                _id: candidateId,
                name: 'John Doe',
                event: '507f1f77bcf86cd799439011',
                categories: ['507f1f77bcf86cd799439012']
            });

            eventRepositoryStub.findById.resolves({
                status: 'draft'
            });

            categoryRepositoryStub.findById.resolves({
                _id: categoryId,
                name: 'New Category',
                event: '507f1f77bcf86cd799439011'
            });

            voteRepositoryStub.countVotesForCandidate.resolves(0);
            candidateRepositoryStub.updateById.resolves({
                _id: candidateId,
                name: 'John Doe',
                categories: ['507f1f77bcf86cd799439012', categoryId],
                updatedAt: new Date()
            });
            activityRepositoryStub.logActivity.resolves();
        });

        it('should add category to candidate successfully', async () => {
            const result = await candidateService.addCategoryToCandidate(candidateId, categoryId, updatedBy);

            expect(result.success).to.be.true;
            expect(result.data.addedCategory.name).to.equal('New Category');
            expect(candidateRepositoryStub.updateById.calledOnce).to.be.true;
            expect(activityRepositoryStub.logActivity.calledOnce).to.be.true;
        });

        it('should throw error if candidate has votes', async () => {
            voteRepositoryStub.countVotesForCandidate.resolves(3);

            try {
                await candidateService.addCategoryToCandidate(candidateId, categoryId, updatedBy);
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.include('Cannot modify candidate categories as votes have already been cast');
            }
        });

        it('should throw error if candidate already has the category', async () => {
            try {
                await candidateService.addCategoryToCandidate(candidateId, '507f1f77bcf86cd799439012', updatedBy);
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.include('Candidate already has this category');
            }
        });

        it('should throw error if category belongs to different event', async () => {
            categoryRepositoryStub.findById.resolves({
                _id: categoryId,
                name: 'New Category',
                event: '507f1f77bcf86cd799439099' // Different event
            });

            try {
                await candidateService.addCategoryToCandidate(candidateId, categoryId, updatedBy);
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.include('Category must belong to the same event');
            }
        });
    });

    describe('removeCategoryFromCandidate', () => {
        const candidateId = '507f1f77bcf86cd799439014';
        const categoryId = '507f1f77bcf86cd799439012';
        const updatedBy = '507f1f77bcf86cd799439013';

        beforeEach(() => {
            candidateRepositoryStub.findById.resolves({
                _id: candidateId,
                name: 'John Doe',
                event: '507f1f77bcf86cd799439011',
                categories: ['507f1f77bcf86cd799439012', '507f1f77bcf86cd799439015']
            });

            eventRepositoryStub.findById.resolves({
                status: 'draft'
            });

            categoryRepositoryStub.findById.resolves({
                _id: categoryId,
                name: 'Category to Remove',
                event: '507f1f77bcf86cd799439011'
            });

            voteRepositoryStub.countVotesForCandidate.resolves(0);
            candidateRepositoryStub.updateById.resolves({
                _id: candidateId,
                name: 'John Doe',
                categories: ['507f1f77bcf86cd799439015'],
                updatedAt: new Date()
            });
            activityRepositoryStub.logActivity.resolves();
        });

        it('should remove category from candidate successfully', async () => {
            const result = await candidateService.removeCategoryFromCandidate(candidateId, categoryId, updatedBy);

            expect(result.success).to.be.true;
            expect(result.data.removedCategory.name).to.equal('Category to Remove');
            expect(candidateRepositoryStub.updateById.calledOnce).to.be.true;
            expect(activityRepositoryStub.logActivity.calledOnce).to.be.true;
        });

        it('should throw error if candidate has votes', async () => {
            voteRepositoryStub.countVotesForCandidate.resolves(3);

            try {
                await candidateService.removeCategoryFromCandidate(candidateId, categoryId, updatedBy);
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.include('Cannot modify candidate categories as votes have already been cast');
            }
        });

        it('should throw error if candidate does not have the category', async () => {
            candidateRepositoryStub.findById.resolves({
                _id: candidateId,
                name: 'John Doe',
                event: '507f1f77bcf86cd799439011',
                categories: ['507f1f77bcf86cd799439015'] // Different category
            });

            try {
                await candidateService.removeCategoryFromCandidate(candidateId, categoryId, updatedBy);
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.include('Candidate does not have this category');
            }
        });

        it('should throw error if removing category would leave candidate with no categories', async () => {
            candidateRepositoryStub.findById.resolves({
                _id: candidateId,
                name: 'John Doe',
                event: '507f1f77bcf86cd799439011',
                categories: ['507f1f77bcf86cd799439012'] // Only one category
            });

            try {
                await candidateService.removeCategoryFromCandidate(candidateId, categoryId, updatedBy);
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.include('candidate must have at least one category');
            }
        });
    });

    describe('getCandidateById', () => {
        const candidateId = '507f1f77bcf86cd799439014';

        it('should get candidate with statistics', async () => {
            const mockCandidate = {
                _id: candidateId,
                name: 'John Doe',
                voteCount: 10,
                percentage: 25.5
            };

            candidateRepositoryStub.getCandidateWithStatistics.resolves(mockCandidate);

            const result = await candidateService.getCandidateById(candidateId);

            expect(result.success).to.be.true;
            expect(result.candidate).to.deep.equal(mockCandidate);
        });

        it('should throw error if candidate not found', async () => {
            candidateRepositoryStub.getCandidateWithStatistics.resolves(null);

            try {
                await candidateService.getCandidateById(candidateId);
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.include('Candidate not found');
            }
        });
    });

    describe('searchCandidates', () => {
        it('should return empty array for empty search term', async () => {
            const result = await candidateService.searchCandidates('');

            expect(result.success).to.be.true;
            expect(result.data).to.be.an('array').that.is.empty;
        });

        it('should search candidates by name', async () => {
            const mockCandidates = [
                { _id: '1', name: 'John Doe' },
                { _id: '2', name: 'Jane Doe' }
            ];

            candidateRepositoryStub.searchCandidatesByName.resolves(mockCandidates);

            const result = await candidateService.searchCandidates('Doe');

            expect(result.success).to.be.true;
            expect(result.data).to.deep.equal(mockCandidates);
        });
    });

    describe('bulkCreateCandidates', () => {
        const candidatesData = [
            {
                name: 'Candidate 1',
                event: '507f1f77bcf86cd799439011',
                categories: ['507f1f77bcf86cd799439012']
            },
            {
                name: 'Candidate 2',
                event: '507f1f77bcf86cd799439011',
                categories: ['507f1f77bcf86cd799439012']
            }
        ];
        const createdBy = '507f1f77bcf86cd799439013';

        it('should bulk create candidates successfully', async () => {
            const mockResult = {
                success: [
                    { _id: '1', name: 'Candidate 1' },
                    { _id: '2', name: 'Candidate 2' }
                ],
                errors: [],
                successCount: 2,
                errorCount: 0
            };

            candidateRepositoryStub.bulkCreateCandidates.resolves(mockResult);
            activityRepositoryStub.logActivity.resolves();

            const result = await candidateService.bulkCreateCandidates(candidatesData, createdBy);

            expect(result.success).to.be.true;
            expect(result.data.successCount).to.equal(2);
            expect(activityRepositoryStub.logActivity.calledTwice).to.be.true;
        });

        it('should throw error for empty array', async () => {
            try {
                await candidateService.bulkCreateCandidates([], createdBy);
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.include('Candidates data must be a non-empty array');
            }
        });

        it('should throw error for non-array input', async () => {
            try {
                await candidateService.bulkCreateCandidates('not an array', createdBy);
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.include('Candidates data must be a non-empty array');
            }
        });
    });

    describe('updateCandidatePhoto', () => {
        const candidateId = '507f1f77bcf86cd799439014';
        const updatedBy = '507f1f77bcf86cd799439013';
        const imageData = {
            name: 'photo.jpg',
            data: Buffer.from('image data'),
            size: 1024,
            mimetype: 'image/jpeg'
        };

        beforeEach(() => {
            candidateRepositoryStub.findById.resolves({
                _id: candidateId,
                name: 'John Doe',
                event: '507f1f77bcf86cd799439011',
                photo: 'old-image.jpg'
            });

            eventRepositoryStub.findById.resolves({
                status: 'draft'
            });

            fileServiceStub.uploadCandidateImage.resolves({
                success: true,
                photo: {
                    relativePath: 'candidates/new-image.jpg',
                    size: 1024,
                    mimetype: 'image/jpeg'
                }
            });

            candidateRepositoryStub.updateById.resolves({
                _id: candidateId,
                name: 'John Doe',
                photo: 'candidates/new-image.jpg',
                updatedAt: new Date()
            });

            fileServiceStub.deleteFile.resolves({ success: true });
            activityRepositoryStub.logActivity.resolves();
        });

        it('should update candidate photo successfully', async () => {
            const result = await candidateService.updateCandidatePhoto(candidateId, imageData, updatedBy);

            expect(result.success).to.be.true;
            expect(result.candidate.photo).to.equal('candidates/new-image.jpg');
            expect(fileServiceStub.uploadCandidateImage.calledOnce).to.be.true;
            expect(candidateRepositoryStub.updateById.calledOnce).to.be.true;
            expect(activityRepositoryStub.logActivity.calledOnce).to.be.true;
        });

        it('should throw error if upload fails', async () => {
            fileServiceStub.uploadCandidateImage.resolves({
                success: false,
                error: 'Upload failed'
            });

            try {
                await candidateService.updateCandidatePhoto(candidateId, imageData, updatedBy);
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.include('Failed to upload image');
            }
        });
    });
});

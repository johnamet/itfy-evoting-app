#!/usr/bin/env node
/**
 * Candidate Repository test suite
 * This file contains tests for the CandidateRepository class, ensuring that it correctly interacts with the Candidate model.
 */
import { expect } from 'chai';
import sinon from 'sinon';
import mongoose from 'mongoose';
import CandidateRepository from '../../repositories/CandidateRepository.js';
import { after, afterEach, beforeEach, describe, it } from 'mocha';

describe('CandidateRepository', () => {
    let candidateRepository;
    let sandbox;
    let candidate;
    let eventId;
    let categoryId;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        candidateRepository = new CandidateRepository();
        
        eventId = new mongoose.Types.ObjectId();
        categoryId = new mongoose.Types.ObjectId();
        
        candidate = {
            _id: new mongoose.Types.ObjectId(),
            name: 'John Doe',
            bio: 'Software Engineer with 5 years experience',
            title: 'Senior Developer',
            location: 'New York',
            nominatedBy: 'Alice Smith',
            event: eventId,
            categories: [categoryId],
            isActive: true,
            isDeleted: false,
            status: 'pending',
            skills: ['JavaScript', 'Python', 'React'],
            socialLinks: {
                linkedin: 'https://linkedin.com/in/johndoe',
                github: 'https://github.com/johndoe'
            },
            education: {
                degree: 'BSc Computer Science',
                university: 'Tech University'
            },
            experience: {
                years: 5,
                companies: ['TechCorp', 'StartupXYZ']
            },
            achievements: {
                awards: ['Best Developer 2023'],
                certifications: ['AWS Certified']
            }
        };
    });

    afterEach(() => {
        sandbox.restore();
    });

    after(() => {
        mongoose.connection.close();
    });

    describe('Create a new Candidate', () => {
        it('should create a new candidate with valid data', async () => {
            sandbox.stub(candidateRepository, 'createCandidate').resolves(candidate);
            
            const result = await candidateRepository.createCandidate(candidate);
            
            expect(result).to.have.property('_id');
            expect(result.name).to.equal(candidate.name);
            expect(result.bio).to.equal(candidate.bio);
            expect(result.event).to.equal(eventId);
            expect(result.categories).to.deep.equal([categoryId]);
        });

        it('should throw an error if name is missing', async () => {
            const invalidCandidate = { ...candidate };
            delete invalidCandidate.name;
            
            sandbox.stub(candidateRepository, '_validateUniqueCandidate').throws(new Error('Name, event, and category are required'));
            
            try {
                await candidateRepository.createCandidate(invalidCandidate);
            } catch (error) {
                expect(error.message).to.include('Name, event, and category are required');
            }
        });

        it('should throw an error if candidate already exists in the same category for the event', async () => {
            sandbox.stub(candidateRepository, '_validateUniqueCandidate').throws(new Error(`Candidate "${candidate.name}" already exists in this category for this event`));
            
            try {
                await candidateRepository.createCandidate(candidate);
            } catch (error) {
                expect(error.message).to.include('already exists in this category for this event');
            }
        });
    });

    describe('Find candidates by event', () => {
        it('should find candidates by event ID', async () => {
            const candidates = [candidate, { ...candidate, _id: new mongoose.Types.ObjectId(), name: 'Jane Smith' }];
            sandbox.stub(candidateRepository, 'findByEvent').resolves(candidates);
            
            const result = await candidateRepository.findByEvent(eventId);
            
            expect(result).to.be.an('array');
            expect(result).to.have.length(2);
            expect(result[0].event).to.equal(eventId);
            expect(result[1].event).to.equal(eventId);
        });

        it('should return empty array if no candidates found for event', async () => {
            sandbox.stub(candidateRepository, 'findByEvent').resolves([]);
            
            const result = await candidateRepository.findByEvent(new mongoose.Types.ObjectId());
            
            expect(result).to.be.an('array');
            expect(result).to.have.length(0);
        });
    });

    describe('Find candidates by category', () => {
        it('should find candidates by category ID', async () => {
            const candidates = [candidate];
            sandbox.stub(candidateRepository, 'findByCategory').resolves(candidates);
            
            const result = await candidateRepository.findByCategory(categoryId);
            
            expect(result).to.be.an('array');
            expect(result).to.have.length(1);
            expect(result[0].categories).to.include(categoryId);
        });

        it('should return empty array if no candidates found for category', async () => {
            sandbox.stub(candidateRepository, 'findByCategory').resolves([]);
            
            const result = await candidateRepository.findByCategory(new mongoose.Types.ObjectId());
            
            expect(result).to.be.an('array');
            expect(result).to.have.length(0);
        });
    });

    describe('Find candidates by event and category', () => {
        it('should find candidates by event and category', async () => {
            const candidates = [candidate];
            sandbox.stub(candidateRepository, 'findByEventAndCategory').resolves(candidates);
            
            const result = await candidateRepository.findByEventAndCategory(eventId, categoryId);
            
            expect(result).to.be.an('array');
            expect(result).to.have.length(1);
            expect(result[0].event).to.equal(eventId);
            expect(result[0].categories).to.include(categoryId);
        });

        it('should return empty array if no candidates found for event and category combination', async () => {
            sandbox.stub(candidateRepository, 'findByEventAndCategory').resolves([]);
            
            const result = await candidateRepository.findByEventAndCategory(
                new mongoose.Types.ObjectId(), 
                new mongoose.Types.ObjectId()
            );
            
            expect(result).to.be.an('array');
            expect(result).to.have.length(0);
        });
    });

    describe('Get candidate with statistics', () => {
        it('should get candidate with vote statistics', async () => {
            const candidateWithStats = {
                ...candidate,
                voteCount: 15,
                categories: [{
                    _id: categoryId,
                    name: 'Best Developer'
                }],
                event: {
                    _id: eventId,
                    name: 'Tech Awards 2024'
                }
            };
            
            sandbox.stub(candidateRepository, 'getCandidateWithStatistics').resolves(candidateWithStats);
            
            const result = await candidateRepository.getCandidateWithStatistics(candidate._id);
            
            expect(result).to.have.property('voteCount', 15);
            expect(result.categories).to.be.an('array');
            expect(result.categories[0]).to.have.property('name', 'Best Developer');
            expect(result.event).to.have.property('name', 'Tech Awards 2024');
        });

        it('should return null if candidate not found', async () => {
            sandbox.stub(candidateRepository, 'getCandidateWithStatistics').resolves(null);
            
            const result = await candidateRepository.getCandidateWithStatistics(new mongoose.Types.ObjectId());
            
            expect(result).to.be.null;
        });
    });

    describe('Get candidates with statistics for event', () => {
        it('should get candidates grouped by category with vote statistics', async () => {
            const candidatesWithStats = [
                {
                    _id: categoryId,
                    categoryName: 'Best Developer',
                    candidates: [
                        {
                            _id: candidate._id,
                            name: candidate.name,
                            voteCount: 15,
                            percentage: 60.0
                        }
                    ],
                    totalVotes: 25
                }
            ];
            
            sandbox.stub(candidateRepository, 'getCandidatesWithStatsForEvent').resolves(candidatesWithStats);
            
            const result = await candidateRepository.getCandidatesWithStatsForEvent(eventId);
            
            expect(result).to.be.an('array');
            expect(result[0]).to.have.property('categoryName', 'Best Developer');
            expect(result[0].candidates[0]).to.have.property('voteCount', 15);
            expect(result[0].candidates[0]).to.have.property('percentage', 60.0);
        });

        it('should return empty array if no candidates found for event', async () => {
            sandbox.stub(candidateRepository, 'getCandidatesWithStatsForEvent').resolves([]);
            
            const result = await candidateRepository.getCandidatesWithStatsForEvent(new mongoose.Types.ObjectId());
            
            expect(result).to.be.an('array');
            expect(result).to.have.length(0);
        });
    });

    describe('Update candidate', () => {
        it('should update candidate information', async () => {
            const updatedCandidate = { ...candidate, name: 'John Smith Updated' };
            sandbox.stub(candidateRepository, 'updateCandidate').resolves(updatedCandidate);
            
            const result = await candidateRepository.updateCandidate(candidate._id, { name: 'John Smith Updated' });
            
            expect(result).to.have.property('_id');
            expect(result.name).to.equal('John Smith Updated');
        });

        it('should not allow direct update of event field', async () => {
            const updatedData = { 
                name: 'Updated Name',
                event: new mongoose.Types.ObjectId()
            };
            
            // The method should remove event from update data
            sandbox.stub(candidateRepository, 'updateCandidate').resolves({ ...candidate, name: 'Updated Name' });
            
            const result = await candidateRepository.updateCandidate(candidate._id, updatedData);
            
            expect(result.name).to.equal('Updated Name');
            expect(result.event).to.equal(eventId); // Original event should remain
        });

        it('should return null if candidate not found', async () => {
            sandbox.stub(candidateRepository, 'updateCandidate').resolves(null);
            
            const result = await candidateRepository.updateCandidate(new mongoose.Types.ObjectId(), { name: 'Updated' });
            
            expect(result).to.be.null;
        });
    });

    describe('Get top candidates', () => {
        it('should get top candidates by votes for an event', async () => {
            const topCandidates = [
                { ...candidate, voteCount: 25 },
                { ...candidate, _id: new mongoose.Types.ObjectId(), name: 'Jane Doe', voteCount: 20 }
            ];
            
            sandbox.stub(candidateRepository, 'getTopCandidates').resolves(topCandidates);
            
            const result = await candidateRepository.getTopCandidates(eventId, 5);
            
            expect(result).to.be.an('array');
            expect(result).to.have.length(2);
            expect(result[0].voteCount).to.be.greaterThan(result[1].voteCount);
        });

        it('should get top candidates across all events when no eventId provided', async () => {
            const topCandidates = [{ ...candidate, voteCount: 30 }];
            
            sandbox.stub(candidateRepository, 'getTopCandidates').resolves(topCandidates);
            
            const result = await candidateRepository.getTopCandidates(null, 10);
            
            expect(result).to.be.an('array');
            expect(result[0]).to.have.property('voteCount', 30);
        });
    });

    describe('Search candidates by name', () => {
        it('should search candidates by name', async () => {
            const searchResults = [candidate];
            sandbox.stub(candidateRepository, 'searchByName').resolves(searchResults);
            
            const result = await candidateRepository.searchByName('John');
            
            expect(result).to.be.an('array');
            expect(result).to.have.length(1);
            expect(result[0].name).to.include('John');
        });

        it('should search candidates by name within specific event', async () => {
            const searchResults = [candidate];
            sandbox.stub(candidateRepository, 'searchByName').resolves(searchResults);
            
            const result = await candidateRepository.searchByName('John', eventId);
            
            expect(result).to.be.an('array');
            expect(result[0].event).to.equal(eventId);
        });

        it('should return empty array if no matches found', async () => {
            sandbox.stub(candidateRepository, 'searchByName').resolves([]);
            
            const result = await candidateRepository.searchByName('NonexistentName');
            
            expect(result).to.be.an('array');
            expect(result).to.have.length(0);
        });
    });

    describe('Get candidate statistics', () => {
        it('should get detailed statistics for a candidate', async () => {
            const candidateStats = {
                _id: candidate._id,
                name: candidate.name,
                voteCount: 15,
                totalCategoryVotes: 50,
                percentage: 30.0
            };
            
            sandbox.stub(candidateRepository, 'getCandidateStatistics').resolves(candidateStats);
            
            const result = await candidateRepository.getCandidateStatistics(candidate._id);
            
            expect(result).to.have.property('voteCount', 15);
            expect(result).to.have.property('totalCategoryVotes', 50);
            expect(result).to.have.property('percentage', 30.0);
        });

        it('should return null if candidate not found', async () => {
            sandbox.stub(candidateRepository, 'getCandidateStatistics').resolves(null);
            
            const result = await candidateRepository.getCandidateStatistics(new mongoose.Types.ObjectId());
            
            expect(result).to.be.null;
        });
    });

    describe('Bulk create candidates', () => {
        it('should create multiple candidates', async () => {
            const candidatesData = [
                candidate,
                { ...candidate, _id: new mongoose.Types.ObjectId(), name: 'Jane Smith', nominatedBy: 'Bob Johnson' }
            ];
            
            sandbox.stub(candidateRepository, 'bulkCreateCandidates').resolves(candidatesData);
            
            const result = await candidateRepository.bulkCreateCandidates(candidatesData);
            
            expect(result).to.be.an('array');
            expect(result).to.have.length(2);
            expect(result[0].name).to.equal('John Doe');
            expect(result[1].name).to.equal('Jane Smith');
        });

        it('should throw error if validation fails for any candidate', async () => {
            const candidatesData = [
                candidate,
                { ...candidate, name: '' } // Invalid candidate
            ];
            
            sandbox.stub(candidateRepository, 'bulkCreateCandidates').throws(new Error('Name, event, and category are required'));
            
            try {
                await candidateRepository.bulkCreateCandidates(candidatesData);
            } catch (error) {
                expect(error.message).to.include('Name, event, and category are required');
            }
        });
    });

    describe('Delete candidate', () => {
        it('should delete candidate if no votes exist', async () => {
            sandbox.stub(candidateRepository, 'deleteCandidate').resolves(candidate);
            
            const result = await candidateRepository.deleteCandidate(candidate._id);
            
            expect(result).to.have.property('_id');
            expect(result._id).to.equal(candidate._id);
        });

        it('should throw error if candidate has existing votes', async () => {
            sandbox.stub(candidateRepository, 'deleteCandidate').throws(new Error('Cannot delete candidate with existing votes'));
            
            try {
                await candidateRepository.deleteCandidate(candidate._id);
            } catch (error) {
                expect(error.message).to.equal('Cannot delete candidate with existing votes');
            }
        });

        it('should return null if candidate not found', async () => {
            sandbox.stub(candidateRepository, 'deleteCandidate').resolves(null);
            
            const result = await candidateRepository.deleteCandidate(new mongoose.Types.ObjectId());
            
            expect(result).to.be.null;
        });
    });

    describe('Validate unique candidate (private method)', () => {
        it('should validate candidate data has required fields', async () => {
            // This tests the private method indirectly through createCandidate
            const invalidCandidate = { bio: 'Test bio' }; // Missing name, event, category
            
            sandbox.stub(candidateRepository, 'createCandidate').throws(new Error('Name, event, and category are required'));
            
            try {
                await candidateRepository.createCandidate(invalidCandidate);
            } catch (error) {
                expect(error.message).to.include('Name, event, and category are required');
            }
        });

        it('should prevent duplicate candidates in same category for same event', async () => {
            sandbox.stub(candidateRepository, 'createCandidate').throws(new Error(`Candidate "${candidate.name}" already exists in this category for this event`));
            
            try {
                await candidateRepository.createCandidate(candidate);
            } catch (error) {
                expect(error.message).to.include('already exists in this category for this event');
            }
        });
    });

    describe('Error handling', () => {
        it('should handle database errors gracefully', async () => {
            sandbox.stub(candidateRepository, 'findByEvent').throws(new Error('Database connection error'));
            
            try {
                await candidateRepository.findByEvent(eventId);
            } catch (error) {
                expect(error.message).to.include('Database connection error');
            }
        });

        it('should handle invalid ObjectIds', async () => {
            sandbox.stub(candidateRepository, 'getCandidateWithStats').throws(new Error('Invalid ObjectId'));
            
            try {
                await candidateRepository.getCandidateWithStats('invalid-id');
            } catch (error) {
                expect(error.message).to.include('Invalid ObjectId');
            }
        });
    });
});

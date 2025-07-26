#!/usr/bin/env node
/**
 * Vote Repository test suite
 * This file contains tests for the VoteRepository class, ensuring that it correctly manages voting operations.
 */
import { expect } from 'chai';
import sinon from 'sinon';
import mongoose from 'mongoose';
import VoteRepository from '../../repositories/VoteRepository.js';
import { after, afterEach, beforeEach, describe, it } from 'mocha';

describe('VoteRepository', () => {
    let voteRepository;
    let sandbox;
    let vote;
    let eventId;
    let categoryId;
    let candidateId;
    let userId;
    let voteBundleIds;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        voteRepository = new VoteRepository();
        
        eventId = new mongoose.Types.ObjectId();
        categoryId = new mongoose.Types.ObjectId();
        candidateId = new mongoose.Types.ObjectId();
        userId = new mongoose.Types.ObjectId();
        voteBundleIds = [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()];
        
        vote = {
            _id: new mongoose.Types.ObjectId(),
            candidate: candidateId,
            voter: {
                id: userId,
                name: 'John Voter',
                email: 'john@voter.com'
            },
            event: eventId,
            category: categoryId,
            voteBundles: voteBundleIds,
            votedAt: new Date(),
            ipAddress: '192.168.1.100'
        };
    });

    afterEach(() => {
        sandbox.restore();
    });

    after(() => {
        mongoose.connection.close();
    });

    describe('Cast vote', () => {
        it('should cast a vote with valid data', async () => {
            const voteData = {
                candidate: candidateId,
                voter: vote.voter,
                event: eventId,
                category: categoryId,
                voteBundle: voteBundleIds[0],
                ipAddress: '192.168.1.100'
            };

            sandbox.stub(voteRepository, 'castVote').resolves(vote);
            
            const result = await voteRepository.castVote(voteData);
            
            expect(result).to.have.property('_id');
            expect(result.candidate).to.equal(candidateId);
            expect(result.voter).to.have.property('name', 'John Voter');
            expect(result.event).to.equal(eventId);
            expect(result.category).to.equal(categoryId);
            expect(result).to.have.property('votedAt');
        });

        it('should add votedAt timestamp when casting vote', async () => {
            const voteData = {
                candidate: candidateId,
                voter: vote.voter,
                event: eventId,
                category: categoryId,
                voteBundle: voteBundleIds[0]
            };

            const voteWithTimestamp = { ...vote, votedAt: new Date() };
            sandbox.stub(voteRepository, 'castVote').resolves(voteWithTimestamp);
            
            const result = await voteRepository.castVote(voteData);
            
            expect(result.votedAt).to.be.a('date');
        });

        it('should handle missing IP address gracefully', async () => {
            const voteData = {
                candidate: candidateId,
                voter: vote.voter,
                event: eventId,
                category: categoryId,
                voteBundle: voteBundleIds[0]
                // No ipAddress provided
            };

            const voteWithoutIP = { ...vote, ipAddress: null };
            sandbox.stub(voteRepository, 'castVote').resolves(voteWithoutIP);
            
            const result = await voteRepository.castVote(voteData);
            
            expect(result.ipAddress).to.be.null;
        });

        it('should throw error for invalid vote data', async () => {
            const invalidVoteData = {
                candidate: candidateId,
                // Missing required fields
            };

            sandbox.stub(voteRepository, 'castVote').throws(new Error('Missing required vote data'));
            
            try {
                await voteRepository.castVote(invalidVoteData);
            } catch (error) {
                expect(error.message).to.include('Missing required vote data');
            }
        });

        it('should validate vote data before casting', async () => {
            const voteData = {
                candidate: candidateId,
                voter: vote.voter,
                event: eventId,
                category: categoryId,
                voteBundle: voteBundleIds[0]
            };

            sandbox.stub(voteRepository, 'castVote').resolves(vote);
            
            const result = await voteRepository.castVote(voteData);
            
            expect(result).to.have.property('candidate');
            expect(result).to.have.property('voter');
            expect(result).to.have.property('event');
            expect(result).to.have.property('category');
        });
    });

    describe('Find existing vote', () => {
        it('should find existing vote for user in event/category', async () => {
            sandbox.stub(voteRepository, 'findExistingVote').resolves(vote);
            
            const result = await voteRepository.findExistingVote(userId, eventId, categoryId);
            
            expect(result).to.have.property('_id');
            expect(result.voter.id).to.equal(userId);
            expect(result.event).to.equal(eventId);
            expect(result.category).to.equal(categoryId);
        });

        it('should return null if no existing vote found', async () => {
            sandbox.stub(voteRepository, 'findExistingVote').resolves(null);
            
            const result = await voteRepository.findExistingVote(
                new mongoose.Types.ObjectId(), 
                eventId, 
                categoryId
            );
            
            expect(result).to.be.null;
        });

        it('should handle different user/event/category combinations', async () => {
            const differentEventId = new mongoose.Types.ObjectId();
            sandbox.stub(voteRepository, 'findExistingVote').resolves(null);
            
            const result = await voteRepository.findExistingVote(userId, differentEventId, categoryId);
            
            expect(result).to.be.null;
        });
    });

    describe('Get votes by event', () => {
        it('should return votes for a specific event', async () => {
            const eventVotes = [
                vote,
                { ...vote, _id: new mongoose.Types.ObjectId(), voter: { ...vote.voter, name: 'Jane Voter' } }
            ];
            
            sandbox.stub(voteRepository, 'getVotesByEvent').resolves(eventVotes);
            
            const result = await voteRepository.getVotesByEvent(eventId);
            
            expect(result).to.be.an('array');
            expect(result).to.have.length(2);
            expect(result[0].event).to.equal(eventId);
            expect(result[1].event).to.equal(eventId);
        });

        it('should include populated user, candidate, and category data', async () => {
            const populatedVote = {
                ...vote,
                user: { _id: userId, name: 'John Voter', email: 'john@voter.com' },
                candidate: { _id: candidateId, name: 'John Candidate' },
                category: { _id: categoryId, name: 'Best Developer' }
            };
            
            sandbox.stub(voteRepository, 'getVotesByEvent').resolves([populatedVote]);
            
            const result = await voteRepository.getVotesByEvent(eventId);
            
            expect(result[0]).to.have.property('user');
            expect(result[0].user).to.have.property('name', 'John Voter');
            expect(result[0]).to.have.property('candidate');
            expect(result[0].candidate).to.have.property('name', 'John Candidate');
            expect(result[0]).to.have.property('category');
            expect(result[0].category).to.have.property('name', 'Best Developer');
        });

        it('should return empty array if no votes for event', async () => {
            sandbox.stub(voteRepository, 'getVotesByEvent').resolves([]);
            
            const result = await voteRepository.getVotesByEvent(new mongoose.Types.ObjectId());
            
            expect(result).to.be.an('array');
            expect(result).to.have.length(0);
        });

        it('should sort votes by votedAt in descending order', async () => {
            const olderVote = { ...vote, votedAt: new Date('2024-01-01') };
            const newerVote = { ...vote, _id: new mongoose.Types.ObjectId(), votedAt: new Date('2024-01-02') };
            
            sandbox.stub(voteRepository, 'getVotesByEvent').resolves([newerVote, olderVote]);
            
            const result = await voteRepository.getVotesByEvent(eventId);
            
            expect(result[0].votedAt).to.be.greaterThan(result[1].votedAt);
        });
    });

    describe('Get votes by candidate', () => {
        it('should return votes for a specific candidate', async () => {
            const candidateVotes = [vote];
            
            sandbox.stub(voteRepository, 'getVotesByCandidate').resolves(candidateVotes);
            
            const result = await voteRepository.getVotesByCandidate(candidateId);
            
            expect(result).to.be.an('array');
            expect(result[0].candidate).to.equal(candidateId);
        });

        it('should include populated user, event, and category data', async () => {
            const populatedVote = {
                ...vote,
                user: { _id: userId, name: 'John Voter', email: 'john@voter.com' },
                event: { _id: eventId, name: 'Tech Awards 2024' },
                category: { _id: categoryId, name: 'Best Developer' }
            };
            
            sandbox.stub(voteRepository, 'getVotesByCandidate').resolves([populatedVote]);
            
            const result = await voteRepository.getVotesByCandidate(candidateId);
            
            expect(result[0].user).to.have.property('name', 'John Voter');
            expect(result[0].event).to.have.property('name', 'Tech Awards 2024');
            expect(result[0].category).to.have.property('name', 'Best Developer');
        });

        it('should return empty array if no votes for candidate', async () => {
            sandbox.stub(voteRepository, 'getVotesByCandidate').resolves([]);
            
            const result = await voteRepository.getVotesByCandidate(new mongoose.Types.ObjectId());
            
            expect(result).to.be.an('array');
            expect(result).to.have.length(0);
        });
    });

    describe('Count votes for candidate', () => {
        it('should return correct vote count for candidate', async () => {
            sandbox.stub(voteRepository, 'countVotesForCandidate').resolves(25);
            
            const result = await voteRepository.countVotesForCandidate(candidateId);
            
            expect(result).to.equal(25);
        });

        it('should return zero for candidate with no votes', async () => {
            sandbox.stub(voteRepository, 'countVotesForCandidate').resolves(0);
            
            const result = await voteRepository.countVotesForCandidate(new mongoose.Types.ObjectId());
            
            expect(result).to.equal(0);
        });

        it('should handle large vote counts', async () => {
            sandbox.stub(voteRepository, 'countVotesForCandidate').resolves(10000);
            
            const result = await voteRepository.countVotesForCandidate(candidateId);
            
            expect(result).to.equal(10000);
        });
    });

    describe('Get vote counts by category', () => {
        it('should return vote counts grouped by category', async () => {
            const categoryVoteCounts = [
                {
                    _id: categoryId,
                    categoryName: 'Best Developer',
                    candidates: [
                        {
                            candidateId: candidateId,
                            candidateName: 'John Candidate',
                            voteCount: 15
                        },
                        {
                            candidateId: new mongoose.Types.ObjectId(),
                            candidateName: 'Jane Candidate',
                            voteCount: 10
                        }
                    ],
                    totalVotes: 25
                }
            ];
            
            sandbox.stub(voteRepository, 'getVoteCountsByCategory').resolves(categoryVoteCounts);
            
            const result = await voteRepository.getVoteCountsByCategory(eventId);
            
            expect(result).to.be.an('array');
            expect(result[0]).to.have.property('categoryName', 'Best Developer');
            expect(result[0]).to.have.property('totalVotes', 25);
            expect(result[0].candidates).to.have.length(2);
            expect(result[0].candidates[0]).to.have.property('voteCount', 15);
        });

        it('should return empty array for event with no votes', async () => {
            sandbox.stub(voteRepository, 'getVoteCountsByCategory').resolves([]);
            
            const result = await voteRepository.getVoteCountsByCategory(new mongoose.Types.ObjectId());
            
            expect(result).to.be.an('array');
            expect(result).to.have.length(0);
        });

        it('should sort results by category name', async () => {
            const sortedCategories = [
                { _id: categoryId, categoryName: 'Best Developer', candidates: [], totalVotes: 10 },
                { _id: new mongoose.Types.ObjectId(), categoryName: 'Best Designer', candidates: [], totalVotes: 8 }
            ];
            
            sandbox.stub(voteRepository, 'getVoteCountsByCategory').resolves(sortedCategories);
            
            const result = await voteRepository.getVoteCountsByCategory(eventId);
            
            expect(result[0].categoryName).to.equal('Best Developer');
            expect(result[1].categoryName).to.equal('Best Designer');
        });
    });

    describe('Get election results', () => {
        it('should return comprehensive election results', async () => {
            const electionResults = {
                eventId: eventId,
                totalVotes: 100,
                uniqueVoters: 85,
                categoriesResults: [
                    {
                        _id: categoryId,
                        categoryName: 'Best Developer',
                        candidates: [
                            {
                                candidateId: candidateId,
                                candidateName: 'John Candidate',
                                voteCount: 15,
                                percentage: 60.0
                            },
                            {
                                candidateId: new mongoose.Types.ObjectId(),
                                candidateName: 'Jane Candidate',
                                voteCount: 10,
                                percentage: 40.0
                            }
                        ],
                        totalVotes: 25,
                        winner: {
                            candidateId: candidateId,
                            candidateName: 'John Candidate',
                            voteCount: 15,
                            percentage: 60.0
                        }
                    }
                ],
                generatedAt: new Date()
            };
            
            sandbox.stub(voteRepository, 'getElectionResults').resolves(electionResults);
            
            const result = await voteRepository.getElectionResults(eventId);
            
            expect(result).to.have.property('eventId', eventId);
            expect(result).to.have.property('totalVotes', 100);
            expect(result).to.have.property('uniqueVoters', 85);
            expect(result).to.have.property('categoriesResults');
            expect(result).to.have.property('generatedAt');
            
            const category = result.categoriesResults[0];
            expect(category).to.have.property('categoryName', 'Best Developer');
            expect(category).to.have.property('winner');
            expect(category.winner).to.have.property('candidateName', 'John Candidate');
            expect(category.candidates[0]).to.have.property('percentage', 60.0);
        });

        it('should calculate percentages correctly', async () => {
            const resultsWithPercentages = {
                eventId: eventId,
                totalVotes: 200,
                uniqueVoters: 200,
                categoriesResults: [
                    {
                        _id: categoryId,
                        categoryName: 'Best Developer',
                        candidates: [
                            {
                                candidateId: candidateId,
                                candidateName: 'Leading Candidate',
                                voteCount: 80,
                                percentage: 80.0
                            },
                            {
                                candidateId: new mongoose.Types.ObjectId(),
                                candidateName: 'Second Candidate',
                                voteCount: 20,
                                percentage: 20.0
                            }
                        ],
                        totalVotes: 100,
                        winner: {
                            candidateId: candidateId,
                            candidateName: 'Leading Candidate',
                            voteCount: 80,
                            percentage: 80.0
                        }
                    }
                ],
                generatedAt: new Date()
            };
            
            sandbox.stub(voteRepository, 'getElectionResults').resolves(resultsWithPercentages);
            
            const result = await voteRepository.getElectionResults(eventId);
            
            const category = result.categoriesResults[0];
            expect(category.candidates[0].percentage).to.equal(80.0);
            expect(category.candidates[1].percentage).to.equal(20.0);
        });

        it('should identify the correct winner for each category', async () => {
            const resultsWithWinner = {
                eventId: eventId,
                totalVotes: 50,
                uniqueVoters: 50,
                categoriesResults: [
                    {
                        _id: categoryId,
                        categoryName: 'Best Developer',
                        candidates: [
                            {
                                candidateId: new mongoose.Types.ObjectId(),
                                candidateName: 'Second Place',
                                voteCount: 20,
                                percentage: 40.0
                            },
                            {
                                candidateId: candidateId,
                                candidateName: 'Winner',
                                voteCount: 30,
                                percentage: 60.0
                            }
                        ],
                        totalVotes: 50,
                        winner: {
                            candidateId: candidateId,
                            candidateName: 'Winner',
                            voteCount: 30,
                            percentage: 60.0
                        }
                    }
                ],
                generatedAt: new Date()
            };
            
            sandbox.stub(voteRepository, 'getElectionResults').resolves(resultsWithWinner);
            
            const result = await voteRepository.getElectionResults(eventId);
            
            const category = result.categoriesResults[0];
            expect(category.winner.candidateName).to.equal('Winner');
            expect(category.winner.voteCount).to.equal(30);
        });

        it('should return results with zero votes gracefully', async () => {
            const emptyResults = {
                eventId: eventId,
                totalVotes: 0,
                uniqueVoters: 0,
                categoriesResults: [],
                generatedAt: new Date()
            };
            
            sandbox.stub(voteRepository, 'getElectionResults').resolves(emptyResults);
            
            const result = await voteRepository.getElectionResults(eventId);
            
            expect(result.totalVotes).to.equal(0);
            expect(result.uniqueVoters).to.equal(0);
            expect(result.categoriesResults).to.be.an('array');
            expect(result.categoriesResults).to.have.length(0);
        });
    });

    describe('Get voting statistics', () => {
        it('should return comprehensive voting statistics', async () => {
            const votingStats = {
                totalVotes: 150,
                uniqueVotersCount: 120,
                firstVote: new Date('2024-01-01T09:00:00Z'),
                lastVote: new Date('2024-01-01T18:00:00Z')
            };
            
            sandbox.stub(voteRepository, 'getVotingStats').resolves(votingStats);
            
            const result = await voteRepository.getVotingStats(eventId);
            
            expect(result).to.have.property('totalVotes', 150);
            expect(result).to.have.property('uniqueVotersCount', 120);
            expect(result).to.have.property('firstVote');
            expect(result).to.have.property('lastVote');
            expect(result.firstVote).to.be.a('date');
            expect(result.lastVote).to.be.a('date');
        });

        it('should return default statistics for event with no votes', async () => {
            const defaultStats = {
                totalVotes: 0,
                uniqueVotersCount: 0,
                firstVote: null,
                lastVote: null
            };
            
            sandbox.stub(voteRepository, 'getVotingStats').resolves(defaultStats);
            
            const result = await voteRepository.getVotingStats(new mongoose.Types.ObjectId());
            
            expect(result.totalVotes).to.equal(0);
            expect(result.uniqueVotersCount).to.equal(0);
            expect(result.firstVote).to.be.null;
            expect(result.lastVote).to.be.null;
        });

        it('should calculate voting time range correctly', async () => {
            const statsWithTimeRange = {
                totalVotes: 100,
                uniqueVotersCount: 90,
                firstVote: new Date('2024-01-01T08:00:00Z'),
                lastVote: new Date('2024-01-01T20:00:00Z')
            };
            
            sandbox.stub(voteRepository, 'getVotingStats').resolves(statsWithTimeRange);
            
            const result = await voteRepository.getVotingStats(eventId);
            
            expect(result.firstVote).to.be.lessThan(result.lastVote);
            const timeDiff = result.lastVote.getTime() - result.firstVote.getTime();
            expect(timeDiff).to.be.greaterThan(0);
        });

        it('should handle single vote scenario', async () => {
            const singleVoteStats = {
                totalVotes: 1,
                uniqueVotersCount: 1,
                firstVote: new Date('2024-01-01T12:00:00Z'),
                lastVote: new Date('2024-01-01T12:00:00Z')
            };
            
            sandbox.stub(voteRepository, 'getVotingStats').resolves(singleVoteStats);
            
            const result = await voteRepository.getVotingStats(eventId);
            
            expect(result.totalVotes).to.equal(1);
            expect(result.uniqueVotersCount).to.equal(1);
            expect(result.firstVote.getTime()).to.equal(result.lastVote.getTime());
        });
    });

    describe('Vote data validation', () => {
        it('should validate required fields are present', async () => {
            const validVoteData = {
                voteBundle: voteBundleIds[0],
                candidate: candidateId,
                event: eventId,
                category: categoryId,
                voter: vote.voter
            };
            
            // This should not throw an error
            sandbox.stub(voteRepository, 'castVote').resolves(vote);
            
            const result = await voteRepository.castVote(validVoteData);
            expect(result).to.have.property('_id');
        });

        it('should throw error when voteBundle is missing', async () => {
            const invalidVoteData = {
                candidate: candidateId,
                event: eventId,
                category: categoryId,
                voter: vote.voter
                // Missing voteBundle
            };
            
            sandbox.stub(voteRepository, 'castVote').throws(new Error('Missing required vote data'));
            
            try {
                await voteRepository.castVote(invalidVoteData);
            } catch (error) {
                expect(error.message).to.include('Missing required vote data');
            }
        });

        it('should throw error when candidate is missing', async () => {
            const invalidVoteData = {
                voteBundle: voteBundleIds[0],
                event: eventId,
                category: categoryId,
                voter: vote.voter
                // Missing candidate
            };
            
            sandbox.stub(voteRepository, 'castVote').throws(new Error('Missing required vote data'));
            
            try {
                await voteRepository.castVote(invalidVoteData);
            } catch (error) {
                expect(error.message).to.include('Missing required vote data');
            }
        });

        it('should throw error when event is missing', async () => {
            const invalidVoteData = {
                voteBundle: voteBundleIds[0],
                candidate: candidateId,
                category: categoryId,
                voter: vote.voter
                // Missing event
            };
            
            sandbox.stub(voteRepository, 'castVote').throws(new Error('Missing required vote data'));
            
            try {
                await voteRepository.castVote(invalidVoteData);
            } catch (error) {
                expect(error.message).to.include('Missing required vote data');
            }
        });

        it('should throw error when category is missing', async () => {
            const invalidVoteData = {
                voteBundle: voteBundleIds[0],
                candidate: candidateId,
                event: eventId,
                voter: vote.voter
                // Missing category
            };
            
            sandbox.stub(voteRepository, 'castVote').throws(new Error('Missing required vote data'));
            
            try {
                await voteRepository.castVote(invalidVoteData);
            } catch (error) {
                expect(error.message).to.include('Missing required vote data');
            }
        });

        it('should throw error when voter is missing', async () => {
            const invalidVoteData = {
                voteBundle: voteBundleIds[0],
                candidate: candidateId,
                event: eventId,
                category: categoryId
                // Missing voter
            };
            
            sandbox.stub(voteRepository, 'castVote').throws(new Error('Missing required vote data'));
            
            try {
                await voteRepository.castVote(invalidVoteData);
            } catch (error) {
                expect(error.message).to.include('Missing required vote data');
            }
        });
    });

    describe('Error handling', () => {
        it('should handle database errors gracefully in castVote', async () => {
            const voteData = {
                voteBundle: voteBundleIds[0],
                candidate: candidateId,
                event: eventId,
                category: categoryId,
                voter: vote.voter
            };
            
            sandbox.stub(voteRepository, 'castVote').throws(new Error('Database connection error'));
            
            try {
                await voteRepository.castVote(voteData);
            } catch (error) {
                expect(error.message).to.include('Database connection error');
            }
        });

        it('should handle invalid ObjectId errors', async () => {
            sandbox.stub(voteRepository, 'getVotesByEvent').throws(new Error('Invalid ObjectId'));
            
            try {
                await voteRepository.getVotesByEvent('invalid-id');
            } catch (error) {
                expect(error.message).to.include('Invalid ObjectId');
            }
        });

        it('should handle aggregation pipeline errors', async () => {
            sandbox.stub(voteRepository, 'getElectionResults').throws(new Error('Aggregation failed'));
            
            try {
                await voteRepository.getElectionResults(eventId);
            } catch (error) {
                expect(error.message).to.include('Aggregation failed');
            }
        });

        it('should handle network timeouts gracefully', async () => {
            sandbox.stub(voteRepository, 'findExistingVote').throws(new Error('Network timeout'));
            
            try {
                await voteRepository.findExistingVote(userId, eventId, categoryId);
            } catch (error) {
                expect(error.message).to.include('Network timeout');
            }
        });
    });

    describe('Edge cases', () => {
        it('should handle votes with multiple vote bundles', async () => {
            const voteWithMultipleBundles = {
                ...vote,
                voteBundles: [voteBundleIds[0], voteBundleIds[1]]
            };
            
            sandbox.stub(voteRepository, 'castVote').resolves(voteWithMultipleBundles);
            
            const voteData = {
                voteBundle: voteBundleIds[0],
                candidate: candidateId,
                event: eventId,
                category: categoryId,
                voter: vote.voter
            };
            
            const result = await voteRepository.castVote(voteData);
            
            expect(result.voteBundles).to.be.an('array');
            expect(result.voteBundles).to.have.length(2);
        });

        it('should handle votes with complex voter objects', async () => {
            const complexVoter = {
                id: userId,
                name: 'John Complex Voter',
                email: 'john@complex.com',
                metadata: {
                    device: 'mobile',
                    browser: 'Chrome',
                    location: 'Ghana'
                }
            };
            
            const voteWithComplexVoter = { ...vote, voter: complexVoter };
            sandbox.stub(voteRepository, 'castVote').resolves(voteWithComplexVoter);
            
            const voteData = {
                voteBundle: voteBundleIds[0],
                candidate: candidateId,
                event: eventId,
                category: categoryId,
                voter: complexVoter
            };
            
            const result = await voteRepository.castVote(voteData);
            
            expect(result.voter).to.have.property('metadata');
            expect(result.voter.metadata).to.have.property('device', 'mobile');
        });

        it('should handle concurrent voting scenarios', async () => {
            const concurrentVotes = [
                { ...vote, _id: new mongoose.Types.ObjectId(), votedAt: new Date('2024-01-01T12:00:00Z') },
                { ...vote, _id: new mongoose.Types.ObjectId(), votedAt: new Date('2024-01-01T12:00:01Z') },
                { ...vote, _id: new mongoose.Types.ObjectId(), votedAt: new Date('2024-01-01T12:00:02Z') }
            ];
            
            sandbox.stub(voteRepository, 'getVotesByEvent').resolves(concurrentVotes);
            
            const result = await voteRepository.getVotesByEvent(eventId);
            
            expect(result).to.have.length(3);
            // Should be sorted by votedAt descending
            expect(result[1].votedAt).to.be.greaterThan(result[0].votedAt);
            expect(result[2].votedAt).to.be.greaterThan(result[1].votedAt);
        });

        it('should handle very large vote counts', async () => {
            sandbox.stub(voteRepository, 'countVotesForCandidate').resolves(1000000);
            
            const result = await voteRepository.countVotesForCandidate(candidateId);
            
            expect(result).to.equal(1000000);
        });
    });
});

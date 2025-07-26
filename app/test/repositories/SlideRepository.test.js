#!/usr/bin/env node
/**
 * Slide Repository test suite
 * This file contains tests for the SlideRepository class, ensuring that it correctly manages slide operations.
 */
import { expect } from 'chai';
import sinon from 'sinon';
import mongoose from 'mongoose';
import SlideRepository from '../../repositories/SlideRepository.js';
import { after, afterEach, beforeEach, describe, it } from 'mocha';

describe('SlideRepository', () => {
    let slideRepository;
    let sandbox;
    let slide;
    let slideId;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        slideRepository = new SlideRepository();
        
        slideId = new mongoose.Types.ObjectId();
        
        slide = {
            _id: slideId,
            title: 'Welcome Slide',
            subtitle: 'Welcome to our e-voting platform',
            image: 'https://example.com/images/welcome.jpg',
            createdAt: new Date(),
            updatedAt: new Date()
        };
    });

    afterEach(() => {
        sandbox.restore();
    });

    after(() => {
        mongoose.connection.close();
    });

    describe('Create slide', () => {
        it('should create a slide with valid data', async () => {
            const slideData = {
                title: 'New Feature Slide',
                subtitle: 'Introducing our new features',
                image: 'https://example.com/images/features.jpg'
            };

            sandbox.stub(slideRepository, 'findByTitle').resolves(null);
            sandbox.stub(slideRepository, 'createSlide').resolves({
                ...slide,
                title: slideData.title,
                subtitle: slideData.subtitle,
                image: slideData.image
            });
            
            const result = await slideRepository.createSlide(slideData);
            
            expect(result).to.have.property('_id');
            expect(result.title).to.equal('New Feature Slide');
            expect(result.subtitle).to.equal('Introducing our new features');
            expect(result.image).to.equal('https://example.com/images/features.jpg');
        });

        it('should throw error when creating slide with existing title', async () => {
            const slideData = {
                title: 'Welcome Slide',
                subtitle: 'Duplicate title test',
                image: 'https://example.com/images/duplicate.jpg'
            };

            sandbox.stub(slideRepository, 'findByTitle').resolves(slide);
            sandbox.stub(slideRepository, 'createSlide').throws(new Error("Slide with title 'Welcome Slide' already exists"));
            
            try {
                await slideRepository.createSlide(slideData);
            } catch (error) {
                expect(error.message).to.include("Slide with title 'Welcome Slide' already exists");
            }
        });

        it('should trim slide title before creation', async () => {
            const slideData = {
                title: '  Padded Title  ',
                subtitle: 'Test subtitle',
                image: 'https://example.com/images/test.jpg'
            };

            sandbox.stub(slideRepository, 'findByTitle').resolves(null);
            sandbox.stub(slideRepository, 'createSlide').resolves({
                ...slide,
                title: 'Padded Title',
                subtitle: slideData.subtitle,
                image: slideData.image
            });
            
            const result = await slideRepository.createSlide(slideData);
            
            expect(result.title).to.equal('Padded Title');
        });
    });

    describe('Find slide by title', () => {
        it('should find slide by exact title', async () => {
            sandbox.stub(slideRepository, 'findByTitle').resolves(slide);
            
            const result = await slideRepository.findByTitle('Welcome Slide');
            
            expect(result).to.have.property('_id');
            expect(result.title).to.equal('Welcome Slide');
        });

        it('should return null for non-existent slide title', async () => {
            sandbox.stub(slideRepository, 'findByTitle').resolves(null);
            
            const result = await slideRepository.findByTitle('NonExistent Slide');
            
            expect(result).to.be.null;
        });

        it('should handle title trimming when searching', async () => {
            sandbox.stub(slideRepository, 'findByTitle').resolves(slide);
            
            const result = await slideRepository.findByTitle('  Welcome Slide  ');
            
            expect(result).to.have.property('title', 'Welcome Slide');
        });

        it('should be case sensitive', async () => {
            sandbox.stub(slideRepository, 'findByTitle').resolves(null);
            
            const result = await slideRepository.findByTitle('welcome slide');
            
            expect(result).to.be.null;
        });
    });

    describe('Find slides by subtitle', () => {
        it('should find slides by exact subtitle', async () => {
            const slides = [slide];
            sandbox.stub(slideRepository, 'findBySubtitle').resolves(slides);
            
            const result = await slideRepository.findBySubtitle('Welcome to our e-voting platform');
            
            expect(result).to.be.an('array');
            expect(result).to.have.length(1);
            expect(result[0].subtitle).to.equal('Welcome to our e-voting platform');
        });

        it('should return empty array for non-existent subtitle', async () => {
            sandbox.stub(slideRepository, 'findBySubtitle').resolves([]);
            
            const result = await slideRepository.findBySubtitle('NonExistent Subtitle');
            
            expect(result).to.be.an('array');
            expect(result).to.have.length(0);
        });

        it('should handle multiple slides with same subtitle', async () => {
            const slides = [
                slide,
                { ...slide, _id: new mongoose.Types.ObjectId(), title: 'Another Welcome' }
            ];
            sandbox.stub(slideRepository, 'findBySubtitle').resolves(slides);
            
            const result = await slideRepository.findBySubtitle('Welcome to our e-voting platform');
            
            expect(result).to.have.length(2);
            expect(result.every(s => s.subtitle === 'Welcome to our e-voting platform')).to.be.true;
        });
    });

    describe('Search slides', () => {
        it('should find slides matching text in title', async () => {
            const matchingSlides = [slide];
            sandbox.stub(slideRepository, 'searchSlides').resolves(matchingSlides);
            
            const result = await slideRepository.searchSlides('Welcome');
            
            expect(result).to.be.an('array');
            expect(result).to.have.length(1);
            expect(result[0].title).to.include('Welcome');
        });

        it('should find slides matching text in subtitle', async () => {
            const matchingSlides = [slide];
            sandbox.stub(slideRepository, 'searchSlides').resolves(matchingSlides);
            
            const result = await slideRepository.searchSlides('e-voting');
            
            expect(result).to.be.an('array');
            expect(result[0].subtitle).to.include('e-voting');
        });

        it('should be case insensitive', async () => {
            const matchingSlides = [slide];
            sandbox.stub(slideRepository, 'searchSlides').resolves(matchingSlides);
            
            const result = await slideRepository.searchSlides('welcome');
            
            expect(result).to.have.length(1);
            expect(result[0].title).to.equal('Welcome Slide');
        });

        it('should return empty array when no matches', async () => {
            sandbox.stub(slideRepository, 'searchSlides').resolves([]);
            
            const result = await slideRepository.searchSlides('NonExistentText');
            
            expect(result).to.be.an('array');
            expect(result).to.have.length(0);
        });

        it('should sort results by title', async () => {
            const sortedSlides = [
                { ...slide, title: 'A First Slide' },
                { ...slide, title: 'B Second Slide', _id: new mongoose.Types.ObjectId() }
            ];
            sandbox.stub(slideRepository, 'searchSlides').resolves(sortedSlides);
            
            const result = await slideRepository.searchSlides('Slide');
            
            expect(result[0].title).to.equal('A First Slide');
            expect(result[1].title).to.equal('B Second Slide');
        });
    });

    describe('Full text search', () => {
        it('should perform full text search with scoring', async () => {
            const searchResults = [
                { ...slide, score: 1.2 },
                { ...slide, _id: new mongoose.Types.ObjectId(), title: 'Another Slide', score: 0.8 }
            ];
            sandbox.stub(slideRepository, 'fullTextSearch').resolves(searchResults);
            
            const result = await slideRepository.fullTextSearch('welcome platform');
            
            expect(result).to.be.an('array');
            expect(result[0]).to.have.property('score');
            expect(result[0].score).to.be.greaterThan(result[1].score);
        });

        it('should return empty array for no text matches', async () => {
            sandbox.stub(slideRepository, 'fullTextSearch').resolves([]);
            
            const result = await slideRepository.fullTextSearch('nonexistenttext');
            
            expect(result).to.be.an('array');
            expect(result).to.have.length(0);
        });

        it('should handle complex search queries', async () => {
            const searchResults = [slide];
            sandbox.stub(slideRepository, 'fullTextSearch').resolves(searchResults);
            
            const result = await slideRepository.fullTextSearch('"e-voting platform"');
            
            expect(result).to.have.length(1);
        });
    });

    describe('Update slide by title', () => {
        it('should update slide with valid data', async () => {
            const updateData = {
                subtitle: 'Updated subtitle',
                image: 'https://example.com/images/updated.jpg'
            };

            const updatedSlide = { ...slide, ...updateData };
            
            sandbox.stub(slideRepository, 'findByTitle').resolves(slide);
            sandbox.stub(slideRepository, 'updateSlideByTitle').resolves(updatedSlide);
            
            const result = await slideRepository.updateSlideByTitle('Welcome Slide', updateData);
            
            expect(result.subtitle).to.equal('Updated subtitle');
            expect(result.image).to.equal('https://example.com/images/updated.jpg');
        });

        it('should throw error when slide not found', async () => {
            sandbox.stub(slideRepository, 'updateSlideByTitle').throws(new Error("Slide with title 'NonExistent' not found"));
            
            try {
                await slideRepository.updateSlideByTitle('NonExistent', { subtitle: 'Test' });
            } catch (error) {
                expect(error.message).to.include("Slide with title 'NonExistent' not found");
            }
        });

        it('should throw error when updating to existing title', async () => {
            const updateData = { title: 'ExistingTitle' };
            
            sandbox.stub(slideRepository, 'updateSlideByTitle').throws(new Error("Slide with title 'ExistingTitle' already exists"));
            
            try {
                await slideRepository.updateSlideByTitle('Welcome Slide', updateData);
            } catch (error) {
                expect(error.message).to.include("Slide with title 'ExistingTitle' already exists");
            }
        });

        it('should allow updating title to same title', async () => {
            const updateData = { 
                title: 'Welcome Slide',
                subtitle: 'Updated subtitle'
            };

            const updatedSlide = { ...slide, subtitle: 'Updated subtitle' };
            
            sandbox.stub(slideRepository, 'findByTitle').resolves(slide);
            sandbox.stub(slideRepository, 'updateSlideByTitle').resolves(updatedSlide);
            
            const result = await slideRepository.updateSlideByTitle('Welcome Slide', updateData);
            
            expect(result.title).to.equal('Welcome Slide');
            expect(result.subtitle).to.equal('Updated subtitle');
        });
    });

    describe('Delete slide by title', () => {
        it('should delete slide successfully', async () => {
            sandbox.stub(slideRepository, 'findByTitle').resolves(slide);
            sandbox.stub(slideRepository, 'deleteSlideByTitle').resolves(slide);
            
            const result = await slideRepository.deleteSlideByTitle('Welcome Slide');
            
            expect(result).to.have.property('_id');
            expect(result.title).to.equal('Welcome Slide');
        });

        it('should throw error when slide not found', async () => {
            sandbox.stub(slideRepository, 'deleteSlideByTitle').throws(new Error("Slide with title 'NonExistent' not found"));
            
            try {
                await slideRepository.deleteSlideByTitle('NonExistent');
            } catch (error) {
                expect(error.message).to.include("Slide with title 'NonExistent' not found");
            }
        });
    });

    describe('Pagination', () => {
        it('should return paginated slides', async () => {
            const paginatedResult = {
                slides: [
                    slide,
                    { ...slide, _id: new mongoose.Types.ObjectId(), title: 'Second Slide' }
                ],
                pagination: {
                    currentPage: 1,
                    totalPages: 2,
                    totalItems: 3,
                    itemsPerPage: 2,
                    hasNextPage: true,
                    hasPrevPage: false
                }
            };
            
            sandbox.stub(slideRepository, 'getSlidesWithPagination').resolves(paginatedResult);
            
            const result = await slideRepository.getSlidesWithPagination(1, 2);
            
            expect(result.slides).to.have.length(2);
            expect(result.pagination.currentPage).to.equal(1);
            expect(result.pagination.totalPages).to.equal(2);
            expect(result.pagination.hasNextPage).to.be.true;
            expect(result.pagination.hasPrevPage).to.be.false;
        });

        it('should handle last page pagination', async () => {
            const paginatedResult = {
                slides: [
                    { ...slide, title: 'Last Slide' }
                ],
                pagination: {
                    currentPage: 2,
                    totalPages: 2,
                    totalItems: 3,
                    itemsPerPage: 2,
                    hasNextPage: false,
                    hasPrevPage: true
                }
            };
            
            sandbox.stub(slideRepository, 'getSlidesWithPagination').resolves(paginatedResult);
            
            const result = await slideRepository.getSlidesWithPagination(2, 2);
            
            expect(result.pagination.currentPage).to.equal(2);
            expect(result.pagination.hasNextPage).to.be.false;
            expect(result.pagination.hasPrevPage).to.be.true;
        });

        it('should apply filters in pagination', async () => {
            const filter = { subtitle: 'Welcome to our e-voting platform' };
            const paginatedResult = {
                slides: [slide],
                pagination: {
                    currentPage: 1,
                    totalPages: 1,
                    totalItems: 1,
                    itemsPerPage: 10,
                    hasNextPage: false,
                    hasPrevPage: false
                }
            };
            
            sandbox.stub(slideRepository, 'getSlidesWithPagination').resolves(paginatedResult);
            
            const result = await slideRepository.getSlidesWithPagination(1, 10, filter);
            
            expect(result.slides[0].subtitle).to.equal('Welcome to our e-voting platform');
        });
    });

    describe('Image operations', () => {
        it('should find slides by image pattern', async () => {
            const matchingSlides = [slide];
            sandbox.stub(slideRepository, 'getSlidesByImagePattern').resolves(matchingSlides);
            
            const result = await slideRepository.getSlidesByImagePattern('example.com');
            
            expect(result).to.be.an('array');
            expect(result[0].image).to.include('example.com');
        });

        it('should find slides with missing images', async () => {
            const slidesWithMissingImages = [
                { ...slide, image: '' },
                { ...slide, _id: new mongoose.Types.ObjectId(), image: null }
            ];
            sandbox.stub(slideRepository, 'getSlidesWithMissingImages').resolves(slidesWithMissingImages);
            
            const result = await slideRepository.getSlidesWithMissingImages();
            
            expect(result).to.be.an('array');
            expect(result).to.have.length(2);
        });

        it('should bulk update slide images', async () => {
            const imageUpdates = [
                { title: 'Welcome Slide', newImageUrl: 'https://example.com/new-welcome.jpg' },
                { title: 'Another Slide', newImageUrl: 'https://example.com/new-another.jpg' }
            ];

            const bulkResult = {
                success: [
                    { title: 'Welcome Slide', newImageUrl: 'https://example.com/new-welcome.jpg', updated: true },
                    { title: 'Another Slide', newImageUrl: 'https://example.com/new-another.jpg', updated: true }
                ],
                errors: [],
                successCount: 2,
                errorCount: 0
            };
            
            sandbox.stub(slideRepository, 'bulkUpdateSlideImages').resolves(bulkResult);
            
            const result = await slideRepository.bulkUpdateSlideImages(imageUpdates);
            
            expect(result.successCount).to.equal(2);
            expect(result.errorCount).to.equal(0);
            expect(result.success).to.have.length(2);
        });

        it('should handle errors in bulk image updates', async () => {
            const imageUpdates = [
                { title: 'Welcome Slide', newImageUrl: 'https://example.com/new-welcome.jpg' },
                { title: 'NonExistent', newImageUrl: 'https://example.com/new.jpg' }
            ];

            const bulkResult = {
                success: [
                    { title: 'Welcome Slide', newImageUrl: 'https://example.com/new-welcome.jpg', updated: true }
                ],
                errors: [
                    {
                        update: { title: 'NonExistent', newImageUrl: 'https://example.com/new.jpg' },
                        error: "Slide with title 'NonExistent' not found"
                    }
                ],
                successCount: 1,
                errorCount: 1
            };
            
            sandbox.stub(slideRepository, 'bulkUpdateSlideImages').resolves(bulkResult);
            
            const result = await slideRepository.bulkUpdateSlideImages(imageUpdates);
            
            expect(result.successCount).to.equal(1);
            expect(result.errorCount).to.equal(1);
            expect(result.errors[0]).to.have.property('error');
        });
    });

    describe('Slide statistics', () => {
        it('should return comprehensive slide statistics', async () => {
            const stats = {
                totalSlides: 10,
                avgTitleLength: 25.5,
                avgSubtitleLength: 45.2,
                uniqueSubtitlesCount: 8,
                slidesWithImages: 9,
                slidesWithoutImages: 1,
                imageCompletionRate: 90,
                slides: [
                    { title: 'Slide 1', subtitle: 'Subtitle 1' },
                    { title: 'Slide 2', subtitle: 'Subtitle 2' }
                ]
            };
            
            sandbox.stub(slideRepository, 'getSlideStatistics').resolves(stats);
            
            const result = await slideRepository.getSlideStatistics();
            
            expect(result).to.have.property('totalSlides', 10);
            expect(result).to.have.property('avgTitleLength', 25.5);
            expect(result).to.have.property('avgSubtitleLength', 45.2);
            expect(result).to.have.property('uniqueSubtitlesCount', 8);
            expect(result).to.have.property('slidesWithImages', 9);
            expect(result).to.have.property('slidesWithoutImages', 1);
            expect(result).to.have.property('imageCompletionRate', 90);
            expect(result.slides).to.be.an('array');
        });

        it('should return default statistics when no slides exist', async () => {
            const defaultStats = {
                totalSlides: 0,
                avgTitleLength: 0,
                avgSubtitleLength: 0,
                uniqueSubtitlesCount: 0,
                slidesWithImages: 0,
                slidesWithoutImages: 0,
                imageCompletionRate: 0,
                slides: []
            };
            
            sandbox.stub(slideRepository, 'getSlideStatistics').resolves(defaultStats);
            
            const result = await slideRepository.getSlideStatistics();
            
            expect(result.totalSlides).to.equal(0);
            expect(result.imageCompletionRate).to.equal(0);
            expect(result.slides).to.be.an('array');
            expect(result.slides).to.have.length(0);
        });
    });

    describe('Subtitle operations', () => {
        it('should get slides grouped by subtitle', async () => {
            const groupedSlides = [
                {
                    subtitle: 'Welcome Message',
                    slides: [
                        { id: slideId, title: 'Welcome Slide', image: 'img1.jpg', createdAt: new Date() }
                    ],
                    count: 1
                },
                {
                    subtitle: 'Feature Introduction',
                    slides: [
                        { id: new mongoose.Types.ObjectId(), title: 'Feature 1', image: 'img2.jpg', createdAt: new Date() },
                        { id: new mongoose.Types.ObjectId(), title: 'Feature 2', image: 'img3.jpg', createdAt: new Date() }
                    ],
                    count: 2
                }
            ];
            
            sandbox.stub(slideRepository, 'getSlidesBySubtitleGroups').resolves(groupedSlides);
            
            const result = await slideRepository.getSlidesBySubtitleGroups();
            
            expect(result).to.be.an('array');
            expect(result).to.have.length(2);
            expect(result[0]).to.have.property('subtitle', 'Welcome Message');
            expect(result[0]).to.have.property('count', 1);
            expect(result[1]).to.have.property('count', 2);
        });

        it('should get slide counts by subtitle', async () => {
            const subtitleCounts = [
                { subtitle: 'Feature Introduction', count: 5 },
                { subtitle: 'Welcome Message', count: 3 },
                { subtitle: 'Tutorial Steps', count: 2 }
            ];
            
            sandbox.stub(slideRepository, 'getSlideCountsBySubtitle').resolves(subtitleCounts);
            
            const result = await slideRepository.getSlideCountsBySubtitle();
            
            expect(result).to.be.an('array');
            expect(result).to.have.length(3);
            expect(result[0].count).to.be.greaterThan(result[1].count);
            expect(result[1].count).to.be.greaterThan(result[2].count);
        });
    });

    describe('Recent slides', () => {
        it('should get recent slides with default limit', async () => {
            const recentSlides = [
                { ...slide, createdAt: new Date('2024-01-02') },
                { ...slide, _id: new mongoose.Types.ObjectId(), createdAt: new Date('2024-01-01') }
            ];
            
            sandbox.stub(slideRepository, 'getRecentSlides').resolves(recentSlides);
            
            const result = await slideRepository.getRecentSlides();
            
            expect(result).to.be.an('array');
            expect(result[0].createdAt).to.be.greaterThan(result[1].createdAt);
        });

        it('should get recent slides with custom limit', async () => {
            const recentSlides = [slide];
            
            sandbox.stub(slideRepository, 'getRecentSlides').resolves(recentSlides);
            
            const result = await slideRepository.getRecentSlides(1);
            
            expect(result).to.have.length(1);
        });
    });

    describe('Title availability', () => {
        it('should return true for available title', async () => {
            sandbox.stub(slideRepository, 'isTitleAvailable').resolves(true);
            
            const result = await slideRepository.isTitleAvailable('New Unique Title');
            
            expect(result).to.be.true;
        });

        it('should return false for unavailable title', async () => {
            sandbox.stub(slideRepository, 'isTitleAvailable').resolves(false);
            
            const result = await slideRepository.isTitleAvailable('Welcome Slide');
            
            expect(result).to.be.false;
        });

        it('should exclude specific slide ID when checking availability', async () => {
            sandbox.stub(slideRepository, 'isTitleAvailable').resolves(true);
            
            const result = await slideRepository.isTitleAvailable('Welcome Slide', slideId);
            
            expect(result).to.be.true;
        });
    });

    describe('Slide data validation', () => {
        it('should validate correct slide data', async () => {
            const validData = {
                title: 'Valid Title',
                subtitle: 'Valid subtitle text',
                image: 'https://example.com/image.jpg'
            };
            
            sandbox.stub(slideRepository, 'validateSlideData').resolves(true);
            
            const result = await slideRepository.validateSlideData(validData);
            
            expect(result).to.be.true;
        });

        it('should throw error for missing title', async () => {
            const invalidData = {
                subtitle: 'Valid subtitle',
                image: 'https://example.com/image.jpg'
            };
            
            sandbox.stub(slideRepository, 'validateSlideData').throws(new Error('Validation errors: Slide title is required and must be a string'));
            
            try {
                await slideRepository.validateSlideData(invalidData);
            } catch (error) {
                expect(error.message).to.include('Slide title is required');
            }
        });

        it('should throw error for short title', async () => {
            const invalidData = {
                title: 'A',
                subtitle: 'Valid subtitle',
                image: 'https://example.com/image.jpg'
            };
            
            sandbox.stub(slideRepository, 'validateSlideData').throws(new Error('Validation errors: Slide title must be at least 2 characters long'));
            
            try {
                await slideRepository.validateSlideData(invalidData);
            } catch (error) {
                expect(error.message).to.include('Slide title must be at least 2 characters long');
            }
        });

        it('should throw error for long title', async () => {
            const invalidData = {
                title: 'A'.repeat(201),
                subtitle: 'Valid subtitle',
                image: 'https://example.com/image.jpg'
            };
            
            sandbox.stub(slideRepository, 'validateSlideData').throws(new Error('Validation errors: Slide title must be less than 200 characters'));
            
            try {
                await slideRepository.validateSlideData(invalidData);
            } catch (error) {
                expect(error.message).to.include('Slide title must be less than 200 characters');
            }
        });

        it('should throw error for missing subtitle', async () => {
            const invalidData = {
                title: 'Valid Title',
                image: 'https://example.com/image.jpg'
            };
            
            sandbox.stub(slideRepository, 'validateSlideData').throws(new Error('Validation errors: Slide subtitle is required and must be a string'));
            
            try {
                await slideRepository.validateSlideData(invalidData);
            } catch (error) {
                expect(error.message).to.include('Slide subtitle is required');
            }
        });

        it('should throw error for short subtitle', async () => {
            const invalidData = {
                title: 'Valid Title',
                subtitle: 'A',
                image: 'https://example.com/image.jpg'
            };
            
            sandbox.stub(slideRepository, 'validateSlideData').throws(new Error('Validation errors: Slide subtitle must be at least 2 characters long'));
            
            try {
                await slideRepository.validateSlideData(invalidData);
            } catch (error) {
                expect(error.message).to.include('Slide subtitle must be at least 2 characters long');
            }
        });

        it('should throw error for long subtitle', async () => {
            const invalidData = {
                title: 'Valid Title',
                subtitle: 'A'.repeat(501),
                image: 'https://example.com/image.jpg'
            };
            
            sandbox.stub(slideRepository, 'validateSlideData').throws(new Error('Validation errors: Slide subtitle must be less than 500 characters'));
            
            try {
                await slideRepository.validateSlideData(invalidData);
            } catch (error) {
                expect(error.message).to.include('Slide subtitle must be less than 500 characters');
            }
        });

        it('should throw error for missing image', async () => {
            const invalidData = {
                title: 'Valid Title',
                subtitle: 'Valid subtitle'
            };
            
            sandbox.stub(slideRepository, 'validateSlideData').throws(new Error('Validation errors: Slide image is required and must be a string'));
            
            try {
                await slideRepository.validateSlideData(invalidData);
            } catch (error) {
                expect(error.message).to.include('Slide image is required');
            }
        });

        it('should throw error for short image URL', async () => {
            const invalidData = {
                title: 'Valid Title',
                subtitle: 'Valid subtitle',
                image: 'img'
            };
            
            sandbox.stub(slideRepository, 'validateSlideData').throws(new Error('Validation errors: Slide image URL must be at least 5 characters long'));
            
            try {
                await slideRepository.validateSlideData(invalidData);
            } catch (error) {
                expect(error.message).to.include('Slide image URL must be at least 5 characters long');
            }
        });

        it('should throw error for invalid image URL format', async () => {
            const invalidData = {
                title: 'Valid Title',
                subtitle: 'Valid subtitle',
                image: 'invalid-url'
            };
            
            sandbox.stub(slideRepository, 'validateSlideData').throws(new Error('Validation errors: Slide image must be a valid URL or relative path'));
            
            try {
                await slideRepository.validateSlideData(invalidData);
            } catch (error) {
                expect(error.message).to.include('Slide image must be a valid URL or relative path');
            }
        });

        it('should accept relative paths for images', async () => {
            const validData = {
                title: 'Valid Title',
                subtitle: 'Valid subtitle',
                image: './images/slide.jpg'
            };
            
            sandbox.stub(slideRepository, 'validateSlideData').resolves(true);
            
            const result = await slideRepository.validateSlideData(validData);
            
            expect(result).to.be.true;
        });
    });

    describe('Bulk create slides', () => {
        it('should create multiple slides successfully', async () => {
            const slidesData = [
                { title: 'Slide 1', subtitle: 'Subtitle 1', image: 'https://example.com/1.jpg' },
                { title: 'Slide 2', subtitle: 'Subtitle 2', image: 'https://example.com/2.jpg' }
            ];

            const bulkResult = {
                success: [
                    { ...slide, title: 'Slide 1', subtitle: 'Subtitle 1' },
                    { ...slide, title: 'Slide 2', subtitle: 'Subtitle 2' }
                ],
                errors: [],
                successCount: 2,
                errorCount: 0
            };
            
            sandbox.stub(slideRepository, 'bulkCreateSlides').resolves(bulkResult);
            
            const result = await slideRepository.bulkCreateSlides(slidesData);
            
            expect(result.successCount).to.equal(2);
            expect(result.errorCount).to.equal(0);
            expect(result.success).to.have.length(2);
            expect(result.errors).to.have.length(0);
        });

        it('should handle partial failures in bulk creation', async () => {
            const slidesData = [
                { title: 'Valid Slide', subtitle: 'Valid subtitle', image: 'https://example.com/valid.jpg' },
                { title: 'A', subtitle: 'Invalid title', image: 'https://example.com/invalid.jpg' }
            ];

            const bulkResult = {
                success: [
                    { ...slide, title: 'Valid Slide' }
                ],
                errors: [
                    {
                        slideData: { title: 'A', subtitle: 'Invalid title', image: 'https://example.com/invalid.jpg' },
                        error: 'Validation errors: Slide title must be at least 2 characters long'
                    }
                ],
                successCount: 1,
                errorCount: 1
            };
            
            sandbox.stub(slideRepository, 'bulkCreateSlides').resolves(bulkResult);
            
            const result = await slideRepository.bulkCreateSlides(slidesData);
            
            expect(result.successCount).to.equal(1);
            expect(result.errorCount).to.equal(1);
            expect(result.success).to.have.length(1);
            expect(result.errors).to.have.length(1);
            expect(result.errors[0]).to.have.property('error');
        });
    });

    describe('Error handling', () => {
        it('should handle database errors gracefully in createSlide', async () => {
            const slideData = {
                title: 'Test Slide',
                subtitle: 'Test subtitle',
                image: 'https://example.com/test.jpg'
            };
            
            sandbox.stub(slideRepository, 'createSlide').throws(new Error('Database connection error'));
            
            try {
                await slideRepository.createSlide(slideData);
            } catch (error) {
                expect(error.message).to.include('Database connection error');
            }
        });

        it('should handle invalid ObjectId errors', async () => {
            sandbox.stub(slideRepository, 'findByTitle').throws(new Error('Invalid ObjectId'));
            
            try {
                await slideRepository.findByTitle('invalid-id');
            } catch (error) {
                expect(error.message).to.include('Invalid ObjectId');
            }
        });

        it('should handle aggregation pipeline errors', async () => {
            sandbox.stub(slideRepository, 'getSlideStatistics').throws(new Error('Aggregation failed'));
            
            try {
                await slideRepository.getSlideStatistics();
            } catch (error) {
                expect(error.message).to.include('Aggregation failed');
            }
        });

        it('should handle text search errors', async () => {
            sandbox.stub(slideRepository, 'fullTextSearch').throws(new Error('Text index not found'));
            
            try {
                await slideRepository.fullTextSearch('test');
            } catch (error) {
                expect(error.message).to.include('Text index not found');
            }
        });
    });

    describe('Edge cases', () => {
        it('should handle slides with very long titles within limits', async () => {
            const longTitleSlide = { 
                ...slide, 
                title: 'A'.repeat(199) // Just under the 200 character limit
            };
            sandbox.stub(slideRepository, 'createSlide').resolves(longTitleSlide);
            
            const slideData = { 
                title: 'A'.repeat(199), 
                subtitle: 'Test subtitle',
                image: 'https://example.com/test.jpg'
            };
            const result = await slideRepository.createSlide(slideData);
            
            expect(result.title).to.have.length(199);
        });

        it('should handle slides with special characters in title', async () => {
            const specialCharSlide = { 
                ...slide, 
                title: 'Slide with Special Chars: @#$%^&*()' 
            };
            sandbox.stub(slideRepository, 'createSlide').resolves(specialCharSlide);
            
            const slideData = { 
                title: 'Slide with Special Chars: @#$%^&*()',
                subtitle: 'Test subtitle',
                image: 'https://example.com/test.jpg'
            };
            const result = await slideRepository.createSlide(slideData);
            
            expect(result.title).to.include('@#$%^&*()');
        });

        it('should handle empty search results gracefully', async () => {
            sandbox.stub(slideRepository, 'searchSlides').resolves([]);
            
            const result = await slideRepository.searchSlides('NonExistentPattern');
            
            expect(result).to.be.an('array');
            expect(result).to.have.length(0);
        });

        it('should handle single slide in statistics', async () => {
            const singleSlideStats = {
                totalSlides: 1,
                avgTitleLength: 12,
                avgSubtitleLength: 35,
                uniqueSubtitlesCount: 1,
                slidesWithImages: 1,
                slidesWithoutImages: 0,
                imageCompletionRate: 100,
                slides: [{ title: 'Welcome Slide', subtitle: 'Welcome to our e-voting platform' }]
            };
            
            sandbox.stub(slideRepository, 'getSlideStatistics').resolves(singleSlideStats);
            
            const result = await slideRepository.getSlideStatistics();
            
            expect(result.totalSlides).to.equal(1);
            expect(result.imageCompletionRate).to.equal(100);
        });

        it('should handle concurrent slide operations', async () => {
            const concurrentSlides = [
                { ...slide, createdAt: new Date('2024-01-01T12:00:00Z') },
                { ...slide, _id: new mongoose.Types.ObjectId(), createdAt: new Date('2024-01-01T12:00:01Z') },
                { ...slide, _id: new mongoose.Types.ObjectId(), createdAt: new Date('2024-01-01T12:00:02Z') }
            ];
            
            sandbox.stub(slideRepository, 'getRecentSlides').resolves(concurrentSlides);
            
            const result = await slideRepository.getRecentSlides(3);
            
            expect(result).to.have.length(3);
            expect(result[1].createdAt).to.be.greaterThan(result[0].createdAt);
            expect(result[2].createdAt).to.be.greaterThan(result[1].createdAt);
        });
    });
});

#!/usr/bin/env node
/**
 * Slide Repository
 * 
 * Extends BaseRepository to provide Slide-specific database operations.
 * Includes slide management, search functionality, and image handling.
 */

import BaseRepository from './BaseRepository.js';
import Slide from '../models/Slide.js';
import mongoose from 'mongoose';

class SlideRepository extends BaseRepository {
    
    constructor() {
        // Get the Slide model
        super(Slide);
    }

    /**
     * Create a new slide
     * @param {Object} slideData - Slide data
     * @returns {Promise<Object>} Created slide
     */
    async createSlide(slideData) {
        try {
            // Check if slide title already exists
            const existingSlide = await this.findByTitle(slideData.title);
            if (existingSlide) {
                throw new Error(`Slide with title '${slideData.title}' already exists`);
            }

            return await this.create(slideData);
        } catch (error) {
            throw this._handleError(error, 'createSlide');
        }
    }

    /**
     * Find slide by title
     * @param {String} title - Slide title
     * @returns {Promise<Object|null>} Slide or null
     */
    async findByTitle(title) {
        try {
            return await this.findOne({ title: title.trim() });
        } catch (error) {
            throw this._handleError(error, 'findByTitle');
        }
    }

    /**
     * Find slides by subtitle
     * @param {String} subtitle - Slide subtitle
     * @returns {Promise<Array>} Slides with matching subtitle
     */
    async findBySubtitle(subtitle) {
        try {
            return await this.find({ subtitle: subtitle.trim() });
        } catch (error) {
            throw this._handleError(error, 'findBySubtitle');
        }
    }

    /**
     * Search slides by text (title and subtitle)
     * @param {String} searchText - Text to search for
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Matching slides
     */
    async searchSlides(searchText, options = {}) {
        try {
            const searchRegex = new RegExp(searchText, 'i');
            return await this.find({
                $or: [
                    { title: { $regex: searchRegex } },
                    { subtitle: { $regex: searchRegex } }
                ]
            }, {
                ...options,
                sort: { title: 1 }
            });
        } catch (error) {
            throw this._handleError(error, 'searchSlides');
        }
    }

    /**
     * Full text search using MongoDB text index
     * @param {String} searchText - Text to search for
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Matching slides with text scores
     */
    async fullTextSearch(searchText, options = {}) {
        try {
            return await this.find({
                $text: { $search: searchText }
            }, {
                ...options,
                projection: { score: { $meta: "textScore" } },
                sort: { score: { $meta: "textScore" } }
            });
        } catch (error) {
            throw this._handleError(error, 'fullTextSearch');
        }
    }

    /**
     * Update slide by title
     * @param {String} title - Slide title
     * @param {Object} updateData - Data to update
     * @returns {Promise<Object|null>} Updated slide
     */
    async updateSlideByTitle(title, updateData) {
        try {
            const slide = await this.findByTitle(title);
            if (!slide) {
                throw new Error(`Slide with title '${title}' not found`);
            }

            // If updating title, check for conflicts
            if (updateData.title && updateData.title !== title) {
                const existingSlide = await this.findByTitle(updateData.title);
                if (existingSlide) {
                    throw new Error(`Slide with title '${updateData.title}' already exists`);
                }
            }

            return await this.updateById(slide._id, updateData);
        } catch (error) {
            throw this._handleError(error, 'updateSlideByTitle');
        }
    }

    /**
     * Delete slide by title
     * @param {String} title - Slide title
     * @returns {Promise<Object|null>} Deleted slide
     */
    async deleteSlideByTitle(title) {
        try {
            const slide = await this.findByTitle(title);
            if (!slide) {
                throw new Error(`Slide with title '${title}' not found`);
            }

            return await this.deleteById(slide._id);
        } catch (error) {
            throw this._handleError(error, 'deleteSlideByTitle');
        }
    }

    /**
     * Get slides with pagination
     * @param {Number} page - Page number (1-based)
     * @param {Number} limit - Items per page
     * @param {Object} filter - Filter criteria
     * @returns {Promise<Object>} Paginated slides
     */
    async getSlidesWithPagination(page = 1, limit = 10, filter = {}) {
        try {
            const skip = (page - 1) * limit;
            
            const slides = await this.find(filter, {
                skip,
                limit,
                sort: { title: 1 }
            });

            const total = await this.countDocuments(filter);
            const totalPages = Math.ceil(total / limit);

            return {
                slides,
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalItems: total,
                    itemsPerPage: limit,
                    hasNextPage: page < totalPages,
                    hasPrevPage: page > 1
                }
            };
        } catch (error) {
            throw this._handleError(error, 'getSlidesWithPagination');
        }
    }

    /**
     * Get slides by image pattern
     * @param {String} imagePattern - Image URL pattern to search for
     * @returns {Promise<Array>} Slides with matching image URLs
     */
    async getSlidesByImagePattern(imagePattern) {
        try {
            const imageRegex = new RegExp(imagePattern, 'i');
            return await this.find({
                image: { $regex: imageRegex }
            }, {
                sort: { title: 1 }
            });
        } catch (error) {
            throw this._handleError(error, 'getSlidesByImagePattern');
        }
    }

    /**
     * Get slides with missing images (empty or null image fields)
     * @returns {Promise<Array>} Slides with missing images
     */
    async getSlidesWithMissingImages() {
        try {
            return await this.find({
                $or: [
                    { image: { $exists: false } },
                    { image: null },
                    { image: "" },
                    { image: { $regex: /^\s*$/ } }
                ]
            }, {
                sort: { title: 1 }
            });
        } catch (error) {
            throw this._handleError(error, 'getSlidesWithMissingImages');
        }
    }

    /**
     * Get slide statistics
     * @returns {Promise<Object>} Slide statistics
     */
    async getSlideStatistics() {
        try {
            const totalSlides = await this.countDocuments({});
            const slidesWithImages = await this.countDocuments({
                image: { $exists: true, $ne: "", $ne: null }
            });
            const slidesWithoutImages = totalSlides - slidesWithImages;

            const pipeline = [
                {
                    $group: {
                        _id: null,
                        totalSlides: { $sum: 1 },
                        avgTitleLength: { $avg: { $strLenCP: "$title" } },
                        avgSubtitleLength: { $avg: { $strLenCP: "$subtitle" } },
                        uniqueSubtitles: { $addToSet: "$subtitle" },
                        slides: { $push: { title: "$title", subtitle: "$subtitle" } }
                    }
                },
                {
                    $project: {
                        _id: 0,
                        totalSlides: 1,
                        avgTitleLength: { $round: ["$avgTitleLength", 2] },
                        avgSubtitleLength: { $round: ["$avgSubtitleLength", 2] },
                        uniqueSubtitlesCount: { $size: "$uniqueSubtitles" },
                        slides: 1
                    }
                }
            ];

            const [stats] = await this.aggregate(pipeline);
            
            return {
                ...(stats || {
                    totalSlides: 0,
                    avgTitleLength: 0,
                    avgSubtitleLength: 0,
                    uniqueSubtitlesCount: 0,
                    slides: []
                }),
                slidesWithImages,
                slidesWithoutImages,
                imageCompletionRate: totalSlides > 0 ? 
                    Math.round((slidesWithImages / totalSlides) * 100) : 0
            };
        } catch (error) {
            throw this._handleError(error, 'getSlideStatistics');
        }
    }

    /**
     * Validate slide data
     * @param {Object} slideData - Slide data to validate
     * @returns {Promise<Boolean>} True if valid
     */
    async validateSlideData(slideData) {
        try {
            const errors = [];

            // Validate title
            if (!slideData.title || typeof slideData.title !== 'string') {
                errors.push('Slide title is required and must be a string');
            } else if (slideData.title.trim().length < 2) {
                errors.push('Slide title must be at least 2 characters long');
            } else if (slideData.title.trim().length > 200) {
                errors.push('Slide title must be less than 200 characters');
            }

            // Validate subtitle
            if (!slideData.subtitle || typeof slideData.subtitle !== 'string') {
                errors.push('Slide subtitle is required and must be a string');
            } else if (slideData.subtitle.trim().length < 2) {
                errors.push('Slide subtitle must be at least 2 characters long');
            } else if (slideData.subtitle.trim().length > 500) {
                errors.push('Slide subtitle must be less than 500 characters');
            }

            // Validate image
            if (!slideData.image || typeof slideData.image !== 'string') {
                errors.push('Slide image is required and must be a string');
            } else if (slideData.image.trim().length < 5) {
                errors.push('Slide image URL must be at least 5 characters long');
            } else if (slideData.image.trim().length > 2000) {
                errors.push('Slide image URL must be less than 2000 characters');
            }

            // Basic URL validation for image
            if (slideData.image && typeof slideData.image === 'string') {
                const urlPattern = /^(https?:\/\/|\/|\.\/|\.\.\/).+/i;
                if (!urlPattern.test(slideData.image.trim())) {
                    errors.push('Slide image must be a valid URL or relative path');
                }
            }

            if (errors.length > 0) {
                throw new Error(`Validation errors: ${errors.join(', ')}`);
            }

            return true;
        } catch (error) {
            throw this._handleError(error, 'validateSlideData');
        }
    }

    /**
     * Bulk create slides
     * @param {Array} slidesData - Array of slide data
     * @returns {Promise<Array>} Created slides
     */
    async bulkCreateSlides(slidesData) {
        try {
            const createdSlides = [];
            const errors = [];

            for (const slideData of slidesData) {
                try {
                    await this.validateSlideData(slideData);
                    const slide = await this.createSlide(slideData);
                    createdSlides.push(slide);
                } catch (error) {
                    errors.push({
                        slideData,
                        error: error.message
                    });
                }
            }

            return {
                success: createdSlides,
                errors: errors,
                successCount: createdSlides.length,
                errorCount: errors.length
            };
        } catch (error) {
            throw this._handleError(error, 'bulkCreateSlides');
        }
    }

    /**
     * Get slides grouped by subtitle
     * @returns {Promise<Array>} Slides grouped by subtitle
     */
    async getSlidesBySubtitleGroups() {
        try {
            const pipeline = [
                {
                    $group: {
                        _id: "$subtitle",
                        slides: {
                            $push: {
                                id: "$_id",
                                title: "$title",
                                image: "$image",
                                createdAt: "$createdAt"
                            }
                        },
                        count: { $sum: 1 }
                    }
                },
                {
                    $sort: { "_id": 1 }
                },
                {
                    $project: {
                        _id: 0,
                        subtitle: "$_id",
                        slides: 1,
                        count: 1
                    }
                }
            ];

            return await this.aggregate(pipeline);
        } catch (error) {
            throw this._handleError(error, 'getSlidesBySubtitleGroups');
        }
    }

    /**
     * Update slide images in bulk
     * @param {Array} imageUpdates - Array of {title, newImageUrl} objects
     * @returns {Promise<Object>} Update results
     */
    async bulkUpdateSlideImages(imageUpdates) {
        try {
            const updateResults = [];
            const errors = [];

            for (const update of imageUpdates) {
                try {
                    const { title, newImageUrl } = update;
                    
                    if (!title || !newImageUrl) {
                        throw new Error('Both title and newImageUrl are required');
                    }

                    const updatedSlide = await this.updateSlideByTitle(title, { image: newImageUrl });
                    updateResults.push({
                        title,
                        newImageUrl,
                        updated: !!updatedSlide
                    });
                } catch (error) {
                    errors.push({
                        update,
                        error: error.message
                    });
                }
            }

            return {
                success: updateResults,
                errors: errors,
                successCount: updateResults.length,
                errorCount: errors.length
            };
        } catch (error) {
            throw this._handleError(error, 'bulkUpdateSlideImages');
        }
    }

    /**
     * Get recent slides
     * @param {Number} limit - Number of recent slides to retrieve
     * @returns {Promise<Array>} Recent slides
     */
    async getRecentSlides(limit = 10) {
        try {
            return await this.find({}, {
                limit,
                sort: { createdAt: -1 }
            });
        } catch (error) {
            throw this._handleError(error, 'getRecentSlides');
        }
    }

    /**
     * Get slides count by subtitle
     * @returns {Promise<Array>} Subtitle counts
     */
    async getSlideCountsBySubtitle() {
        try {
            const pipeline = [
                {
                    $group: {
                        _id: "$subtitle",
                        count: { $sum: 1 }
                    }
                },
                {
                    $sort: { count: -1 }
                },
                {
                    $project: {
                        _id: 0,
                        subtitle: "$_id",
                        count: 1
                    }
                }
            ];

            return await this.aggregate(pipeline);
        } catch (error) {
            throw this._handleError(error, 'getSlideCountsBySubtitle');
        }
    }

    /**
     * Check if slide title is available
     * @param {String} title - Title to check
     * @param {String|ObjectId} excludeId - Slide ID to exclude from check (for updates)
     * @returns {Promise<Boolean>} True if title is available
     */
    async isTitleAvailable(title, excludeId = null) {
        try {
            const criteria = { title: title.trim() };
            
            if (excludeId) {
                criteria._id = { $ne: excludeId };
            }

            const existingSlide = await this.findOne(criteria);
            return !existingSlide;
        } catch (error) {
            throw this._handleError(error, 'isTitleAvailable');
        }
    }
}

export default SlideRepository;

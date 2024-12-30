import Category from "../models/category.js";
import Event from "../models/event.js";
import { ObjectId } from "mongodb";

class CategoryController {
    /**
     * Creates a new category.
     */
    static async createCategory(req, res) {
        try {
            const data = req.body;

            if (!data) {
                return res.status(400).send({
                    error: "Missing data",
                    success: false
                });
            }

            const { name, description, thumbnailUri, eventId } = data;

            if (!name || !description || !thumbnailUri || !eventId) {
                return res.status(400).send({
                    success: false,
                    error: "Missing required fields: `name`, `description`, `thumbnailUri`, or `eventId`."
                });
            }

            const event = await Event.get({ id: new ObjectId(eventId) });

            if (!event) {
                return res.status(404).send({
                    success: false,
                    error: `Event with ID ${eventId} does not exist.`
                });
            }

            const existingCategory = await Category.get({ name, eventId });

            if (existingCategory) {
                return res.status(400).send({
                    error: `Category with name '${name}' already exists for the specified event.`,
                    success: false
                });
            }

            const category = await Category.create(name, description, thumbnailUri, eventId);
            const result = await category.save();

            if (!result) {
                return res.status(500).send({
                    success: false,
                    error: "Failed to create category."
                });
            }

            return res.status(201).send({
                success: true,
                category: category.to_object()
            });
        } catch (error) {
            console.error("Error creating category:", error);
            return res.status(500).send({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Updates an existing category.
     */
    static async updateCategory(req, res) {
        try {
            const { categoryId } = req.params;
            const body = req.body;

            if (!categoryId) {
                return res.status(400).send({
                    success: false,
                    error: "Missing required parameter: `categoryId`."
                });
            }

            if (!body) {
                return res.status(400).send({
                    success: false,
                    error: "Missing request body."
                });
            }

            let category = await Category.get({ id: new ObjectId(categoryId) });
            if (!category) {
                return res.status(404).send({
                    success: false,
                    error: `Category with ID ${categoryId} not found.`
                });
            }

            if (body.eventId) {
                const event = await Event.get({ id: new ObjectId(body.eventId) });

                if (!event) {
                    return res.status(404).send({
                        success: false,
                        error: `Event with ID ${body.eventId} does not exist.`
                    });
                }
            }

            category = Category.from_object(category);
            const result = await category.updateInstance(body);

            if (!result) {
                return res.status(500).send({
                    success: false,
                    error: "Failed to update category."
                });
            }

            return res.status(200).send({
                success: true,
                category: category.to_object()
            });
        } catch (error) {
            console.error("Error updating category:", error);
            return res.status(500).send({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Deletes a category.
     */
    static async deleteCategory(req, res) {
        try {
            const { categoryId } = req.params;

            if (!categoryId) {
                return res.status(400).send({
                    success: false,
                    error: "Missing required parameter: `categoryId`."
                });
            }

            const result = await Category.delete({ id: new ObjectId(categoryId) });

            if (!result) {
                return res.status(404).send({
                    success: false,
                    error: `Category with ID ${categoryId} not found or could not be deleted.`
                });
            }

            return res.status(200).send({
                success: true,
                message: `Category with ID ${categoryId} successfully deleted.`
            });
        } catch (error) {
            console.error("Error deleting category:", error);
            return res.status(500).send({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Lists all categories or categories matching query parameters.
     */
    static async listCategories(req, res) {
        try {
            const query = req.query || {};
            const categories = await Category.all(query);

            if (!categories || categories.length === 0) {
                return res.status(404).send({
                    success: false,
                    error: "No categories found matching the given criteria."
                });
            }

            return res.status(200).send({
                success: true,
                categories: categories.map(category => Category.from_object(category).to_object())
            });
        } catch (error) {
            console.error("Error listing categories:", error);
            return res.status(500).send({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Retrieves the details of a specific category.
     */
    static async getCategoryDetails(req, res) {
        try {
            const { categoryId } = req.params;

            const category = await Category.get({ id: new ObjectId(categoryId) });

            if (!category) {
                return res.status(404).send({
                    success: false,
                    error: `Category with ID ${categoryId} not found.`
                });
            }

            return res.status(200).send({
                success: true,
                category: Category.from_object(category).to_object()
            });
        } catch (error) {
            console.error("Error retrieving category details:", error);
            return res.status(500).send({
                success: false,
                error: error.message
            });
        }
    }
}

export default CategoryController;

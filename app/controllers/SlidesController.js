import Slide from "../models/slide.js";


class SlideController {
    // Get all slides
    static getAllSlides = async (req, res) => {
        try {
            const slides = await Slide.all();
            res.status(200).send({
                success: true,
                slides: slides
            });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    };



    // Create a new slide
    static createSlide = async (req, res) => {
        const data = req.body

        if (!data){
           return res.status(400).send({
                success: false,
                error: 'Missing required fields `content`'
            })
        }

       const { content } = data

       delete data.content
        const slide = new Slide(content, data);
        try {
            const newSlide = await slide.save();
            res.status(201).send({
                success: true,
                slide
            });
        } catch (error) {
            res.status(400).send({ message: error.message });
        }
    };

    // Update an existing slide
    static updateSlide = async (req, res) => {
        try {
            const { slideId } = req.params;
            const body = req.body;

            let updatedSlide = await Slide.get({ id: new ObjectId(slideId) });

            if (!updatedSlide) {
                return res.status(404).json({ message: 'Slide not found' });
            }

            updatedSlide = Slide.from_object(updatedSlide);

            const result = await updatedSlide.updateInstance(body);

            if (!result) {
                return res.status(500).json({ message: 'Failed to update slide' });
            }

            res.status(200).send({
                success: true,
                slide: updatedSlide
            });
        } catch (error) {
            res.status(400).json({ message: error.message });
        }
    };

    // Delete a slide
    static deleteSlide = async (req, res) => {
        try {
            const slide = await Slide.get({ id: new ObjectId(req.params.id) });
            if (!slide) {
                return res.status(404).json({ message: 'Slide not found' });
            }

            await slide.delete();

            res.status(200).json({ message: 'Slide deleted successfully' });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    };

}

export default SlideController;
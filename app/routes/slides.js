import { Router } from "express";
import AuthController from "../controllers/AuthController.js";
import SlideController from "../controllers/SlidesController.js";
const slideRouter = Router();

slideRouter.get("/", SlideController.getAllSlides);
slideRouter.post("/", SlideController.createSlide);
// slideRouter.get("/:slideId", SlideController.getSlide);
slideRouter.put("/:slideId", AuthController.verifyToken, AuthController.verifyRole,
     SlideController.updateSlide);
slideRouter.delete("/:slideId", AuthController.verifyToken,
    AuthController.verifyRole,
    SlideController.deleteSlide);


export default slideRouter;

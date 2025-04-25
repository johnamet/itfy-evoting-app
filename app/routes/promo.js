import { Router } from "express";
import AuthController from "../controllers/AuthController.js";
import PromoCodeController from "../controllers/PromoController.js";

const promoRouter = Router();

promoRouter.post('/',
    AuthController.verifyToken,
    AuthController.verifyRole(["admin", "superuser"]),
    PromoCodeController.createPromoCode
);
promoRouter.get('/',
    AuthController.verifyToken,
    AuthController.verifyRole(["admin", "superuser"]),
    PromoCodeController.listPromoCodes
);
promoRouter.get('/:code',
    PromoCodeController.getPromoCode
);
promoRouter.put('/:code',
    AuthController.verifyToken,
    AuthController.verifyRole(["admin", "superuser"]),
    PromoCodeController.updatePromoCode
);


promoRouter.post('/deactivate/:code', 
    AuthController.verifyToken,
    AuthController.verifyRole(["admin", "superuser"]),
    PromoCodeController.deactivatePromoCode
);


export default promoRouter;
import { Router } from "express";
import CandidateController from "../controllers/CandidateController.js";
import AuthController from "../controllers/AuthController.js";


const candidateRouter = Router();


candidateRouter.post('/',AuthController.verifyToken,
    AuthController.verifyRole(["admin", "superuser"]), CandidateController.createCandidate);
candidateRouter.post('/bulk',AuthController.verifyToken,
    AuthController.verifyRole(["admin", "superuser"]), CandidateController.bulkUploadCandidates);
candidateRouter.get('/checkprogress/:uploadId',AuthController.verifyToken,
    AuthController.verifyRole(["admin", "superuser"]), CandidateController.checkUploadProgress);
candidateRouter.get('/ongoing-uploads', AuthController.verifyToken,
    AuthController.verifyRole(["admin", "superuser"]),CandidateController.listOngoingUploads);

candidateRouter.get('/', CandidateController.listCandidates);
candidateRouter.get('/:candidateId', CandidateController.getCandidate);

candidateRouter.put('/:candidateId', AuthController.verifyToken,
    AuthController.verifyRole(["admin", "superuser"]),CandidateController.updateCandidate);
candidateRouter.delete('/:candidateId', AuthController.verifyToken,
    AuthController.verifyRole(["admin", "superuser"]),CandidateController.deleteCandidate);

export default candidateRouter;


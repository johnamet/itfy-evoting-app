import AppController from "../controllers/AppController.js";
import sinon from "sinon";


describe("appController", () => {
    let res, req;

    beforeEach(() => {
        req = {
            body: {}
        };

        res = {
            status: sinon.stub().returnThis(),
            json: sinon.stub()
        }
    });

    describe("should check status of server connection", async () => {
        await AppController.getStatus(req, res);
        expect(res.status).to.be.equal(200);
    })
})
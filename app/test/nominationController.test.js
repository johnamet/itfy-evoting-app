import chai from "chai";
import chaiHttp from "chai-http";
import sinon from "sinon";
import { ObjectId } from "mongodb";
import app from "../app.js";
import NominationController from "../controllers/NominationController.js";
import Nomination from "../models/nomination.js";
import Event from "../models/event.js";
import Category from "../models/category.js";
import Candidate from "../models/candidate.js";

const { expect } = chai;
chai.use(chaiHttp);

describe("NominationController Tests", () => {
    let nominationStub, eventStub, categoryStub, candidateStub;

    beforeEach(() => {
        nominationStub = sinon.stub(Nomination, "get");
        sinon.stub(Nomination.prototype, "save").resolves(true);
        sinon.stub(Nomination.prototype, "updateInstance").resolves(true);
        sinon.stub(Nomination, "delete").resolves(true);
        sinon.stub(Nomination, "all").resolves([]);
        sinon.stub(Nomination, "count").resolves(0);
        eventStub = sinon.stub(Event, "get");
        categoryStub = sinon.stub(Category, "get");
        candidateStub = sinon.stub(Candidate, "get");
    });

    afterEach(() => {
        sinon.restore();
    });

    describe("createNomination", () => {
        it("should create a nomination successfully", async () => {
            eventStub.resolves({ id: new ObjectId() });
            categoryStub.resolves({ id: new ObjectId() });
            candidateStub.resolves({ id: new ObjectId() });
            nominationStub.resolves(null);

            const res = await chai.request(app)
                .post("/nomination")
                .send({ candidate_id: new ObjectId(), event_id: new ObjectId(), category_id: new ObjectId() });

            expect(res).to.have.status(201);
            expect(res.body).to.have.property("success", true);
        });

        it("should return 400 if missing required fields", async () => {
            const res = await chai.request(app)
                .post("/nomination")
                .send({ candidate_id: new ObjectId() });

            expect(res).to.have.status(400);
            expect(res.body).to.have.property("success", false);
        });

        it("should return 404 if event not found", async () => {
            eventStub.resolves(null);

            const res = await chai.request(app)
                .post("/nomination")
                .send({ candidate_id: new ObjectId(), event_id: new ObjectId(), category_id: new ObjectId() });

            expect(res).to.have.status(404);
            expect(res.body).to.have.property("success", false);
        });

        it("should return 404 if category not found", async () => {
            eventStub.resolves({ id: new ObjectId() });
            categoryStub.resolves(null);

            const res = await chai.request(app)
                .post("/nomination")
                .send({ candidate_id: new ObjectId(), event_id: new ObjectId(), category_id: new ObjectId() });

            expect(res).to.have.status(404);
            expect(res.body).to.have.property("success", false);
        });

        it("should return 404 if candidate not found", async () => {
            eventStub.resolves({ id: new ObjectId() });
            categoryStub.resolves({ id: new ObjectId() });
            candidateStub.resolves(null);

            const res = await chai.request(app)
                .post("/nomination")
                .send({ candidate_id: new ObjectId(), event_id: new ObjectId(), category_id: new ObjectId() });

            expect(res).to.have.status(404);
            expect(res.body).to.have.property("success", false);
        });

        it("should return 400 if duplicate nomination", async () => {
            eventStub.resolves({ id: new ObjectId() });
            categoryStub.resolves({ id: new ObjectId() });
            candidateStub.resolves({ id: new ObjectId() });
            nominationStub.resolves({ id: new ObjectId() });

            const res = await chai.request(app)
                .post("/nomination")
                .send({ candidate_id: new ObjectId(), event_id: new ObjectId(), category_id: new ObjectId() });

            expect(res).to.have.status(400);
            expect(res.body).to.have.property("success", false);
        });

        it("should return 500 on server error", async () => {
            eventStub.rejects(new Error("Server error"));

            const res = await chai.request(app)
                .post("/nomination")
                .send({ candidate_id: new ObjectId(), event_id: new ObjectId(), category_id: new ObjectId() });

            expect(res).to.have.status(500);
            expect(res.body).to.have.property("success", false);
        });
    });

    describe("listNominations", () => {
        it("should list all nominations successfully", async () => {
            nominationStub.resolves([{ id: new ObjectId(), candidate_id: new ObjectId() }]);

            const res = await chai.request(app)
                .get("/nomination");

            expect(res).to.have.status(200);
            expect(res.body).to.have.property("success", true);
        });

        it("should return 404 if no nominations found", async () => {
            nominationStub.resolves([]);

            const res = await chai.request(app)
                .get("/nomination");

            expect(res).to.have.status(404);
            expect(res.body).to.have.property("success", false);
        });

        it("should return 500 on server error", async () => {
            nominationStub.rejects(new Error("Server error"));

            const res = await chai.request(app)
                .get("/nomination");

            expect(res).to.have.status(500);
            expect(res.body).to.have.property("success", false);
        });
    });

    describe("updateNomination", () => {
        it("should update a nomination successfully", async () => {
            nominationStub.resolves({ id: new ObjectId() });

            const res = await chai.request(app)
                .put("/nomination/1")
                .send({ candidate_id: new ObjectId() });

            expect(res).to.have.status(200);
            expect(res.body).to.have.property("success", true);
        });

        it("should return 400 if nominationId is missing", async () => {
            const res = await chai.request(app)
                .put("/nomination/")
                .send({ candidate_id: new ObjectId() });

            expect(res).to.have.status(400);
            expect(res.body).to.have.property("success", false);
        });

        it("should return 404 if nomination not found", async () => {
            nominationStub.resolves(null);

            const res = await chai.request(app)
                .put("/nomination/1")
                .send({ candidate_id: new ObjectId() });

            expect(res).to.have.status(404);
            expect(res.body).to.have.property("success", false);
        });

        it("should return 404 if candidate not found", async () => {
            nominationStub.resolves({ id: new ObjectId() });
            candidateStub.resolves(null);

            const res = await chai.request(app)
                .put("/nomination/1")
                .send({ candidate_id: new ObjectId() });

            expect(res).to.have.status(404);
            expect(res.body).to.have.property("success", false);
        });

        it("should return 404 if event not found", async () => {
            nominationStub.resolves({ id: new ObjectId() });
            eventStub.resolves(null);

            const res = await chai.request(app)
                .put("/nomination/1")
                .send({ event_id: new ObjectId() });

            expect(res).to.have.status(404);
            expect(res.body).to.have.property("success", false);
        });

        it("should return 404 if category not found", async () => {
            nominationStub.resolves({ id: new ObjectId() });
            categoryStub.resolves(null);

            const res = await chai.request(app)
                .put("/nomination/1")
                .send({ category_id: new ObjectId() });

            expect(res).to.have.status(404);
            expect(res.body).to.have.property("success", false);
        });

        it("should return 500 on server error", async () => {
            nominationStub.rejects(new Error("Server error"));

            const res = await chai.request(app)
                .put("/nomination/1")
                .send({ candidate_id: new ObjectId() });

            expect(res).to.have.status(500);
            expect(res.body).to.have.property("success", false);
        });
    });

    describe("getNominationDetails", () => {
        it("should retrieve nomination details successfully", async () => {
            nominationStub.resolves({ id: new ObjectId(), candidate_id: new ObjectId() });

            const res = await chai.request(app)
                .get("/nomination/1");

            expect(res).to.have.status(200);
            expect(res.body).to.have.property("success", true);
        });

        it("should return 404 if nomination not found", async () => {
            nominationStub.resolves(null);

            const res = await chai.request(app)
                .get("/nomination/1");

            expect(res).to.have.status(404);
            expect(res.body).to.have.property("success", false);
        });

        it("should return 500 on server error", async () => {
            nominationStub.rejects(new Error("Server error"));

            const res = await chai.request(app)
                .get("/nomination/1");

            expect(res).to.have.status(500);
            expect(res.body).to.have.property("success", false);
        });
    });

    describe("deleteNomination", () => {
        it("should delete a nomination successfully", async () => {
            const res = await chai.request(app)
                .delete("/nomination/1");

            expect(res).to.have.status(200);
            expect(res.body).to.have.property("success", true);
        });

        it("should return 400 if nominationId is missing", async () => {
            const res = await chai.request(app)
                .delete("/nomination/");

            expect(res).to.have.status(400);
            expect(res.body).to.have.property("success", false);
        });

        it("should return 404 if nomination not found", async () => {
            nominationStub.resolves(null);

            const res = await chai.request(app)
                .delete("/nomination/1");

            expect(res).to.have.status(404);
            expect(res.body).to.have.property("success", false);
        });

        it("should return 500 on server error", async () => {
            nominationStub.rejects(new Error("Server error"));

            const res = await chai.request(app)
                .delete("/nomination/1");

            expect(res).to.have.status(500);
            expect(res.body).to.have.property("success", false);
        });
    });

    describe("countNominations", () => {
        it("should successfully count nominations", async () => {
            nominationStub.resolves(5);

            const res = await chai.request(app)
                .get("/nomination/count");

            expect(res).to.have.status(200);
            expect(res.body).to.have.property("success", true);
            expect(res.body).to.have.property("count", 5);
        });

        it("should return 500 on server error", async () => {
            nominationStub.rejects(new Error("Server error"));

            const res = await chai.request(app)
                .get("/nomination/count");

            expect(res).to.have.status(500);
            expect(res.body).to.have.property("success", false);
        });
    });
});
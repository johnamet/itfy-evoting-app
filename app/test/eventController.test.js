import chai from "chai";
import chaiHttp from "chai-http";
import sinon from "sinon";
import { ObjectId } from "mongodb";
import app from "../app.js";
import EventController from "../controllers/EventController.js";
import Event from "../models/event.js";

const { expect } = chai;
chai.use(chaiHttp);

describe("EventController Tests", () => {
    let eventStub;

    beforeEach(() => {
        eventStub = sinon.stub(Event, "get");
        sinon.stub(Event.prototype, "save").resolves(true);
        sinon.stub(Event.prototype, "updateInstance").resolves(true);
        sinon.stub(Event, "delete").resolves(true);
        sinon.stub(Event, "all").resolves([]);
    });

    afterEach(() => {
        sinon.restore();
    });

    describe("createEvent", () => {
        it("should create an event successfully", async () => {
            eventStub.resolves(null);

            const res = await chai.request(app)
                .post("/event")
                .send({ name: "Event1", description: "Description1", startDate: "2024-12-01", endDate: "2024-12-02" });

            expect(res).to.have.status(201);
            expect(res.body).to.have.property("success", true);
        });

        it("should return 400 if missing required fields", async () => {
            const res = await chai.request(app)
                .post("/event")
                .send({ name: "Event1" });

            expect(res).to.have.status(400);
            expect(res.body).to.have.property("success", false);
        });

        it("should return 400 if event already exists", async () => {
            eventStub.resolves({ id: new ObjectId() });

            const res = await chai.request(app)
                .post("/event")
                .send({ name: "Event1", description: "Description1", startDate: "2024-12-01", endDate: "2024-12-02" });

            expect(res).to.have.status(400);
            expect(res.body).to.have.property("success", false);
        });

        it("should return 500 on server error", async () => {
            eventStub.rejects(new Error("Server error"));

            const res = await chai.request(app)
                .post("/event")
                .send({ name: "Event1", description: "Description1", startDate: "2024-12-01", endDate: "2024-12-02" });

            expect(res).to.have.status(500);
            expect(res.body).to.have.property("success", false);
        });
    });

    describe("updateEvent", () => {
        it("should update an event successfully", async () => {
            eventStub.resolves({ id: new ObjectId() });

            const res = await chai.request(app)
                .put("/event/1")
                .send({ name: "UpdatedEvent" });

            expect(res).to.have.status(200);
            expect(res.body).to.have.property("success", true);
        });

        it("should return 400 if eventId is missing", async () => {
            const res = await chai.request(app)
                .put("/event/")
                .send({ name: "UpdatedEvent" });

            expect(res).to.have.status(400);
            expect(res.body).to.have.property("success", false);
        });

        it("should return 404 if event not found", async () => {
            eventStub.resolves(null);

            const res = await chai.request(app)
                .put("/event/1")
                .send({ name: "UpdatedEvent" });

            expect(res).to.have.status(404);
            expect(res.body).to.have.property("success", false);
        });

        it("should return 500 on server error", async () => {
            eventStub.rejects(new Error("Server error"));

            const res = await chai.request(app)
                .put("/event/1")
                .send({ name: "UpdatedEvent" });

            expect(res).to.have.status(500);
            expect(res.body).to.have.property("success", false);
        });
    });

    describe("deleteEvent", () => {
        it("should delete an event successfully", async () => {
            const res = await chai.request(app)
                .delete("/event/1");

            expect(res).to.have.status(200);
            expect(res.body).to.have.property("success", true);
        });

        it("should return 400 if eventId is missing", async () => {
            const res = await chai.request(app)
                .delete("/event/");

            expect(res).to.have.status(400);
            expect(res.body).to.have.property("success", false);
        });

        it("should return 404 if event not found", async () => {
            eventStub.resolves(null);

            const res = await chai.request(app)
                .delete("/event/1");

            expect(res).to.have.status(404);
            expect(res.body).to.have.property("success", false);
        });

        it("should return 500 on server error", async () => {
            eventStub.rejects(new Error("Server error"));

            const res = await chai.request(app)
                .delete("/event/1");

            expect(res).to.have.status(500);
            expect(res.body).to.have.property("success", false);
        });
    });

    describe("listEvents", () => {
        it("should list all events successfully", async () => {
            eventStub.resolves([{ id: new ObjectId(), name: "Event1" }]);

            const res = await chai.request(app)
                .get("/event");

            expect(res).to.have.status(200);
            expect(res.body).to.have.property("success", true);
        });

        it("should return 404 if no events found", async () => {
            eventStub.resolves([]);

            const res = await chai.request(app)
                .get("/event");

            expect(res).to.have.status(404);
            expect(res.body).to.have.property("success", false);
        });

        it("should return 500 on server error", async () => {
            eventStub.rejects(new Error("Server error"));

            const res = await chai.request(app)
                .get("/event");

            expect(res).to.have.status(500);
            expect(res.body).to.have.property("success", false);
        });
    });

    describe("getEventDetails", () => {
        it("should retrieve event details successfully", async () => {
            eventStub.resolves({ id: new ObjectId(), name: "Event1" });

            const res = await chai.request(app)
                .get("/event/1");

            expect(res).to.have.status(200);
            expect(res.body).to.have.property("success", true);
        });

        it("should return 404 if event not found", async () => {
            eventStub.resolves(null);

            const res = await chai.request(app)
                .get("/event/1");

            expect(res).to.have.status(404);
            expect(res.body).to.have.property("success", false);
        });

        it("should return 500 on server error", async () => {
            eventStub.rejects(new Error("Server error"));

            const res = await chai.request(app)
                .get("/event/1");

            expect(res).to.have.status(500);
            expect(res.body).to.have.property("success", false);
        });
    });
});
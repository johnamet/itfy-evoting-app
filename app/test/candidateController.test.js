import chaiHttp from "chai-http";
import sinon from "sinon";
import { ObjectId } from "mongodb";
import fs from "fs";
import app from "../app.js";
import Candidate from "../models/candidate.js";
import Event from "../models/event.js";
import Category from "../models/category.js";

import {use, expect} from 'chai';

use(chaiHttp);

describe("CandidateController", () => {
    let eventStub, categoryStub, candidateStub, fileStub;

    beforeEach(() => {
        // Stubs for dependencies
        eventStub = sinon.stub(Event, "get");
        categoryStub = sinon.stub(Category, "get");
        candidateStub = sinon.stub(Candidate, "get");
        sinon.stub(Candidate, "create");
        sinon.stub(Candidate.prototype, "save");
        sinon.stub(Candidate.prototype, "updateInstance");
        sinon.stub(Candidate, "delete");
        fileStub = sinon.stub(fs, "createReadStream");
    });

    afterEach(() => {
        // Restore original behavior
        sinon.restore();
    });

    describe("POST /candidates (createCandidate)", () => {
        it("should create a candidate successfully", async () => {
            eventStub.resolves({ id: "event123" });
            categoryStub.resolves({ id: "cat123" });
            candidateStub.resolves(null);
            sinon.stub(Candidate, "create").returns({
                save: sinon.stub().resolves({ id: "candidate123" }),
                to_object: () => ({ id: "candidate123", name: "John Doe" })
            });

            const res = await chai
                .request(app)
                .post("/candidates")
                .set("Authorization", "Bearer mocktoken")
                .send({ name: "John Doe", event_id: "event123", category_ids: ["cat123"] });

            expect(res).to.have.status(201);
            expect(res.body).to.have.property("success", true);
            expect(res.body.candidate).to.deep.include({ name: "John Doe" });
        });

        it("should return 400 if required fields are missing", async () => {
            const res = await chai
                .request(app)
                .post("/candidates")
                .set("Authorization", "Bearer mocktoken")
                .send({ name: "John Doe" }); // Missing event_id

            expect(res).to.have.status(400);
            expect(res.body).to.have.property("success", false);
            expect(res.body).to.have.property("error", "Missing required fields: `name`, `event_id`.");
        });

        it("should return 404 if event is not found", async () => {
            eventStub.resolves(null);

            const res = await chai
                .request(app)
                .post("/candidates")
                .set("Authorization", "Bearer mocktoken")
                .send({ name: "John Doe", event_id: "invalid_event" });

            expect(res).to.have.status(404);
            expect(res.body).to.have.property("success", false);
            expect(res.body).to.have.property("error", "Event with ID invalid_event not found.");
        });

        it("should return 500 for server errors", async () => {
            eventStub.rejects(new Error("Database error"));

            const res = await chai
                .request(app)
                .post("/candidates")
                .set("Authorization", "Bearer mocktoken")
                .send({ name: "John Doe", event_id: "event123" });

            expect(res).to.have.status(500);
            expect(res.body).to.have.property("success", false);
            expect(res.body).to.have.property("error", "Database error");
        });
    });

    describe("POST /candidates/bulk (bulkUploadCandidates)", () => {
        it("should process a bulk upload successfully", async () => {
            const mockFileStream = { pipe: sinon.stub().returnsThis(), on: sinon.stub() };
            fileStub.returns(mockFileStream);
            eventStub.resolves({ id: "event123" });
            categoryStub.resolves({ id: "cat123" });
            sinon.stub(Candidate, "create").returns({
                save: sinon.stub().resolves()
            });

            const res = await chai
                .request(app)
                .post("/candidates/bulk")
                .set("Authorization", "Bearer mocktoken")
                .attach("file", Buffer.from("name,event_id,category_ids\nJohn Doe,event123,cat123"), "test.csv");

            expect(res).to.have.status(200);
            expect(res.body).to.have.property("success", true);
            expect(res.body).to.have.property("message").that.includes("Bulk upload initiated");
        });

        it("should return 400 if no file is uploaded", async () => {
            const res = await chai
                .request(app)
                .post("/candidates/bulk")
                .set("Authorization", "Bearer mocktoken");

            expect(res).to.have.status(400);
            expect(res.body).to.have.property("success", false);
            expect(res.body).to.have.property("error", "No file uploaded.");
        });

        it("should return 400 if file is missing required columns", async () => {
            const mockFileStream = { pipe: sinon.stub().returnsThis(), on: sinon.stub() };
            fileStub.returns(mockFileStream);

            const res = await chai
                .request(app)
                .post("/candidates/bulk")
                .set("Authorization", "Bearer mocktoken")
                .attach("file", Buffer.from("name,event_id\nJohn Doe,event123"), "test.csv");

            expect(res).to.have.status(400);
            expect(res.body).to.have.property("success", false);
            expect(res.body).to.have.property("error").that.includes("Missing required columns");
        });
    });

    describe("GET /candidates", () => {
        it("should list all candidates", async () => {
            sinon.stub(Candidate, "all").resolves([
                { id: "1", name: "John Doe", event_id: "event123" },
                { id: "2", name: "Jane Smith", event_id: "event124" }
            ]);

            const res = await chai.request(app).get("/candidates");

            expect(res).to.have.status(200);
            expect(res.body).to.have.property("success", true);
            expect(res.body.candidates).to.have.lengthOf(2);
        });

        it("should return 404 if no candidates are found", async () => {
            sinon.stub(Candidate, "all").resolves([]);

            const res = await chai.request(app).get("/candidates");

            expect(res).to.have.status(404);
            expect(res.body).to.have.property("success", false);
            expect(res.body).to.have.property("error", "No candidates found matching the given criteria.");
        });

        it("should return 500 for server errors", async () => {
            sinon.stub(Candidate, "all").rejects(new Error("Database error"));

            const res = await chai.request(app).get("/candidates");

            expect(res).to.have.status(500);
            expect(res.body).to.have.property("success", false);
            expect(res.body).to.have.property("error", "Database error");
        });
    });
});
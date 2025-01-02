import chaiHttp from "chai-http";
import sinon from "sinon";
import { ObjectId } from "mongodb";
import app from "../app.js";
import UserController from "../controllers/UserController.js";
import User from "../models/user.js";

import {use, expect} from 'chai';

use(chaiHttp);

describe("UserController Tests", () => {
    let userStub;

    beforeEach(() => {
        userStub = sinon.stub(User, "get");
        sinon.stub(User.prototype, "save").resolves(true);
        sinon.stub(User.prototype, "updateInstance").resolves(true);
        sinon.stub(User, "delete").resolves(true);
        sinon.stub(User, "all").resolves([]);
    });

    afterEach(() => {
        sinon.restore();
    });

    describe("createUser", () => {
        it("should create a user successfully", async () => {
            userStub.resolves(null);

            const res = await chai.request(app)
                .post("/user")
                .send({ name: "John Doe", email: "john@example.com", password: "password123" });

            expect(res).to.have.status(201);
            expect(res.body).to.have.property("success", true);
        });

        it("should return 400 if missing required fields", async () => {
            const res = await chai.request(app)
                .post("/user")
                .send({ name: "John Doe" });

            expect(res).to.have.status(400);
            expect(res.body).to.have.property("success", false);
        });

        it("should return 400 if user with the same email exists", async () => {
            userStub.resolves({ id: new ObjectId() });

            const res = await chai.request(app)
                .post("/user")
                .send({ name: "John Doe", email: "john@example.com", password: "password123" });

            expect(res).to.have.status(400);
            expect(res.body).to.have.property("success", false);
        });

        it("should return 500 on server error", async () => {
            userStub.rejects(new Error("Server error"));

            const res = await chai.request(app)
                .post("/user")
                .send({ name: "John Doe", email: "john@example.com", password: "password123" });

            expect(res).to.have.status(500);
            expect(res.body).to.have.property("success", false);
        });
    });

    describe("updateUser", () => {
        it("should update a user successfully", async () => {
            userStub.resolves({ id: new ObjectId() });

            const res = await chai.request(app)
                .put("/user/1")
                .send({ name: "Updated Name" });

            expect(res).to.have.status(200);
            expect(res.body).to.have.property("success", true);
        });

        it("should return 400 if userId is missing", async () => {
            const res = await chai.request(app)
                .put("/user/")
                .send({ name: "Updated Name" });

            expect(res).to.have.status(400);
            expect(res.body).to.have.property("success", false);
        });

        it("should return 400 if request body is missing", async () => {
            const res = await chai.request(app)
                .put("/user/1")
                .send({});

            expect(res).to.have.status(400);
            expect(res.body).to.have.property("success", false);
        });

        it("should return 404 if user not found", async () => {
            userStub.resolves(null);

            const res = await chai.request(app)
                .put("/user/1")
                .send({ name: "Updated Name" });

            expect(res).to.have.status(404);
            expect(res.body).to.have.property("success", false);
        });

        it("should return 500 on server error", async () => {
            userStub.rejects(new Error("Server error"));

            const res = await chai.request(app)
                .put("/user/1")
                .send({ name: "Updated Name" });

            expect(res).to.have.status(500);
            expect(res.body).to.have.property("success", false);
        });
    });

    describe("deleteUser", () => {
        it("should delete a user successfully", async () => {
            const res = await chai.request(app)
                .delete("/user/1");

            expect(res).to.have.status(200);
            expect(res.body).to.have.property("success", true);
        });

        it("should return 400 if userId is missing", async () => {
            const res = await chai.request(app)
                .delete("/user/");

            expect(res).to.have.status(400);
            expect(res.body).to.have.property("success", false);
        });

        it("should return 404 if user not found", async () => {
            userStub.resolves(null);

            const res = await chai.request(app)
                .delete("/user/1");

            expect(res).to.have.status(404);
            expect(res.body).to.have.property("success", false);
        });

        it("should return 500 on server error", async () => {
            userStub.rejects(new Error("Server error"));

            const res = await chai.request(app)
                .delete("/user/1");

            expect(res).to.have.status(500);
            expect(res.body).to.have.property("success", false);
        });
    });

    describe("listUsers", () => {
        it("should list all users successfully", async () => {
            userStub.resolves([{ id: new ObjectId(), name: "John Doe" }]);

            const res = await chai.request(app)
                .get("/user");

            expect(res).to.have.status(200);
            expect(res.body).to.have.property("success", true);
        });

        it("should return 404 if no users found", async () => {
            userStub.resolves([]);

            const res = await chai.request(app)
                .get("/user");

            expect(res).to.have.status(404);
            expect(res.body).to.have.property("success", false);
        });

        it("should return 500 on server error", async () => {
            userStub.rejects(new Error("Server error"));

            const res = await chai.request(app)
                .get("/user");

            expect(res).to.have.status(500);
            expect(res.body).to.have.property("success", false);
        });
    });

    describe("myProfile", () => {
        it("should retrieve user profile successfully", async () => {
            userStub.resolves({ id: new ObjectId(), name: "John Doe" });

            const res = await chai.request(app)
                .get("/user/profile/1");

            expect(res).to.have.status(200);
            expect(res.body).to.have.property("success", true);
        });

        it("should return 400 if userId is missing", async () => {
            const res = await chai.request(app)
                .get("/user/profile/");

            expect(res).to.have.status(400);
            expect(res.body).to.have.property("success", false);
        });

        it("should return 404 if user not found", async () => {
            userStub.resolves(null);

            const res = await chai.request(app)
                .get("/user/profile/1");

            expect(res).to.have.status(404);
            expect(res.body).to.have.property("success", false);
        });

        it("should return 500 on server error", async () => {
            userStub.rejects(new Error("Server error"));

            const res = await chai.request(app)
                .get("/user/profile/1");

            expect(res).to.have.status(500);
            expect(res.body).to.have.property("success", false);
        });
    });
});
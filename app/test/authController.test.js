import chaiHttp from "chai-http";
import sinon from "sinon";
import jwt from "jsonwebtoken";
import AuthController from "../controllers/AuthController.js";
import User from "../models/user.js";
import Role from "../models/role.js";
import app from "../server.js";
import {use, expect} from 'chai';

use(chaiHttp);

describe("AuthController - Login", () => {
    let userStub, verifyPasswordStub, roleStub, jwtStub;

    beforeEach(() => {
        // Stubs for dependencies
        userStub = sinon.stub(User, "get");
        verifyPasswordStub = sinon.stub(User.prototype, "verifyPassword");
        roleStub = sinon.stub(Role, "get");
        jwtStub = sinon.stub(jwt, "sign");
    });

    afterEach(() => {
        // Restore original behavior
        sinon.restore();
    });

    it("should log in the user and return a token", async () => {
        const userMock = { id: "12345", email: "test@example.com", roleId: "67890" };
        const roleMock = { name: "admin" };

        userStub.resolves(userMock);
        verifyPasswordStub.resolves(true);
        roleStub.resolves(roleMock);
        jwtStub.returns("mockedToken");

        const res = await chai
            .request(app)
            .post("/auth/login")
            .send({ email: "test@example.com", password: "password" });

        expect(res).to.have.status(200);
        expect(res.body).to.have.property("success", true);
        expect(res.body).to.have.property("accessToken", "mockedToken");
    });

    it("should return 400 if email or password is missing", async () => {
        const res = await chai.request(app).post("/auth/login").send({ email: "test@example.com" });

        expect(res).to.have.status(400);
        expect(res.body).to.have.property("success", false);
        expect(res.body).to.have.property("error", "Missing required fields: `email` or `password`");
    });

    it("should return 404 if user is not found", async () => {
        userStub.resolves(null);

        const res = await chai
            .request(app)
            .post("/auth/login")
            .send({ email: "unknown@example.com", password: "password" });

        expect(res).to.have.status(404);
        expect(res.body).to.have.property("success", false);
        expect(res.body).to.have.property("error", "User with email: unknown@example.com not found");
    });

    it("should return 400 if the password is incorrect", async () => {
        const userMock = { id: "12345", email: "test@example.com", roleId: "67890" };

        userStub.resolves(userMock);
        verifyPasswordStub.resolves(false);

        const res = await chai
            .request(app)
            .post("/auth/login")
            .send({ email: "test@example.com", password: "wrongpassword" });

        expect(res).to.have.status(400);
        expect(res.body).to.have.property("success", false);
        expect(res.body).to.have.property("error", "Password mismatched.");
    });

    it("should return 500 if an error occurs", async () => {
        userStub.rejects(new Error("Database connection error"));

        const res = await chai
            .request(app)
            .post("/auth/login")
            .send({ email: "test@example.com", password: "password" });

        expect(res).to.have.status(500);
        expect(res.body).to.have.property("success", false);
        expect(res.body).to.have.property("error", "Database connection error");
    });

    it("should handle missing role gracefully", async () => {
        const userMock = { id: "12345", email: "test@example.com", roleId: null };

        userStub.resolves(userMock);
        verifyPasswordStub.resolves(true);
        jwtStub.returns("mockedToken");

        const res = await chai
            .request(app)
            .post("/auth/login")
            .send({ email: "test@example.com", password: "password" });

        expect(res).to.have.status(200);
        expect(res.body).to.have.property("success", true);
        expect(res.body).to.have.property("accessToken", "mockedToken");
    });
});
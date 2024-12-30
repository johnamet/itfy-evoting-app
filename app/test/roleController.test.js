import chai from "chai";
import chaiHttp from "chai-http";
import sinon from "sinon";
import { ObjectId } from "mongodb";
import app from "../app.js";
import RoleController from "../controllers/RoleController.js";
import Role from "../models/role.js";

const { expect } = chai;
chai.use(chaiHttp);

describe("RoleController Tests", () => {
    let roleStub;

    beforeEach(() => {
        roleStub = sinon.stub(Role, "get");
        sinon.stub(Role.prototype, "save").resolves(true);
        sinon.stub(Role.prototype, "updateInstance").resolves(true);
        sinon.stub(Role, "delete").resolves(true);
        sinon.stub(Role, "all").resolves([]);
    });

    afterEach(() => {
        sinon.restore();
    });

    describe("createRole", () => {
        it("should create a role successfully", async () => {
            roleStub.resolves(null);

            const res = await chai.request(app)
                .post("/role")
                .send({ name: "Admin", description: "Administrator role" });

            expect(res).to.have.status(201);
            expect(res.body).to.have.property("success", true);
        });

        it("should return 400 if missing required fields", async () => {
            const res = await chai.request(app)
                .post("/role")
                .send({ name: "Admin" });

            expect(res).to.have.status(400);
            expect(res.body).to.have.property("success", false);
        });

        it("should return 403 if role with the same name exists", async () => {
            roleStub.resolves({ id: new ObjectId() });

            const res = await chai.request(app)
                .post("/role")
                .send({ name: "Admin", description: "Administrator role" });

            expect(res).to.have.status(403);
            expect(res.body).to.have.property("success", false);
        });

        it("should return 500 on server error", async () => {
            roleStub.rejects(new Error("Server error"));

            const res = await chai.request(app)
                .post("/role")
                .send({ name: "Admin", description: "Administrator role" });

            expect(res).to.have.status(500);
            expect(res.body).to.have.property("success", false);
        });
    });

    describe("getRole", () => {
        it("should retrieve a role successfully", async () => {
            roleStub.resolves({ id: new ObjectId(), name: "Admin", description: "Administrator role" });

            const res = await chai.request(app)
                .get("/role/1");

            expect(res).to.have.status(200);
            expect(res.body).to.have.property("success", true);
        });

        it("should return 400 if roleId is missing", async () => {
            const res = await chai.request(app)
                .get("/role/");

            expect(res).to.have.status(400);
            expect(res.body).to.have.property("success", false);
        });

        it("should return 404 if role not found", async () => {
            roleStub.resolves(null);

            const res = await chai.request(app)
                .get("/role/1");

            expect(res).to.have.status(404);
            expect(res.body).to.have.property("success", false);
        });

        it("should return 500 on server error", async () => {
            roleStub.rejects(new Error("Server error"));

            const res = await chai.request(app)
                .get("/role/1");

            expect(res).to.have.status(500);
            expect(res.body).to.have.property("success", false);
        });
    });

    describe("listRoles", () => {
        it("should list all roles successfully", async () => {
            roleStub.resolves([{ id: new ObjectId(), name: "Admin" }]);

            const res = await chai.request(app)
                .get("/role");

            expect(res).to.have.status(200);
            expect(res.body).to.have.property("success", true);
        });

        it("should return 500 on server error", async () => {
            roleStub.rejects(new Error("Server error"));

            const res = await chai.request(app)
                .get("/role");

            expect(res).to.have.status(500);
            expect(res.body).to.have.property("success", false);
        });
    });

    describe("updateRole", () => {
        it("should update a role successfully", async () => {
            roleStub.resolves({ id: new ObjectId() });

            const res = await chai.request(app)
                .put("/role/1")
                .send({ name: "UpdatedRole" });

            expect(res).to.have.status(200);
            expect(res.body).to.have.property("success", true);
        });

        it("should return 400 if roleId is missing", async () => {
            const res = await chai.request(app)
                .put("/role/")
                .send({ name: "UpdatedRole" });

            expect(res).to.have.status(400);
            expect(res.body).to.have.property("success", false);
        });

        it("should return 400 if fields to update are missing", async () => {
            const res = await chai.request(app)
                .put("/role/1")
                .send({});

            expect(res).to.have.status(400);
            expect(res.body).to.have.property("success", false);
        });

        it("should return 404 if role not found", async () => {
            roleStub.resolves(null);

            const res = await chai.request(app)
                .put("/role/1")
                .send({ name: "UpdatedRole" });

            expect(res).to.have.status(404);
            expect(res.body).to.have.property("success", false);
        });

        it("should return 500 on server error", async () => {
            roleStub.rejects(new Error("Server error"));

            const res = await chai.request(app)
                .put("/role/1")
                .send({ name: "UpdatedRole" });

            expect(res).to.have.status(500);
            expect(res.body).to.have.property("success", false);
        });
    });

    describe("deleteRole", () => {
        it("should delete a role successfully", async () => {
            const res = await chai.request(app)
                .delete("/role/1");

            expect(res).to.have.status(200);
            expect(res.body).to.have.property("success", true);
        });

        it("should return 400 if roleId is missing", async () => {
            const res = await chai.request(app)
                .delete("/role/");

            expect(res).to.have.status(400);
            expect(res.body).to.have.property("success", false);
        });

        it("should return 404 if role not found", async () => {
            roleStub.resolves(null);

            const res = await chai.request(app)
                .delete("/role/1");

            expect(res).to.have.status(404);
            expect(res.body).to.have.property("success", false);
        });

        it("should return 500 on server error", async () => {
            roleStub.rejects(new Error("Server error"));

            const res = await chai.request(app)
                .delete("/role/1");

            expect(res).to.have.status(500);
            expect(res.body).to.have.property("success", false);
        });
    });
});
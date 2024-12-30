import chai from "chai";
import chaiHttp from "chai-http";
import sinon from "sinon";
import { ObjectId } from "mongodb";
import app from "../app.js";
import CategoryController from "../controllers/CategoryController.js";
import Category from "../models/category.js";
import Event from "../models/event.js";

const { expect } = chai;
chai.use(chaiHttp);

describe("CategoryController Tests", () => {
    let categoryStub, eventStub;

    beforeEach(() => {
        categoryStub = sinon.stub(Category, "get");
        sinon.stub(Category.prototype, "save").resolves(true);
        sinon.stub(Category.prototype, "updateInstance").resolves(true);
        sinon.stub(Category, "delete").resolves(true);
        sinon.stub(Category, "all").resolves([]);
        eventStub = sinon.stub(Event, "get");
    });

    afterEach(() => {
        sinon.restore();
    });

    describe("createCategory", () => {
        it("should create a category successfully", async () => {
            eventStub.resolves({ id: new ObjectId() });

            const res = await chai.request(app)
                .post("/category")
                .send({ name: "Category1", description: "Description1", eventId: new ObjectId() });

            expect(res).to.have.status(201);
            expect(res.body).to.have.property("success", true);
        });

        it("should return 400 if missing required fields", async () => {
            const res = await chai.request(app)
                .post("/category")
                .send({ name: "Category1" });

            expect(res).to.have.status(400);
            expect(res.body).to.have.property("success", false);
        });

        it("should return 404 if event not found", async () => {
            eventStub.resolves(null);

            const res = await chai.request(app)
                .post("/category")
                .send({ name: "Category1", description: "Description1", eventId: new ObjectId() });

            expect(res).to.have.status(404);
            expect(res.body).to.have.property("success", false);
        });

        it("should return 400 if category already exists", async () => {
            eventStub.resolves({ id: new ObjectId() });
            categoryStub.resolves({ id: new ObjectId() });

            const res = await chai.request(app)
                .post("/category")
                .send({ name: "Category1", description: "Description1", eventId: new ObjectId() });

            expect(res).to.have.status(400);
            expect(res.body).to.have.property("success", false);
        });
    });

    describe("updateCategory", () => {
        it("should update a category successfully", async () => {
            categoryStub.resolves({ id: new ObjectId() });

            const res = await chai.request(app)
                .put("/category/1")
                .send({ name: "UpdatedCategory" });

            expect(res).to.have.status(200);
            expect(res.body).to.have.property("success", true);
        });

        it("should return 400 if categoryId is missing", async () => {
            const res = await chai.request(app)
                .put("/category/")
                .send({ name: "UpdatedCategory" });

            expect(res).to.have.status(400);
            expect(res.body).to.have.property("success", false);
        });

        it("should return 404 if category not found", async () => {
            categoryStub.resolves(null);

            const res = await chai.request(app)
                .put("/category/1")
                .send({ name: "UpdatedCategory" });

            expect(res).to.have.status(404);
            expect(res.body).to.have.property("success", false);
        });
    });

    describe("deleteCategory", () => {
        it("should delete a category successfully", async () => {
            const res = await chai.request(app)
                .delete("/category/1");

            expect(res).to.have.status(200);
            expect(res.body).to.have.property("success", true);
        });

        it("should return 400 if categoryId is missing", async () => {
            const res = await chai.request(app)
                .delete("/category/");

            expect(res).to.have.status(400);
            expect(res.body).to.have.property("success", false);
        });

        it("should return 404 if category not found", async () => {
            categoryStub.resolves(null);

            const res = await chai.request(app)
                .delete("/category/1");

            expect(res).to.have.status(404);
            expect(res.body).to.have.property("success", false);
        });
    });

    describe("listCategories", () => {
        it("should list all categories successfully", async () => {
            categoryStub.resolves([{ id: new ObjectId(), name: "Category1" }]);

            const res = await chai.request(app)
                .get("/category");

            expect(res).to.have.status(200);
            expect(res.body).to.have.property("success", true);
        });

        it("should return 404 if no categories found", async () => {
            categoryStub.resolves([]);

            const res = await chai.request(app)
                .get("/category");

            expect(res).to.have.status(404);
            expect(res.body).to.have.property("success", false);
        });
    });

    describe("getCategoryDetails", () => {
        it("should retrieve category details successfully", async () => {
            categoryStub.resolves({ id: new ObjectId(), name: "Category1" });

            const res = await chai.request(app)
                .get("/category/1");

            expect(res).to.have.status(200);
            expect(res.body).to.have.property("success", true);
        });

        it("should return 404 if category not found", async () => {
            categoryStub.resolves(null);

            const res = await chai.request(app)
                .get("/category/1");

            expect(res).to.have.status(404);
            expect(res.body).to.have.property("success", false);
        });
    });
});
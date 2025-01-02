import chaiHttp from "chai-http";
import sinon from "sinon";
import sinonChai from "sinon-chai";
import app from "../app.js";
import AppController from "../controllers/AppController.js";

import { expect, use } from "chai";

use(chaiHttp);
use(sinonChai);

describe("AppController Tests", () => {
  before(() => {
    // Initialize storage before tests
    AppController.initializeStorage();
  });

  describe("GET /status", () => {
    it("should return the status of the application", async () => {
      const res = await chai.request(app).get("/evoting/status");
      expect(res).to.have.status(200);
      expect(res.body).to.be.an("object");
      expect(res.body).to.have.property("connection", "Ok");
    });
  });

  describe("GET /stats", () => {
    it("should return statistics for the application", async () => {
      const mockData = {
        candidates: 5,
        categories: 3,
        events: 2,
        nominations: 4,
        roles: 1,
        users: 10,
        votes: 20,
      };

      const mockCandidate = sinon.stub(AppController, "getStats").resolves(mockData);

      const res = await chai.request(app).get("/evoting/stats");
      expect(res).to.have.status(200);
      expect(res.body).to.deep.equal(mockData);

      mockCandidate.restore();
    });
  });

  describe("POST /files/upload", () => {
    it("should upload a file and return its details", async () => {
      const fileData = Buffer.from("Test File Content");
      const fileName = "testfile.txt";

      const res = await chai
        .request(app)
        .post("/evoting/files/upload")
        .set("Content-Type", "multipart/form-data")
        .field("category", "testCategory")
        .field("entityId", "testEntity")
        .attach("file", fileData, fileName);

      expect(res).to.have.status(201);
      expect(res.body).to.have.property("success", true);
      expect(res.body.file).to.include({ name: fileName });
    });
  });

  describe("GET /files", () => {
    it("should return a list of files for a given category and entity", async () => {
      const res = await chai
        .request(app)
        .get("/evoting/files")
        .query({ category: "testCategory", entityId: "testEntity" });

      expect(res).to.have.status(200);
      expect(res.body).to.have.property("success", true);
      expect(res.body.files).to.be.an("array");
    });
  });

  describe("GET /files/download", () => {
    it("should download a specific file", async () => {
      const res = await chai
        .request(app)
        .get("/evoting/files/download")
        .query({
          category: "testCategory",
          entityId: "testEntity",
          fileName: "testfile.txt",
        });

      expect(res).to.have.status(200);
      expect(res.headers["content-type"]).to.equal("application/octet-stream");
    });
  });
});
import sinon from "sinon";
import pkg from "mongodb";
import {StorageEngine} from "../utils/engine/StorageEngine.js";

const { MongoClient } = pkg;

import {expect} from 'chai';

describe("StorageEngine", () => {
    let storageEngine;
    let mockClient;
    let mockDb;
    let sandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        mockClient = sandbox.stub(new MongoClient("mongodb://localhost:27017"));
        mockDb = {
            collection: sandbox.stub().returns({
                insertOne: sandbox.stub(),
                insertMany: sandbox.stub(),
                updateOne: sandbox.stub(),
                deleteOne: sandbox.stub(),
                deleteMany: sandbox.stub(),
                find: sandbox.stub().returns({ toArray: sandbox.stub() }),
                findOne: sandbox.stub(),
                countDocuments: sandbox.stub(),
            }),
        };

        // sandbox.stub(mockClient, "db").returns(mockDb);
        sandbox.stub(MongoClient.prototype, "connect").resolves(mockClient);
        storageEngine = new StorageEngine();
    });

    afterEach(() => {
        sandbox.restore();
    });

    it("should connect to the database", async () => {
        await storageEngine.connect();

        expect(mockClient.db.calledOnceWith("evoting_db")).to.be.true;
        expect(storageEngine.db).to.equal(mockDb);
    });

    it("should disconnect from the database", async () => {
        sandbox.stub(mockClient, "close").resolves();

        await storageEngine.connect();
        await storageEngine.disconnect();

        expect(mockClient.close.calledOnce).to.be.true;
    });

    it("should insert a document into a collection", async () => {
        const mockCollection = mockDb.collection("testCollection");
        const testData = { name: "test" };

        mockCollection.insertOne.resolves({ acknowledged: true });

        await storageEngine.connect();
        const result = await storageEngine.insert("testCollection", testData);

        expect(mockCollection.insertOne.calledOnceWith(testData)).to.be.true;
        expect(result.acknowledged).to.be.true;
    });

    it("should query documents from a collection", async () => {
        const mockCollection = mockDb.collection("testCollection");
        const queryResult = [{ name: "test1" }, { name: "test2" }];

        mockCollection.find().toArray.resolves(queryResult);

        await storageEngine.connect();
        const result = await storageEngine.query("testCollection", {});

        expect(mockCollection.find.calledOnceWith({})).to.be.true;
        expect(result).to.deep.equal(queryResult);
    });

    it("should count documents in a collection", async () => {
        const mockCollection = mockDb.collection("testCollection");
        const countResult = 42;

        mockCollection.countDocuments.resolves(countResult);

        await storageEngine.connect();
        const result = await storageEngine.count("testCollection");

        expect(mockCollection.countDocuments.calledOnceWith({})).to.be.true;
        expect(result).to.equal(countResult);
    });

    it("should throw an error if no database connection is established", () => {
        expect(() => storageEngine.getCollection("testCollection")).to.throw(
            "Database is not connected. Call connect() first."
        );
    });
});

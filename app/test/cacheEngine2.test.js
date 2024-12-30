import sinon from 'sinon';
import sinonChai from 'sinon-chai';

import {use, expect} from 'chai';
import CacheEngine from "../utils/engine/CacheEngine.js";
import * as redis from 'redis';
const cacheEngine = new CacheEngine();

use(sinonChai);

describe('CacheEngine', () => {
    let client;

    beforeEach(() => {
        client = {
            connect: sinon.stub().resolves(),
            ping: sinon.stub().resolves('PONG'),
            get: sinon.stub(),
            setEx: sinon.stub(),
            del: sinon.stub(),
            incr: sinon.stub(),
            expire: sinon.stub(),
            isReady: true,
        };

        sinon.stub(redis, 'createClient').returns(client);
    });

    afterEach(() => {
        sinon.restore();
    });


    it('should check connection to Redis', async () => {
        expect(cacheEngine.isConnected()).to.be.true;
    });

    it('should get a value by key', async () => {
        // client.get.yields(null, 'testValue');
        const result = await cacheEngine.get('testKey');
        expect(client.get).to.have.been.calledOnceWith('testKey', sinon.match.func);
        expect(result).to.equal('testValue');
    });

    it('should set a value with TTL', async () => {
        await cacheEngine.set('testKey', 'testValue', 3600);
        expect(client.set).to.have.been.calledOnceWith('testKey', 3600, 'testValue');
    });

    it('should delete a key', async () => {
        await cacheEngine.del('testKey');
        expect(client.del).to.have.been.calledOnceWith('testKey');
    });

    it('should increment a key', async () => {
        await cacheEngine.incr('testKey');
        expect(client.incr).to.have.been.calledOnceWith('testKey');
    });

    it('should set a key to expire', async () => {
        await cacheEngine.expire('testKey', 120);
        // expect(client.expire).to.have.been.calledOnceWith('testKey', 120);
    });

    it('should measure latency to Redis server', async () => {
        const latency = await cacheEngine.getLatency();
        // expect(client.ping).to.have.been.calledOnce;
        expect(latency).to.be.a('number').and.to.be.greaterThanOrEqual(0);
    });

    // it('should throw an error if latency measurement fails', async () => {
    //     client.ping.rejects(new Error('Ping failed'));
    //     await expect(cacheEngine.getLatency()).to.be(new Error(), 'Ping failed');
    // });
});

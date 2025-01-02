import sinon from 'sinon';
import sinonChai from 'sinon-chai';

import {use, expect} from 'chai';
import CacheEngine from "../utils/engine/CacheEngine.js";
const cacheEngine = new CacheEngine();

use(sinonChai);

describe('CacheEngine', () => {
    let client;

    beforeEach(() => {
       client = cacheEngine.client;
    });

    afterEach(() => {
        sinon.restore();
    });


    it('should check connection to Redis', async () => {
        expect(cacheEngine.isConnected()).to.be.true;
    });

    it('should get a value by key', async () => {
        await cacheEngine.set("testKey", "testValue")
        const result = await cacheEngine.get('testKey');
        // expect(client.get).to.have.been.calledOnceWith('testKey', sinon.match.func);
        expect(result).to.equal('testValue');
    });

  it('should set a value with TTL', async () => {
    await cacheEngine.set('testKey2', 'testValue', 1); // Set value with TTL of 1 second

    // Wait for 1.5 seconds to ensure the TTL has expired
    await new Promise(resolve => setTimeout(resolve, 1500));

    const result = await cacheEngine.get('testKey2');
    expect(result).to.be.null;
});


    it('should delete a key', async () => {
        await cacheEngine.del('testKey');
        const result = await cacheEngine.get("testKey");
        expect(result).to.be.null;
    });

    it('should increment a key', async () => {
        await cacheEngine.incr('testKey');
        const result = await cacheEngine.get("testKey");
        expect(result).to.be.equal("1");

    });

    it('should set a key to expire', async () => {
        await cacheEngine.expire('testKey', 1);
        await new Promise(resolve => setTimeout(resolve, 1500));
        const result = await cacheEngine.get('testKey');
        expect(result).to.be.null;
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

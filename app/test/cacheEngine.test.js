// import cacheEngine from "../utils/engine/CacheEngine.js";
// import { createClient } from 'redis';
// import jest from "sinon";
//
// jest.mock('redis', () => ({
//     createClient: jest.fn().mockImplementation(() => ({
//         connect: jest.fn().mockResolvedValue(),
//         ping: jest.fn().mockResolvedValue('PONG'),
//         get: jest.fn(),
//         setEx: jest.fn(),
//         del: jest.fn(),
//         incr: jest.fn(),
//         expire: jest.fn(),
//         isReady: true,
//     })),
// }));
//
// describe('CacheEngine', () => {
//     let client;
//
//     beforeEach(() => {
//         client = createClient();
//     });
//
//     afterEach(() => {
//         jest.clearAllMocks();
//     });
//
//     test('should connect to Redis successfully', async () => {
//         expect(client.connect).toHaveBeenCalledTimes(1);
//         expect(client.isReady).toBe(true);
//     });
//
//     test('should check if Redis connection is alive', () => {
//         expect(cacheEngine.isConnected()).toBe(true);
//     });
//
//     test('should get a value by key', async () => {
//         client.get.mockImplementation((key, callback) => callback(null, 'value'));
//         const result = await cacheEngine.get('testKey');
//         expect(client.get).toHaveBeenCalledWith('testKey', expect.any(Function));
//         expect(result).toBe('value');
//     });
//
//     test('should set a value with TTL', async () => {
//         const ttl = 3600;
//         await cacheEngine.set('testKey', 'testValue', ttl);
//         expect(client.setEx).toHaveBeenCalledWith('testKey', ttl, 'testValue');
//     });
//
//     test('should delete a key', async () => {
//         await cacheEngine.del('testKey');
//         expect(client.del).toHaveBeenCalledWith('testKey');
//     });
//
//     test('should increment a key', async () => {
//         await cacheEngine.incr('testKey');
//         expect(client.incr).toHaveBeenCalledWith('testKey');
//     });
//
//     test('should set a key to expire', async () => {
//         const timeWindow = 120;
//         await cacheEngine.expire('testKey', timeWindow);
//         expect(client.expire).toHaveBeenCalledWith('testKey', timeWindow);
//     });
//
//     test('should measure latency to Redis server', async () => {
//         const latency = await cacheEngine.getLatency();
//         expect(client.ping).toHaveBeenCalledTimes(1);
//         expect(latency).toBeGreaterThanOrEqual(0);
//     });
//
//     test('should throw an error if latency measurement fails', async () => {
//         client.ping.mockRejectedValue(new Error('Ping failed'));
//         await expect(cacheEngine.getLatency()).rejects.toThrow('Ping failed');
//     });
// });

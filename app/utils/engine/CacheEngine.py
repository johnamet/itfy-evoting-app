import os
import redis
import json

class CacheEngine:
    def __init__(self):
        REDIS_HOST = os.getenv('REDIS_HOST', 'localhost')
        REDIS_PORT = int(os.getenv('REDIS_PORT', 6379))

        self.client = redis.Redis(host=REDIS_HOST, port=REDIS_PORT)

        try:
            self.client.ping()
            print('Redis client connected to the server')
        except redis.ConnectionError as error:
            print(f'Redis client error: {error}')

    def is_connected(self):
        return self.client.ping()

    async def get(self, key):
        try:
            return self.client.get(key)
        except redis.RedisError as error:
            print(f'Error getting key "{key}": {error}')
            raise error

    async def set(self, key, value, ttl=60 * 24 * 60 * 60):
        try:
            self.client.setex(key, ttl, value)
        except redis.RedisError as error:
            print(f'Error setting key "{key}" with TTL: {error}')
            raise error

    async def del_key(self, key):
        try:
            self.client.delete(key)
        except redis.RedisError as error:
            print(f'Error deleting key "{key}": {error}')
            raise error

    async def incr(self, key):
        try:
            return self.client.incr(key)
        except redis.RedisError as error:
            print(f'Error incrementing key "{key}": {error}')
            raise error

    async def expire(self, key, ttl):
        try:
            self.client.expire(key, ttl)
        except redis.RedisError as error:
            print(f'Error setting expiration for key "{key}": {error}')
            raise error

    async def get_latency(self):
        try:
            start = time.time()
            self.client.ping()
            return (time.time() - start) * 1000
        except redis.RedisError as error:
            print(f'Failed to measure latency: {error}')
            raise error

    async def set_object(self, key, value, ttl=60 * 24 * 60 * 60):
        try:
            string_value = json.dumps(value)
            self.client.setex(key, ttl, string_value)
        except redis.RedisError as error:
            print(f'Error setting object for key "{key}" with TTL: {error}')
            raise error

    async def get_object(self, key):
        try:
            value = self.client.get(key)
            return json.loads(value)
        except redis.RedisError as error:
            print(f'Error getting object for key "{key}": {error}')
            raise error

cache_engine = CacheEngine()

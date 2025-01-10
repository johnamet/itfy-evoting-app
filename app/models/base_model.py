import bcrypt
from pymongo import MongoClient
from bson import ObjectId
from datetime import datetime

client = MongoClient('mongodb://localhost:27017/')
db = client['evoting_db']

class BaseModel:
    collection_name = 'base'

    def __init__(self, **kwargs):
        self.id = ObjectId()
        self.created_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()
        for key, value in kwargs.items():
            setattr(self, key, value)

    def save(self):
        collection = db[self.collection_name]
        collection.insert_one(self.to_dict())

    def update(self, data):
        collection = db[self.collection_name]
        self.updated_at = datetime.utcnow()
        if "password" in data:
            password = data["password"]
            data["password"] = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        collection.update_one({'id': self.id}, {'$set': data})

    @classmethod
    def delete(self, query):
        collection = db[self.collection_name]
        collection.delete_one(query)

    @classmethod
    def deleteMany(cls, query):
        collection = db[cls.collection_name]
        collection.delete_many(query)

    @classmethod
    def get(cls, query):
        collection = db[cls.collection_name]
        if "id" in query:
            query["id"] = ObjectId(query["id"])
        return collection.find_one(query)

    @classmethod
    def all(cls, query=None):
        collection = db[cls.collection_name]
        return collection.find(query or {})

    def to_dict(self):
        return self.__dict__

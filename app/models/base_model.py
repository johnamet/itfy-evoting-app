#!/usr/bin/env python
import os
import bcrypt
from pymongo import MongoClient
from bson import ObjectId
from datetime import datetime

HOST = os.getenv('DB_HOST', 'localhost')
PORT = int(os.getenv('DB_PORT', 27017))
DB_NAME = os.getenv('DB_NAME', 'evoting_db')
DB_USER = os.getenv('DB_USER', 'itfy-user')
DB_PASSWORD = os.getenv('DB_PASSWORD', 'itfy-password')
client = MongoClient(f'mongodb://{HOST}:{PORT}/')
db = client[DB_NAME]

class BaseModel:
    """
    BaseModel class provides a base for other models to inherit from, offering common functionality for database operations.

    Attributes:
        collection_name (str): The name of the collection in the database.

    Methods:
        __init__(**kwargs):
            Initializes a new instance of BaseModel with given keyword arguments.
            Automatically sets `id`, `created_at`, and `updated_at` attributes.

        save():
            Saves the current instance to the database.

        update(data):
            Updates the current instance in the database with the provided data.
            Automatically updates the `updated_at` attribute.
            Hashes the password if present in the data.

        delete(query):
            Class method that deletes a single document from the collection based on the query.

        deleteMany(query):
            Class method that deletes multiple documents from the collection based on the query.

        get(query):
            Class method that retrieves a single document from the collection based on the query.
            Converts `id` in the query to ObjectId if present.

        all(query=None):
            Class method that retrieves all documents from the collection based on the query.
            If no query is provided, retrieves all documents.

        to_dict():
            Converts the current instance to a dictionary.
    """
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

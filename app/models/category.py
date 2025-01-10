
from .base_model import Basemodel

class Category(Basemodel):
    collection = "categories"

    def __init__(self, name, description, thumbnail_uri="", event_id, **kwargs):
        super().__init__(**kwargs)
        self.name = name
        self.description = description
        self.thumbnail_uri = thumbnail_uri
        self.event_id = event_id
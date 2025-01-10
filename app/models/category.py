
from .base_model import BaseModel

class Category(BaseModel):
    collection = "categories"

    def __init__(self, name, description, event_id, thumbnail_uri="", **kwargs):
        super().__init__(**kwargs)
        self.name = name
        self.description = description
        self.thumbnail_uri = thumbnail_uri
        self.event_id = event_id
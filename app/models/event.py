
from .base_model import Basemodel

class Event(Basemodel):
    collection = "events"

    def __init__(self, name, description, start_date, end_date, **kwargs):
        super().__init__(**kwargs)
        self.name = name
        self.description = description
        self.start_date = start_date
        self.end_date = end_date
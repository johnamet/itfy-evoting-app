from .base_model import BaseModel

class Nomination(BaseModel):
    collection = "nominations"

    def __init__(self, candidate_id, event_id, category_id, **kwargs):
        super().__init__(**kwargs)
        self.candidate_id = candidate_id
        self.event_id = event_id
        self.category_id = category_id

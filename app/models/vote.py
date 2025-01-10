from models.base_model import BaseModel

class Vote(BaseModel):
    collection = "votes"

    def __init__(self, candidate_id, event_id, category_id, voter_ip, number_of_votes=1, **kwargs):
        super().__init__(**kwargs)
        self.candidate_id = candidate_id
        self.event_id = event_id
        self.category_id = category_id
        self.number_of_votes = number_of_votes
        self.voter_ip = voter_ip

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

class VoteBundle(BaseModel):
    collection = "vote_bundles"

    def __init__(
        self,
        name,
        category_id,
        price_per_vote,
        bundle_size=1,
        discount=0.0,
        promo_code=None,
        promo_discount=0.0,
        is_active=True,
        **kwargs
    ):
        super().__init__(**kwargs)
        self.name = name  # e.g., "Standard", "Promo Pack"
        self.category_id = category_id
        self.price_per_vote = price_per_vote
        self.bundle_size = bundle_size
        self.discount = discount  # e.g., 0.1 for 10% off
        self.promo_code = promo_code
        self.promo_discount = promo_discount  # e.g., 0.2 for 20% off with promo
        self.is_active = is_active

    def to_dict(self):
        return {
            "id": getattr(self, "id", None),
            "name": self.name,
            "category_id": self.category_id,
            "price_per_vote": self.price_per_vote,
            "bundle_size": self.bundle_size,
            "discount": self.discount,
            "promo_code": self.promo_code,
            "promo_discount": self.promo_discount,
            "is_active": self.is_active,
        }

    @classmethod
    def get_active_bundles_by_category(cls, category_id):
        # Returns all active bundles for a given category
        return cls.all({"category_id": category_id, "is_active": True})

    @classmethod
    def get_all_bundles_by_category(cls, category_id):
        return cls.all({"category_id": category_id})

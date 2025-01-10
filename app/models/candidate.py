from models.base_model import Basemodel
from utils.engine.CacheEngine import cacheEngine

class Candidate(Basemodel):
    collection = "candidates"

    def __init__(self, name, event_id, category_ids=None, **kwargs):
        if category_ids is None:
            category_ids = []
        super().__init__(**kwargs)
        self.name = name
        self.event_id = event_id
        self.category_ids = category_ids

    @classmethod
    async def create(cls, name, event_id, category_ids=None, **kwargs):
        if category_ids is None:
            category_ids = []
        voting_id = await cls.generate_unique_code(name)
        return cls(name, event_id, category_ids, voting_id=voting_id, **kwargs)

    @staticmethod
    async def generate_unique_code(candidate_name):
        if len(candidate_name) < 2:
            raise ValueError("Candidate's name must be at least two characters long")

        name_part = candidate_name[:2].upper()
        ascii_sum = sum(ord(char) for char in candidate_name)
        ascii_part = str(ascii_sum)[:3]
        random_part = str(random.randint(100, 999))

        unique_code = f"{name_part}{ascii_part}{random_part}"
        exists = await cacheEngine.get(unique_code)

        if exists:
            return await Candidate.generate_unique_code(candidate_name[::-1])

        await cacheEngine.set(unique_code, unique_code)
        return unique_code

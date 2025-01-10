from .base_model import BaseModel

class Role(BaseModel):
    collection_name = 'roles'

    def __init__(self, name, description, **kwargs):
        super().__init__(name=name, description=description, **kwargs)

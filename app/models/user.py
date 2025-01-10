from .base_model import BaseModel
from utils.password_generator import generate_strong_password
import bcrypt

class User(BaseModel):
    collection_name = 'users'
    default_password = generate_strong_password()


    def __init__(self, name, email, password=None, **kwargs):
        super().__init__(name=name, email=email, **kwargs)
        self.password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8') if password else self.default_password

    def verify_password(self, password):
        return bcrypt.checkpw(password.encode('utf-8'), self.password.encode('utf-8'))
    
    def get_default_password(self):
        return self.default_password

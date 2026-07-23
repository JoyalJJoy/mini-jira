from pydantic import BaseModel, ConfigDict

class UserCreate(BaseModel):
    email: str
    password: str
    display_name: str | None = None

class UserResponse(BaseModel):
    id: str
    email: str
    display_name: str | None = None
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class TokenData(BaseModel):
    user_id: str | None = None
    
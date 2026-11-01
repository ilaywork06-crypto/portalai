from pydantic import Field

from portal_kit.schemas import ApiModel


class PasswordLogin(ApiModel):
    username: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=1, max_length=200)


class SignInMethods(ApiModel):
    sso: bool


class Identity(ApiModel):
    user_id: str
    display_name: str
    role: str
    avatar_color: str
    org_node_id: str | None
    managed_node_ids: list[str]
    is_admin: bool

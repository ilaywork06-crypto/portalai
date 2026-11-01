from typing import Literal

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class ServiceSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    service_name: str
    environment: Literal["development", "test", "production"] = "development"
    log_level: str = "INFO"

    api_prefix: str = "/AI/api"
    database_url: str
    jwt_secret: SecretStr
    jwt_algorithm: str = "HS256"
    session_cookie: str = "portal_session"

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

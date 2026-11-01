from typing import Literal

from pydantic import SecretStr

from portal_kit.settings import ServiceSettings

type SsoMode = Literal["dev", "oidc", "off"]


class AuthSettings(ServiceSettings):
    service_name: str = "auth"
    session_ttl_hours: int = 12
    cookie_secure: bool = True
    cookie_path: str = "/AI"
    home_path: str = "/AI/marketplace"
    public_url: str = "http://localhost:8080"

    # dev: a stand-in IdP that signs in `sso_dev_username` · oidc: a real OpenID Connect IdP · off: passwords only
    sso_mode: SsoMode = "dev"
    sso_dev_username: str = "alon.cohen"
    allow_dev_identity_provider: bool = False

    oidc_issuer: str = ""
    oidc_client_id: str = ""
    oidc_client_secret: SecretStr = SecretStr("")
    oidc_internal_url: str = ""
    oidc_scopes: str = "openid profile email"
    oidc_username_claim: str = "preferred_username"

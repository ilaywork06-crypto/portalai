import secrets
from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class SignInAttempt:
    """One SSO round trip. `state` binds the callback to this browser, `nonce` binds the ID token to this attempt,
    and `verifier` is the PKCE secret that proves the code is redeemed by whoever started the flow."""

    return_path: str
    state: str
    nonce: str
    verifier: str

    @classmethod
    def begin(cls, return_path: str) -> "SignInAttempt":
        return cls(return_path, secrets.token_urlsafe(24), secrets.token_urlsafe(24), secrets.token_urlsafe(48))

    def answers(self, state: str) -> bool:
        return secrets.compare_digest(self.state, state)

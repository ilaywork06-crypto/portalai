from urllib.parse import urlsplit

from portal_auth.domain.errors import UnsafeRedirect


def safe_return_path(path: str | None, *, default: str, allowed_prefix: str = "/AI/") -> str:
    """Only same-site paths under the app are allowed after sign-in (no open redirects)."""
    if not path:
        return default
    parts = urlsplit(path)
    if parts.scheme or parts.netloc or not path.startswith(allowed_prefix) or path.startswith(f"{allowed_prefix}api/"):
        raise UnsafeRedirect()
    return path

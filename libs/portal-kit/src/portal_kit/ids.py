import secrets
import time
from collections.abc import Callable
from datetime import UTC, datetime

type Clock = Callable[[], datetime]


def utc_now() -> datetime:
    return datetime.now(UTC)


def new_id(prefix: str) -> str:
    """Short, time-ordered id: `<prefix>_<ms timestamp base36><random>`."""
    millis = int(time.time() * 1000)
    stamp = ""
    while millis:
        millis, digit = divmod(millis, 36)
        stamp = "0123456789abcdefghijklmnopqrstuvwxyz"[digit] + stamp
    return f"{prefix}_{stamp}{secrets.token_hex(4)}"

from collections.abc import Iterable
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Protocol

from portal_community.domain.model import Post


class PostRepository(Protocol):
    async def get(self, post_id: str) -> Post | None: ...

    async def list(self) -> list[Post]:
        """Newest first, replies included."""
        ...

    async def add(self, post: Post) -> None: ...
    async def update(self, post: Post) -> None: ...
    async def delete(self, post_id: str) -> None: ...
    async def adjust_counters(self, post_id: str, *, helpful: int = 0, reposts: int = 0) -> tuple[int, int]: ...


class HelpfulMarks(Protocol):
    async def marked_among(self, user_id: str, post_ids: Iterable[str]) -> set[str]: ...
    async def mark(self, post_id: str, user_id: str, at: datetime) -> bool: ...
    async def unmark(self, post_id: str, user_id: str) -> bool: ...
    async def forget_post(self, post_id: str) -> None: ...


@dataclass(frozen=True, slots=True)
class StoredFile:
    id: str
    name: str
    content_type: str
    size: int
    owner_id: str


class FileStorage(Protocol):
    async def save(self, *, owner_id: str, name: str, content_type: str, data: bytes) -> StoredFile: ...
    async def locate(self, file_id: str) -> tuple[StoredFile, Path] | None: ...

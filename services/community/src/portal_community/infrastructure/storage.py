import asyncio
import json
import re
import secrets
from pathlib import Path

from portal_community.domain.ports import StoredFile

_SAFE_ID = re.compile(r"^[a-f0-9]{32}$")


class LocalFileStorage:
    """Stores uploads on a volume: `<id>` holds the bytes, `<id>.json` the metadata."""

    def __init__(self, root: Path) -> None:
        self._root = root

    async def save(self, *, owner_id: str, name: str, content_type: str, data: bytes) -> StoredFile:
        stored = StoredFile(
            id=secrets.token_hex(16),
            name=Path(name).name or "file",
            content_type=content_type or "application/octet-stream",
            size=len(data),
            owner_id=owner_id,
        )
        await asyncio.to_thread(self._write, stored, data)
        return stored

    async def locate(self, file_id: str) -> tuple[StoredFile, Path] | None:
        if not _SAFE_ID.match(file_id):
            return None
        blob, meta = self._root / file_id, self._root / f"{file_id}.json"
        if not blob.is_file() or not meta.is_file():
            return None
        return StoredFile(**json.loads(meta.read_text(encoding="utf-8"))), blob

    def _write(self, stored: StoredFile, data: bytes) -> None:
        self._root.mkdir(parents=True, exist_ok=True)
        (self._root / stored.id).write_bytes(data)
        meta = {
            "id": stored.id,
            "name": stored.name,
            "content_type": stored.content_type,
            "size": stored.size,
            "owner_id": stored.owner_id,
        }
        (self._root / f"{stored.id}.json").write_text(json.dumps(meta, ensure_ascii=False), encoding="utf-8")

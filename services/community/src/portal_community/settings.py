from pathlib import Path

from portal_kit.settings import ServiceSettings


class CommunitySettings(ServiceSettings):
    service_name: str = "community"
    uploads_dir: Path = Path("/data/uploads")
    max_upload_bytes: int = 10 * 1024 * 1024

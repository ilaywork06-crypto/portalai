from pathlib import Path

from portal_kit.settings import ServiceSettings


class UsageSettings(ServiceSettings):
    service_name: str = "usage"
    usage_config_path: Path | None = None
    dataset_ttl_seconds: int = 300

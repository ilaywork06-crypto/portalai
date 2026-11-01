from fastapi import FastAPI

from portal_kit.app import StartupHook, create_service_app
from portal_usage.api.router import router
from portal_usage.application.service import EngineCache
from portal_usage.infrastructure.config import load_config
from portal_usage.infrastructure.dataset import SqlDatasetSource
from portal_usage.settings import UsageSettings


def create_app(settings: UsageSettings | None = None, *, startup: tuple[StartupHook, ...] = ()) -> FastAPI:
    settings = settings or UsageSettings()

    async def wire(app: FastAPI) -> None:
        config = load_config(settings.usage_config_path)
        source = SqlDatasetSource(app.state.db.sessions, retention_days=config.retention_days)
        app.state.engines = EngineCache(source, config, ttl=settings.dataset_ttl_seconds)

    return create_service_app(settings, title="Portal AI · Usage", routers=[router], startup=(*startup, wire))

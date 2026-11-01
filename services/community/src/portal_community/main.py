from fastapi import FastAPI

from portal_community.api.router import posts, uploads
from portal_community.infrastructure.storage import LocalFileStorage
from portal_community.settings import CommunitySettings
from portal_kit.app import StartupHook, create_service_app


def create_app(settings: CommunitySettings | None = None, *, startup: tuple[StartupHook, ...] = ()) -> FastAPI:
    settings = settings or CommunitySettings()

    async def wire(app: FastAPI) -> None:
        app.state.files = LocalFileStorage(settings.uploads_dir)

    return create_service_app(
        settings, title="Portal AI · Community", routers=[posts, uploads], startup=(wire, *startup)
    )

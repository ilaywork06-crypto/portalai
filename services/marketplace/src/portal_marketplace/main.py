from fastapi import FastAPI

from portal_kit.app import StartupHook, create_service_app
from portal_marketplace.api.router import router
from portal_marketplace.settings import MarketplaceSettings


def create_app(settings: MarketplaceSettings | None = None, *, startup: tuple[StartupHook, ...] = ()) -> FastAPI:
    settings = settings or MarketplaceSettings()

    return create_service_app(settings, title="Portal AI · Marketplace", routers=[router], startup=startup)

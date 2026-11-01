from collections.abc import AsyncIterator, Awaitable, Callable, Sequence
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI, Request
from fastapi.responses import JSONResponse

from portal_kit.auth import TokenCodec
from portal_kit.db import Database
from portal_kit.errors import install_error_handlers
from portal_kit.observability import configure_logging, install_request_logging
from portal_kit.settings import ServiceSettings

type StartupHook = Callable[[FastAPI], Awaitable[None]]

health = APIRouter(tags=["health"])


@health.get("/healthz", include_in_schema=False)
async def liveness() -> dict[str, str]:
    return {"status": "ok"}


@health.get("/readyz", include_in_schema=False)
async def readiness(request: Request) -> JSONResponse:
    ready = await request.app.state.db.ping()
    return JSONResponse({"status": "ready" if ready else "unavailable"}, status_code=200 if ready else 503)


def create_service_app(
    settings: ServiceSettings,
    *,
    title: str,
    routers: Sequence[APIRouter],
    startup: Sequence[StartupHook] = (),
    shutdown: Sequence[StartupHook] = (),
) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        configure_logging(settings.log_level, json_logs=settings.is_production)
        app.state.settings = settings
        app.state.db = Database(settings.database_url)
        app.state.token_codec = TokenCodec(settings.jwt_secret.get_secret_value(), algorithm=settings.jwt_algorithm)
        for hook in startup:
            await hook(app)
        yield
        for hook in shutdown:
            await hook(app)
        await app.state.db.dispose()

    docs_root = f"{settings.api_prefix}/docs/{settings.service_name}"
    app = FastAPI(
        title=title,
        version="1.0.0",
        lifespan=lifespan,
        docs_url=docs_root,
        openapi_url=f"{docs_root}/openapi.json",
        redoc_url=None,
    )
    install_error_handlers(app)
    install_request_logging(app)
    app.include_router(health)
    for router in routers:
        app.include_router(router, prefix=settings.api_prefix)
    return app

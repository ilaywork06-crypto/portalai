# syntax=docker/dockerfile:1.7
# One image recipe for every Python service in the uv workspace.
#   docker build -f deploy/docker/service.Dockerfile --build-arg SERVICE=community --build-arg PACKAGE=community-service .

ARG PYTHON_IMAGE=python:3.13-slim-bookworm

FROM ghcr.io/astral-sh/uv:0.11 AS uv

FROM ${PYTHON_IMAGE} AS base
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    UV_PROJECT_ENVIRONMENT=/opt/venv
COPY --from=uv /uv /usr/local/bin/uv
WORKDIR /app

# Workspace manifests only, so dependency layers survive source changes.
FROM base AS manifests
COPY pyproject.toml uv.lock ./
COPY libs/portal-kit/pyproject.toml libs/portal-kit/
COPY services/auth/pyproject.toml services/auth/
COPY services/marketplace/pyproject.toml services/marketplace/
COPY services/community/pyproject.toml services/community/
COPY services/usage/pyproject.toml services/usage/

FROM manifests AS dependencies
ARG PACKAGE
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --no-install-workspace --package "${PACKAGE}"

# Development: editable install; compose mounts the sources and uvicorn reloads on change.
FROM dependencies AS dev
ARG PACKAGE
ARG SERVICE
COPY libs libs
COPY services services
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --package "${PACKAGE}"
COPY deploy/docker/entrypoint.sh /usr/local/bin/entrypoint
ENV PATH=/opt/venv/bin:$PATH \
    SERVICE=${SERVICE} \
    APP_MODULE=portal_${SERVICE}.main:create_app \
    RUN_MIGRATIONS=true
WORKDIR /app/services/${SERVICE}
EXPOSE 8000
ENTRYPOINT ["entrypoint"]
CMD ["uvicorn", "--factory", "--host", "0.0.0.0", "--port", "8000", "--reload", "--reload-dir", "/app"]

FROM dependencies AS build
ARG PACKAGE
COPY libs libs
COPY services services
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --no-editable --package "${PACKAGE}"

FROM ${PYTHON_IMAGE} AS runtime
ARG SERVICE
RUN useradd --system --uid 10001 --home-dir /srv portal
COPY --from=build /opt/venv /opt/venv
COPY --chown=portal services/${SERVICE}/alembic.ini /srv/alembic.ini
COPY --chown=portal services/${SERVICE}/migrations /srv/migrations
COPY deploy/docker/entrypoint.sh /usr/local/bin/entrypoint
ENV PATH=/opt/venv/bin:$PATH \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    SERVICE=${SERVICE} \
    APP_MODULE=portal_${SERVICE}.main:create_app \
    ENVIRONMENT=production
WORKDIR /srv
USER portal
EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
    CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/readyz', timeout=2)"]
ENTRYPOINT ["entrypoint"]
CMD ["uvicorn", "--factory", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*", "--workers", "2"]

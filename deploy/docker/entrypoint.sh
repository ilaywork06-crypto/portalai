#!/bin/sh
set -eu

if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
    alembic upgrade head
fi

if [ "${SEED_DEMO_DATA:-false}" = "true" ]; then
    python -m "portal_${SERVICE}.cli" seed
fi

# The app factory (module:create_app) is appended to the uvicorn command.
exec "$@" "${APP_MODULE}"

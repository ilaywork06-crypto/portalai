from typing import ClassVar

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class ServiceError(Exception):
    status_code: ClassVar[int] = 400
    code: ClassVar[str] = "bad_request"
    default_message: ClassVar[str] = "The request could not be processed."

    def __init__(self, message: str | None = None, *, code: str | None = None) -> None:
        self.message = message or self.default_message
        self.error_code = code or self.code
        super().__init__(self.message)


class InvalidInput(ServiceError):
    status_code = 422
    code = "invalid_input"
    default_message = "The request contains invalid data."


class Unauthorized(ServiceError):
    status_code = 401
    code = "unauthorized"
    default_message = "Authentication is required."


class Forbidden(ServiceError):
    status_code = 403
    code = "forbidden"
    default_message = "You are not allowed to perform this action."


class NotFound(ServiceError):
    status_code = 404
    code = "not_found"
    default_message = "The requested resource was not found."


class Conflict(ServiceError):
    status_code = 409
    code = "conflict"
    default_message = "The request conflicts with the current state."


def _error_body(code: str, message: str, details: object | None = None) -> dict[str, object]:
    error: dict[str, object] = {"code": code, "message": message}
    if details is not None:
        error["details"] = details
    return {"error": error}


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ServiceError)
    async def handle_service_error(_: Request, exc: ServiceError) -> JSONResponse:
        return JSONResponse(_error_body(exc.error_code, exc.message), status_code=exc.status_code)

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        details = [{"loc": list(e["loc"]), "msg": e["msg"]} for e in exc.errors()]
        return JSONResponse(_error_body(InvalidInput.code, InvalidInput.default_message, details), status_code=422)

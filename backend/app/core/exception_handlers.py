from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.core.exceptions import AppException


def register_exception_handlers(app: FastAPI) -> None:

    @app.exception_handler(AppException)
    async def app_exception_handler(
        request: Request,
        exc: AppException,
    ) -> JSONResponse:
        print(
            f"[app-error] {exc.status_code} "
            f"{request.method} {request.url.path}: "
            f"{exc.message}",
            flush=True,
        )

        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.message},
        )

    @app.exception_handler(RequestValidationError)
    async def request_validation_handler(
        request: Request,
        exc: RequestValidationError,
    ) -> JSONResponse:

        errors = [
            {
                "loc": list(error.get("loc", [])),
                "type": error.get("type"),
                "msg": error.get("msg"),
            }
            for error in exc.errors()
        ]

        if request.url.path == "/sync/push":
            print(
                "[sync-push-422] Validation errors:",
                errors,
                flush=True,
            )

        return JSONResponse(
            status_code=422,
            content={"detail": errors},
        )
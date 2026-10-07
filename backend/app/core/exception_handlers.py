from fastapi import FastAPI, Request
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
            content={
                "detail": exc.message,
            },
        )
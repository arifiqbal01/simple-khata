
import json

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

            # Log only quantities associated with precision errors.
            # Do not log the full request or customer information.
            try:
                body = json.loads(await request.body())
                operations = body.get("operations", [])

                failed_indexes = set()

                for error in errors:
                    loc = error["loc"]

                    if (
                        error["type"] == "decimal_max_digits"
                        and len(loc) >= 3
                        and loc[0] == "body"
                        and loc[1] == "operations"
                        and type(loc[2]) is int
                    ):
                        failed_indexes.add(loc[2])

                for index in sorted(failed_indexes):
                    if index >= len(operations):
                        continue

                    operation = operations[index]

                    if not isinstance(operation, dict):
                        continue

                    if operation.get("operationType") != "LEDGER_ENTRY_CREATE":
                        continue

                    payload = operation.get("payload", {})
                    if not isinstance(payload, dict):
                        continue

                    items = payload.get("items", [])
                    if not isinstance(items, list):
                        continue

                    for item_index, item in enumerate(items):
                        if not isinstance(item, dict):
                            continue

                        quantity = item.get("quantity")

                        print(
                            "[sync-push-422] "
                            f"operation_index={index} "
                            f"item_index={item_index} "
                            f"quantity={quantity!r} "
                            f"quantity_type={type(quantity).__name__}",
                            flush=True,
                        )

            except (ValueError, TypeError, AttributeError, KeyError) as error:
                print(
                    "[sync-push-422] Quantity diagnostic failed:",
                    type(error).__name__,
                    flush=True,
                )

        return JSONResponse(
            status_code=422,
            content={"detail": errors},
        )

from fastapi import APIRouter

from app.api.routes.bootstrap import router as bootstrap_router
from app.api.routes.customers import router as customers_router
from app.api.routes.health import router as health_router
from app.api.routes.items import router as items_router
from app.api.routes.ledger_entries import router as ledger_entries_router

api_router = APIRouter()

api_router.include_router(
    health_router,
    tags=["Health"],
)

api_router.include_router(
    bootstrap_router,
    tags=["Bootstrap"],
)

api_router.include_router(
    customers_router,
    tags=["Customers"],
)

api_router.include_router(
    items_router,
    tags=["Items"],
)

api_router.include_router(
    ledger_entries_router,
    tags=["Ledger"],
)
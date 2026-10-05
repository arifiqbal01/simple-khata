from fastapi import APIRouter

from app.api.routes.bootstrap import router as bootstrap_router
from app.api.routes.customers import router as customers_router
from app.api.routes.health import router as health_router

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
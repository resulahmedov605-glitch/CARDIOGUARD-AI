from fastapi import APIRouter

from app.api.v1.health import router as health_router
from app.api.v1.ecg import router as ecg_router
from app.api.v1.analysis import router as analysis_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(ecg_router)
api_router.include_router(analysis_router)

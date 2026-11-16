"""Application entry point and composition root."""

import math
from typing import Any

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.routes import router
from app.dataset import ECGError


def safe_validation_detail(value: Any) -> Any:
    """Keep invalid NaN/Infinity inputs representable in a valid JSON error."""
    if isinstance(value, float) and not math.isfinite(value):
        return str(value)
    if isinstance(value, dict):
        return {key: safe_validation_detail(item) for key, item in value.items()}
    if isinstance(value, list):
        return [safe_validation_detail(item) for item in value]
    return value


def create_app() -> FastAPI:
    application = FastAPI(
        title="CARDIOGUARD AI API",
        description="Local-first educational heart intelligence workspace.",
        version="0.1.0",
        # Interactive API docs normally load CDN assets. Keep runtime local-only;
        # the machine-readable API contract remains available at /openapi.json.
        docs_url=None,
        redoc_url=None,
    )
    application.include_router(router, prefix="/api/v1")

    @application.exception_handler(ECGError)
    async def handle_ecg_error(_request: Request, exc: ECGError) -> JSONResponse:
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.message})

    @application.exception_handler(RequestValidationError)
    async def handle_validation_error(_request: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse(status_code=422, content={"detail": safe_validation_detail(jsonable_encoder(exc.errors()))})

    return application


app = create_app()

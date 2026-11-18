"""The ECG and AI HTTP endpoints used by the frontend."""

from typing import Annotated
from pathlib import Path

from fastapi import APIRouter, Depends, Query

from app.analysis import analyze
from app.dataset import ECGService, MAX_DURATION_SECONDS, get_ecg_service
from app.ml import classify, get_model_directory, model_status
from app.schemas import (
    AnalysisRequest, AnalysisResponse, ECGRecordMetadata,
    ECGRecordsResponse, ECGSignalResponse, HealthResponse,
    ErrorResponse, ModelStatus, PredictionRequest, PredictionResponse,
)

router = APIRouter(responses={
    404: {"model": ErrorResponse, "description": "Unknown ECG record"},
    422: {"model": ErrorResponse, "description": "Invalid parameters or unsupported signal"},
    503: {"model": ErrorResponse, "description": "Local dataset or model unavailable"},
    500: {"model": ErrorResponse, "description": "Unexpected local processing failure"},
})
Service = Annotated[ECGService, Depends(get_ecg_service)]


@router.get("/health", response_model=HealthResponse, tags=["health"])
def get_health() -> HealthResponse:
    return HealthResponse(status="ok")


@router.get("/ecg/records", response_model=ECGRecordsResponse, tags=["ecg"])
def list_records(service: Service) -> ECGRecordsResponse:
    return service.available_records()


@router.get("/ecg/records/{record_id}", response_model=ECGRecordMetadata, tags=["ecg"])
def get_metadata(record_id: str, service: Service) -> ECGRecordMetadata:
    return service.metadata(record_id)


@router.get("/ecg/records/{record_id}/signal", response_model=ECGSignalResponse, tags=["ecg"])
def get_signal(
    record_id: str,
    service: Service,
    channel: Annotated[int, Query(ge=0)] = 0,
    start_seconds: Annotated[float, Query(ge=0, allow_inf_nan=False)] = 0,
    duration_seconds: Annotated[float, Query(gt=0, le=MAX_DURATION_SECONDS, allow_inf_nan=False)] = 10,
) -> ECGSignalResponse:
    return service.signal(record_id, channel, start_seconds, duration_seconds)


@router.post("/ecg/analyze", response_model=AnalysisResponse, tags=["ecg"],
             summary="Filter ECG, detect peaks and calculate BPM/RR, optionally classify the same peaks")
def analyze_ecg(request: AnalysisRequest, service: Service,
                directory: Annotated[Path, Depends(get_model_directory)]) -> AnalysisResponse:
    return analyze(request, service, directory)


@router.get("/ai/model", response_model=ModelStatus, tags=["ai"])
def get_model_status(directory: Annotated[Path, Depends(get_model_directory)]):
    return model_status(directory)


@router.post("/ai/predict", response_model=PredictionResponse, tags=["ai"])
def predict_beats(request: PredictionRequest, service: Service,
                  directory: Annotated[Path, Depends(get_model_directory)]):
    return classify(request, service, directory)

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.schemas.ecg import ECGRecordMetadata, ECGRecordsResponse, ECGSignalResponse
from app.services.ecg import ECGService, MAX_DURATION_SECONDS, get_ecg_service

router = APIRouter(prefix="/ecg/records", tags=["ecg"])
Service = Annotated[ECGService, Depends(get_ecg_service)]


@router.get("", response_model=ECGRecordsResponse)
def list_records(service: Service) -> ECGRecordsResponse:
    return service.available_records()


@router.get("/{record_id}", response_model=ECGRecordMetadata)
def get_metadata(record_id: str, service: Service) -> ECGRecordMetadata:
    return service.metadata(record_id)


@router.get("/{record_id}/signal", response_model=ECGSignalResponse)
def get_signal(
    record_id: str,
    service: Service,
    channel: Annotated[int, Query(ge=0)] = 0,
    start_seconds: Annotated[float, Query(ge=0, allow_inf_nan=False)] = 0,
    duration_seconds: Annotated[float, Query(gt=0, le=MAX_DURATION_SECONDS, allow_inf_nan=False)] = 10,
) -> ECGSignalResponse:
    return service.signal(record_id, channel, start_seconds, duration_seconds)

from typing import Annotated

from fastapi import APIRouter, Depends

from app.schemas.analysis import AnalysisRequest, AnalysisResponse
from app.services.analysis import analyze
from app.services.ecg import ECGService, get_ecg_service

router = APIRouter(prefix="/ecg", tags=["ecg"])


@router.post("/analyze", response_model=AnalysisResponse)
def analyze_ecg(request: AnalysisRequest, service: Annotated[ECGService, Depends(get_ecg_service)]) -> AnalysisResponse:
    return analyze(request, service)

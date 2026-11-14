from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.ecg import ECGRecordMetadata, ECGSignalResponse


class StrictParameters(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class PreprocessingParameters(StrictParameters):
    highpass_hz: float | None = Field(default=.5, ge=.05, le=10)
    lowpass_hz: float | None = Field(default=40., ge=10, le=150)
    order: int = Field(default=3, ge=1, le=6, strict=True)
    normalization: Literal["none", "zscore"] = "none"


class DetectionParameters(StrictParameters):
    refractory_seconds: float = Field(default=.25, ge=.2, le=1.)
    integration_seconds: float = Field(default=.12, ge=.04, le=.2)
    threshold_scale: float = Field(default=.35, ge=.05, le=2.)
    refinement_seconds: float = Field(default=.10, ge=.02, le=.15)


class AnalysisRequest(StrictParameters):
    record_id: str = Field(min_length=1, max_length=16)
    channel: int = Field(default=0, ge=0, strict=True)
    start_seconds: float = Field(default=0, ge=0)
    duration_seconds: float = Field(default=10, ge=.5, le=30)
    preprocessing: PreprocessingParameters = Field(default_factory=PreprocessingParameters)
    detection: DetectionParameters = Field(default_factory=DetectionParameters)
    reference_tolerance_seconds: float = Field(default=.1, ge=.01, le=.2)


class DetectedPeak(BaseModel):
    interval_sample_index: int
    record_sample_index: int
    timestamp_seconds: float
    filtered_amplitude: float


class HeartRateStatistics(BaseModel):
    rr_seconds: list[float]
    rr_milliseconds: list[float]
    instantaneous_bpm: list[float]
    peak_count: int
    valid_interval_count: int
    average_bpm: float | None
    mean_rr_seconds: float | None
    min_rr_seconds: float | None
    max_rr_seconds: float | None
    std_rr_seconds: float | None


class ReferenceComparison(BaseModel):
    source: str = "MIT-BIH reference beat annotations (.atr); not algorithm output"
    reference_sample_indices: list[int]
    reference_timestamps_seconds: list[float]
    reference_count: int
    true_positives: int
    false_positives: int
    false_negatives: int
    sensitivity: float | None
    positive_predictivity: float | None
    mean_absolute_error_seconds: float | None
    tolerance_seconds: float


class NormalizedSignal(BaseModel):
    method: Literal["zscore"] = "zscore"
    units: Literal["dimensionless"] = "dimensionless"
    offset: float
    scale: float
    amplitudes: list[float]


class AnalysisResponse(BaseModel):
    record: ECGRecordMetadata
    parameters: AnalysisRequest
    original_signal: ECGSignalResponse
    filtered_amplitudes: list[float]
    normalized_signal: NormalizedSignal | None
    detected_peaks: list[DetectedPeak]
    statistics: HeartRateStatistics
    reference_comparison: ReferenceComparison | None
    warnings: list[str]

from pydantic import BaseModel


class ECGChannel(BaseModel):
    index: int
    name: str
    units: str | None


class ECGRecordMetadata(BaseModel):
    record_id: str
    source: str = "MIT-BIH Arrhythmia Database"
    sampling_frequency_hz: float
    number_of_channels: int
    channels: list[ECGChannel]
    sample_count: int
    duration_seconds: float


class UnavailableRecord(BaseModel):
    record_id: str
    reason: str


class ECGRecordsResponse(BaseModel):
    records: list[ECGRecordMetadata]
    unavailable_records: list[UnavailableRecord]


class ECGSignalResponse(BaseModel):
    record_id: str
    channel: ECGChannel
    sampling_frequency_hz: float
    requested_start_seconds: float
    requested_duration_seconds: float
    start_sample: int
    end_sample_exclusive: int
    start_seconds: float
    duration_seconds: float
    sample_count: int
    timestamps_seconds: list[float]
    amplitudes: list[float | None]

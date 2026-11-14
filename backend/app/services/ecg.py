"""Bounded, local-only WFDB reads. HTTP requests never download data."""

import math
from pathlib import Path

import numpy as np
import wfdb
from wfdb.io.header import HeaderSyntaxError

from app.schemas.ecg import (
    ECGChannel, ECGRecordMetadata, ECGRecordsResponse, ECGSignalResponse,
    UnavailableRecord,
)

DATA_DIRECTORY = Path(__file__).resolve().parents[3] / "data" / "mitbih"
# Explicit registry, not filenames supplied by a client. Add reviewed records here.
KNOWN_RECORDS = {"100": ("100.dat",)}
MAX_DURATION_SECONDS = 30
DOWNLOAD_HINT = "Run 'python -m scripts.download_mitbih' from backend/."


def sample_ceiling(seconds: float, fs: float) -> int:
    """Ceil onto the sample grid, absorbing only floating-point round-off.

    Decimal boundaries such as 0.55 * 360 can land a few ULPs above an
    integer. A fixed time epsilon would also move genuine off-grid requests;
    use a tolerance proportional to the representable precision instead.
    """
    position = seconds * fs
    nearest = round(position)
    tolerance = 8 * max(math.ulp(position), math.ulp(seconds) * fs)
    return nearest if abs(position - nearest) <= tolerance else math.ceil(position)


class ECGError(Exception):
    def __init__(self, status_code: int, message: str) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.message = message


class ECGService:
    def __init__(self, data_directory: Path = DATA_DIRECTORY) -> None:
        if data_directory.absolute() != data_directory.resolve():
            raise ECGError(503, "The dataset directory must not contain symlinks.")
        self.data_directory = data_directory.resolve()

    def _path(self, record_id: str) -> Path:
        if record_id not in KNOWN_RECORDS:
            raise ECGError(404, "Unknown ECG record. Only registered records are accessible.")
        return self.data_directory / record_id

    def _header(self, record_id: str) -> wfdb.Record:
        base = self._path(record_id)
        for name in (f"{record_id}.hea", *KNOWN_RECORDS[record_id]):
            path = self.data_directory / name
            if path.is_symlink() or path.resolve().parent != self.data_directory:
                raise ECGError(503, "Dataset files must be regular files inside the data directory.")
            if not path.is_file():
                raise ECGError(503, f"Local dataset for record {record_id} is missing. {DOWNLOAD_HINT}")
        try:
            header = wfdb.rdheader(str(base))
            if not isinstance(header, wfdb.Record):
                raise ValueError("Multi-segment records are not supported")
            # Reject references to any other file, path or URI before waveform IO.
            if set(header.file_name) != set(KNOWN_RECORDS[record_id]):
                raise ValueError("Unexpected signal file reference")
            if (
                header.record_name != record_id or header.n_sig <= 0
                or not math.isfinite(header.fs) or not 0 < header.fs <= 10_000
                or header.sig_len <= 0 or len(header.sig_name) != header.n_sig
                or len(header.units) != header.n_sig
                or any(not math.isfinite(gain) or gain <= 0 for gain in header.adc_gain)
                or any(fmt != "212" for fmt in header.fmt)
                or any(value != 1 for value in header.samps_per_frame)
                or any(value not in (None, 0) for value in header.byte_offset)
            ):
                raise ValueError("Unsupported or invalid MIT-BIH header")
            # MIT-BIH format 212 packs two 12-bit values into three bytes.
            expected_bytes = math.ceil(header.sig_len * header.n_sig / 2) * 3
            if (self.data_directory / header.file_name[0]).stat().st_size != expected_bytes:
                raise ValueError("Truncated or inconsistent signal file")
            return header
        except (OSError, ValueError, TypeError, AttributeError, IndexError, OverflowError, HeaderSyntaxError) as exc:
            raise ECGError(503, f"Local record {record_id} is corrupted or unsupported. {DOWNLOAD_HINT}") from exc

    def metadata(self, record_id: str) -> ECGRecordMetadata:
        header = self._header(record_id)
        return ECGRecordMetadata(
            record_id=record_id,
            sampling_frequency_hz=header.fs,
            number_of_channels=header.n_sig,
            channels=[ECGChannel(index=i, name=name, units=header.units[i])
                      for i, name in enumerate(header.sig_name)],
            sample_count=header.sig_len,
            duration_seconds=header.sig_len / header.fs,
        )

    def available_records(self) -> ECGRecordsResponse:
        records, unavailable = [], []
        for record_id in KNOWN_RECORDS:
            try:
                records.append(self.metadata(record_id))
            except ECGError as exc:
                unavailable.append(UnavailableRecord(record_id=record_id, reason=exc.message))
        return ECGRecordsResponse(records=records, unavailable_records=unavailable)

    def reference_beats(self, record_id: str, start: int, end: int) -> list[int] | None:
        """Optional local annotations, kept separate from detected peaks."""
        base = self._path(record_id)
        path = base.with_suffix(".atr")
        if path.is_symlink() or path.resolve().parent != self.data_directory:
            raise ECGError(503, "Unsafe reference annotation path.")
        if not path.is_file():
            return None
        try:
            annotations = wfdb.rdann(str(base), "atr", sampfrom=start, sampto=end - 1)
            beats = set("NLRBAaJSVrFejnE/fQ?")
            samples = [int(sample) for sample, symbol in zip(annotations.sample, annotations.symbol, strict=True)
                       if symbol in beats and start <= sample < end]
            if samples != sorted(set(samples)):
                raise ValueError("Unordered reference annotations")
            return samples
        except (OSError, ValueError, TypeError, IndexError, EOFError) as exc:
            raise ECGError(503, "Local reference annotations could not be read.") from exc

    def signal(self, record_id: str, channel: int, start_seconds: float,
               duration_seconds: float) -> ECGSignalResponse:
        metadata = self.metadata(record_id)
        if channel < 0 or channel >= metadata.number_of_channels:
            raise ECGError(422, "Channel index is outside the available channels.")
        if (not math.isfinite(start_seconds) or not math.isfinite(duration_seconds)
                or start_seconds < 0 or not 0 < duration_seconds <= MAX_DURATION_SECONDS):
            raise ECGError(422, "Start must be nonnegative; duration must be greater than 0 and at most 30 seconds.")
        end_seconds = start_seconds + duration_seconds
        if end_seconds > metadata.duration_seconds and not math.isclose(
            end_seconds, metadata.duration_seconds, rel_tol=0,
            abs_tol=8 * math.ulp(metadata.duration_seconds),
        ):
            raise ECGError(422, "The requested interval extends beyond the end of the record.")
        fs = metadata.sampling_frequency_hz
        start = sample_ceiling(start_seconds, fs)
        end = min(sample_ceiling(end_seconds, fs), metadata.sample_count)
        if start >= end:
            raise ECGError(422, "The selected interval contains no samples at this sampling frequency.")
        try:
            record = wfdb.rdrecord(str(self._path(record_id)), sampfrom=start,
                                   sampto=end, channels=[channel], physical=True)
            values = record.p_signal[:, 0]
            if len(values) != end - start or np.isinf(values).any():
                raise ValueError("Invalid waveform samples")
        except (OSError, ValueError, TypeError, AttributeError, IndexError, OverflowError, HeaderSyntaxError) as exc:
            raise ECGError(503, "The local ECG signal could not be read. Re-download the record.") from exc
        return ECGSignalResponse(
            record_id=record_id, channel=metadata.channels[channel], sampling_frequency_hz=fs,
            requested_start_seconds=start_seconds, requested_duration_seconds=duration_seconds,
            start_sample=start, end_sample_exclusive=end, start_seconds=start / fs,
            duration_seconds=(end - start) / fs, sample_count=end - start,
            timestamps_seconds=(np.arange(start, end) / fs).tolist(),
            # WFDB missing physical samples are NaN. Preserve them as gaps, not zeroes.
            amplitudes=[None if np.isnan(value) else float(value) for value in values],
        )


def get_ecg_service() -> ECGService:
    return ECGService()

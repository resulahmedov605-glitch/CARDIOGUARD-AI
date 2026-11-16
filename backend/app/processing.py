"""ECG filtering, peak detection, normalization and RR/BPM calculations."""

from dataclasses import dataclass
import math

import numpy as np
from numpy.typing import ArrayLike, NDArray
from scipy.signal import butter, find_peaks, sosfiltfilt


@dataclass(frozen=True)
class FilterConfig:
    highpass_hz: float | None = 0.5
    lowpass_hz: float | None = 40.0
    order: int = 3


@dataclass(frozen=True)
class DetectionConfig:
    refractory_seconds: float = 0.25
    integration_seconds: float = 0.12
    threshold_scale: float = 0.35
    refinement_seconds: float = 0.10


def validate_signal(values: ArrayLike, fs: float) -> NDArray[np.float64]:
    if not math.isfinite(fs) or not 50 <= fs <= 10_000:
        raise ValueError("Sampling frequency must be finite and between 50 and 10000 Hz.")
    signal = np.asarray(values, dtype=np.float64)
    if signal.ndim != 1 or signal.size == 0 or not np.isfinite(signal).all():
        raise ValueError("Signal must be a nonempty, one-dimensional array of finite samples; gaps cannot be analyzed.")
    return signal.copy()


def zero_phase(signal: NDArray[np.float64], sos: NDArray[np.float64]) -> NDArray[np.float64]:
    # SciPy's documented default padding length. Never silently shorten padding.
    padlen = 3 * (2 * len(sos) + 1 - min((sos[:, 2] == 0).sum(), (sos[:, 5] == 0).sum()))
    if signal.size <= padlen + 1:
        raise ValueError(f"Signal is too short for zero-phase filtering; need at least {padlen + 2} samples.")
    output = sosfiltfilt(sos, signal)
    if not np.isfinite(output).all():
        raise ValueError("Filter produced non-finite values. Check parameters and signal scale.")
    return output


def preprocess(values: ArrayLike, fs: float, config: FilterConfig = FilterConfig()) -> NDArray[np.float64]:
    signal = validate_signal(values, fs)
    if isinstance(config.order, bool) or not isinstance(config.order, int) or not 1 <= config.order <= 6:
        raise ValueError("Filter order must be an integer between 1 and 6.")
    high, low = config.highpass_hz, config.lowpass_hz
    for cutoff in (high, low):
        if cutoff is not None and (not math.isfinite(cutoff) or not 0 < cutoff < fs / 2):
            raise ValueError("Filter cutoffs must be positive, finite, and below Nyquist (fs/2).")
    if high is not None and low is not None and high >= low:
        raise ValueError("High-pass cutoff must be below the low-pass cutoff.")
    if high is None and low is None:
        return signal
    if high is not None and low is not None:
        cutoff, kind = [high, low], "bandpass"
    elif high is not None:
        cutoff, kind = high, "highpass"
    else:
        cutoff, kind = low, "lowpass"
    coefficients = butter(config.order, cutoff, btype=kind, fs=fs, output="sos")
    return zero_phase(signal, coefficients)


def refine_peak(signal: NDArray[np.float64], peak: int, radius: int) -> int:
    centered = signal - np.median(signal)
    left = max(0, peak - radius)
    right = min(len(signal), peak + radius + 1)
    return left + int(np.argmax(np.abs(centered[left:right])))


def detect_peaks(values: ArrayLike, fs: float, config: DetectionConfig = DetectionConfig()) -> NDArray[np.int64]:
    signal = validate_signal(values, fs)
    bounds = ((config.refractory_seconds, .2, 1.), (config.integration_seconds, .04, .2),
              (config.threshold_scale, .05, 2.), (config.refinement_seconds, .02, .15))
    if any(not math.isfinite(value) or not lower <= value <= upper for value, lower, upper in bounds):
        raise ValueError("Invalid detection parameters; see the documented bounds.")
    if signal.size < math.ceil(fs * .5):
        raise ValueError("At least 0.5 seconds is needed for peak detection.")
    if np.ptp(signal) < 1e-10:
        return np.array([], dtype=np.int64)
    # Pan–Tompkins-inspired energy envelope; not a reproduction of that algorithm.
    qrs = zero_phase(signal, butter(2, [5., 20.], btype="bandpass", fs=fs, output="sos"))
    energy = np.gradient(qrs) ** 2
    window = max(1, round(fs * config.integration_seconds))
    envelope = np.convolve(energy, np.ones(window) / window, mode="same")
    baseline = float(np.median(envelope))
    threshold = baseline + config.threshold_scale * (float(np.percentile(envelope, 95)) - baseline)
    if threshold <= np.finfo(float).eps:
        return np.array([], dtype=np.int64)
    distance = math.ceil(config.refractory_seconds * fs)
    candidates, _ = find_peaks(envelope, height=threshold, prominence=threshold * .5, distance=distance)
    radius = max(1, round(config.refinement_seconds * fs))
    centered = signal - np.median(signal)
    refined = []
    for peak in candidates:
        refined.append(refine_peak(signal, int(peak), radius))
    # Refinement can move nearby candidates together. Keep the strongest first.
    selected: list[int] = []
    for peak in sorted(set(refined), key=lambda i: abs(centered[i]), reverse=True):
        if radius <= peak < len(signal) - radius and all(abs(peak - other) >= distance for other in selected):
            selected.append(peak)
    return np.asarray(sorted(selected), dtype=np.int64)


def normalize(values: ArrayLike, fs: float) -> tuple[NDArray[np.float64], float, float]:
    """Population z-score of a copy; flat signals map to zero without division.

    Scale before computing moments to avoid overflow for finite large inputs.
    Returned offset and scale retain the input's physical units. The normalized
    samples are dimensionless and never replace the calibrated waveform.
    """
    signal = validate_signal(values, fs)
    magnitude = float(np.max(np.abs(signal)))
    scaled = signal / magnitude if magnitude else signal
    offset = float(np.mean(scaled))
    scale = float(np.std(scaled, ddof=0))
    output = (scaled - offset) / scale if scale else np.zeros_like(signal)
    return output, offset * magnitude, scale * magnitude


def rr_statistics(peaks: ArrayLike, fs: float) -> dict:
    if not math.isfinite(fs) or fs <= 0:
        raise ValueError("Sampling frequency must be finite and positive.")
    indices = np.asarray(peaks)
    if (indices.ndim != 1 or not np.isfinite(indices).all() or np.any(indices < 0)
            or np.any(indices != np.floor(indices)) or np.any(np.diff(indices) <= 0)):
        raise ValueError("Peak indices must be nonnegative, strictly increasing integers.")
    rr = np.diff(indices) / fs
    bpm = 60. / rr
    return {
        "rr_seconds": rr.tolist(),
        "rr_milliseconds": (rr * 1000).tolist(),
        "instantaneous_bpm": bpm.tolist(),
        "peak_count": len(indices),
        "valid_interval_count": len(rr),
        # Rate corresponding to mean RR, not arithmetic mean of instantaneous BPM.
        "average_bpm": float(60 / np.mean(rr)) if len(rr) else None,
        "mean_rr_seconds": float(np.mean(rr)) if len(rr) else None,
        "min_rr_seconds": float(np.min(rr)) if len(rr) else None,
        "max_rr_seconds": float(np.max(rr)) if len(rr) else None,
        "std_rr_seconds": float(np.std(rr, ddof=0)) if len(rr) else None,
    }


def compare_peaks(detected: ArrayLike, reference: ArrayLike, fs: float, tolerance_seconds: float = .1) -> dict:
    """Sorted, one-to-one chronological matching; no reference-driven detection."""
    rr_statistics(detected, fs)
    rr_statistics(reference, fs)
    if not math.isfinite(tolerance_seconds) or not .01 <= tolerance_seconds <= .2:
        raise ValueError("Reference tolerance must be between 0.01 and 0.2 seconds.")
    detected = np.asarray(detected)
    reference = np.asarray(reference)
    detected_index = reference_index = 0
    errors = []
    while detected_index < len(detected) and reference_index < len(reference):
        delta = (float(detected[detected_index]) - float(reference[reference_index])) / fs
        if abs(delta) <= tolerance_seconds + 1e-12:
            errors.append(abs(delta))
            detected_index += 1
            reference_index += 1
        elif delta < 0:
            detected_index += 1
        else:
            reference_index += 1
    tp = len(errors)
    return {
        "reference_count": len(reference),
        "true_positives": tp,
        "false_positives": len(detected) - tp,
        "false_negatives": len(reference) - tp,
        "sensitivity": tp / len(reference) if len(reference) else None,
        "positive_predictivity": tp / len(detected) if len(detected) else None,
        "mean_absolute_error_seconds": float(np.mean(errors)) if errors else None,
        "tolerance_seconds": tolerance_seconds,
    }

"""Load an interval, process it, and prepare the analysis response."""

from pathlib import Path

from app.processing import (
    DetectionConfig, FilterConfig, compare_peaks, detect_peaks,
    normalize, preprocess, rr_statistics,
)
from app.schemas import (
    AnalysisRequest, AnalysisResponse, DetectedPeak, DetectionParameters,
    NormalizedSignal, ReferenceComparison,
)
from app.dataset import ECGError, ECGService
from app.ml import classify_processed, get_model_directory, load_model, validate_model_signal


def analyze(request: AnalysisRequest, service: ECGService, model_directory: Path | None = None) -> AnalysisResponse:
    record = service.metadata(request.record_id)
    original = service.signal(request.record_id, request.channel, request.start_seconds, request.duration_seconds)
    fs = original.sampling_frequency_hz
    parameters = request.preprocessing
    if request.include_ai:
        validate_model_signal(original)
        if ((parameters.highpass_hz, parameters.lowpass_hz, parameters.order) != (.5, 40., 3)
                or request.detection != DetectionParameters()):
            raise ECGError(422, "AI analysis requires the model's 0.5–40 Hz order-3 filter and default peak detection settings.")
    filters = FilterConfig(
        highpass_hz=parameters.highpass_hz,
        lowpass_hz=parameters.lowpass_hz,
        order=parameters.order,
    )

    # Keep physical ECG samples separate from the optional normalized copy.
    try:
        filtered = preprocess(original.amplitudes, fs, filters)
        peaks = detect_peaks(filtered, fs, DetectionConfig(**request.detection.model_dump()))
        statistics = rr_statistics(peaks, fs)
        normalized = None
        if parameters.normalization == "zscore":
            values, offset, scale = normalize(filtered, fs)
            normalized = NormalizedSignal(offset=offset, scale=scale, amplitudes=values.tolist())
    except (ValueError, TypeError, OverflowError) as exc:
        raise ECGError(422, str(exc)) from exc
    classification = None
    if request.include_ai:
        model, metadata = load_model(model_directory or get_model_directory())
        classification = classify_processed(original, filtered, peaks, model, metadata)
    warnings = [
        "Algorithm-generated estimates, not a diagnosis. Noise, polarity and morphology can cause missed or extra peaks.",
        "Filtering and detection use only the selected interval; boundary transients can affect its edges.",
    ]
    if normalized is not None and normalized.scale == 0:
        warnings.append("The filtered signal is constant; normalized samples are zero and the normalization scale is zero.")
    if len(peaks) < 2:
        warnings.append("Insufficient data: at least two detected peaks are needed for RR and heart-rate estimates.")
    if request.duration_seconds < 5:
        warnings.append("Short interval: heart-rate estimates and filtering are less stable; use a longer interval.")
    if parameters.highpass_hz and parameters.highpass_hz > 1:
        warnings.append("High-pass above 1 Hz can alter ECG morphology; use only for exploratory viewing.")
    if parameters.highpass_hz and request.duration_seconds < 5 / parameters.highpass_hz:
        warnings.append("Interval is short relative to the high-pass time scale; baseline reduction may be incomplete.")
    if statistics["rr_seconds"] and any(rr < .3 or rr > 2 for rr in statistics["rr_seconds"]):
        warnings.append("Some RR intervals are outside 0.3–2 seconds. They are retained, not interpreted as a diagnosis or automatically corrected.")
    # Reference annotations only evaluate detections; they never create peaks.
    reference = None
    try:
        samples = service.reference_beats(request.record_id, original.start_sample, original.end_sample_exclusive)
        if samples is None:
            warnings.append(
                f"Reference annotations are not installed. Run python -m scripts.download_mitbih "
                f"--record {request.record_id} --annotations from backend/ for comparison."
            )
        else:
            comparison = compare_peaks(peaks + original.start_sample, samples, fs, request.reference_tolerance_seconds)
            reference = ReferenceComparison(
                reference_sample_indices=samples,
                reference_timestamps_seconds=[sample / fs for sample in samples],
                **comparison,
            )
            if reference.false_positives or reference.false_negatives:
                warnings.append(
                    f"Reference comparison found {reference.false_positives} unmatched detections and "
                    f"{reference.false_negatives} unmatched annotated beats. BPM/RR and AI counts use detected peaks."
                )
            if request.channel != 0:
                warnings.append("MIT-BIH reference timing primarily follows channel 0; other-channel timing differences affect comparison.")
    except ECGError as exc:
        warnings.append(f"Reference comparison unavailable: {exc.message}")

    detected_peaks = []
    for index in peaks:
        sample = int(index)
        record_sample = original.start_sample + sample
        detected_peaks.append(DetectedPeak(
            interval_sample_index=sample,
            record_sample_index=record_sample,
            timestamp_seconds=record_sample / fs,
            filtered_amplitude=float(filtered[sample]),
        ))

    return AnalysisResponse(
        record=record,
        parameters=request,
        original_signal=original,
        filtered_amplitudes=filtered.tolist(),
        normalized_signal=normalized,
        detected_peaks=detected_peaks,
        statistics=statistics,
        reference_comparison=reference,
        warnings=warnings,
        ai_classification=classification,
    )

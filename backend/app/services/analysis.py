from app.processing.ecg import FilterConfig, DetectionConfig, preprocess, detect_peaks, rr_statistics, compare_peaks, normalize
from app.schemas.analysis import AnalysisRequest, AnalysisResponse, DetectedPeak, ReferenceComparison, NormalizedSignal
from app.services.ecg import ECGError, ECGService


def analyze(request: AnalysisRequest, service: ECGService) -> AnalysisResponse:
    record = service.metadata(request.record_id)
    original = service.signal(request.record_id, request.channel, request.start_seconds, request.duration_seconds)
    fs = original.sampling_frequency_hz
    try:
        filtered = preprocess(original.amplitudes, fs, FilterConfig(**request.preprocessing.model_dump(exclude={"normalization"})))
        peaks = detect_peaks(filtered, fs, DetectionConfig(**request.detection.model_dump()))
        statistics = rr_statistics(peaks, fs)
        normalized = None
        if request.preprocessing.normalization == "zscore":
            values, offset, scale = normalize(filtered, fs)
            normalized = NormalizedSignal(offset=offset, scale=scale, amplitudes=values.tolist())
    except (ValueError, TypeError, OverflowError) as exc:
        raise ECGError(422, str(exc)) from exc
    warnings = ["Algorithm-generated estimates, not a diagnosis. Noise, polarity and morphology can cause missed or extra peaks.",
                "Filtering and detection use only the selected interval; boundary transients can affect its edges."]
    if normalized is not None and normalized.scale == 0:
        warnings.append("The filtered signal is constant; normalized samples are zero and the normalization scale is zero.")
    if len(peaks) < 2:
        warnings.append("Insufficient data: at least two detected peaks are needed for RR and heart-rate estimates.")
    if request.duration_seconds < 5:
        warnings.append("Short interval: heart-rate estimates and filtering are less stable; use a longer interval.")
    if request.preprocessing.highpass_hz and request.preprocessing.highpass_hz > 1:
        warnings.append("High-pass above 1 Hz can alter ECG morphology; use only for exploratory viewing.")
    if request.preprocessing.highpass_hz and request.duration_seconds < 5 / request.preprocessing.highpass_hz:
        warnings.append("Interval is short relative to the high-pass time scale; baseline reduction may be incomplete.")
    if statistics["rr_seconds"] and any(rr < .3 or rr > 2 for rr in statistics["rr_seconds"]):
        warnings.append("Some RR intervals are outside 0.3–2 seconds. They are retained, not interpreted as a diagnosis or automatically corrected.")
    reference = None
    try:
        samples = service.reference_beats(request.record_id, original.start_sample, original.end_sample_exclusive)
        if samples is None:
            warnings.append("Reference annotations are not installed. Run the dataset downloader with --annotations for comparison.")
        else:
            comparison = compare_peaks(peaks + original.start_sample, samples, fs, request.reference_tolerance_seconds)
            reference = ReferenceComparison(reference_sample_indices=samples,
                                            reference_timestamps_seconds=[sample / fs for sample in samples], **comparison)
            if request.channel != 0:
                warnings.append("MIT-BIH reference timing primarily follows channel 0; other-channel timing differences affect comparison.")
    except ECGError as exc:
        warnings.append(f"Reference comparison unavailable: {exc.message}")
    return AnalysisResponse(
        record=record, parameters=request, original_signal=original, filtered_amplitudes=filtered.tolist(),
        normalized_signal=normalized,
        detected_peaks=[DetectedPeak(interval_sample_index=int(p), record_sample_index=int(p) + original.start_sample,
                                    timestamp_seconds=(int(p) + original.start_sample) / fs,
                                    filtered_amplitude=float(filtered[p])) for p in peaks],
        statistics=statistics, reference_comparison=reference, warnings=warnings,
    )

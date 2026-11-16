"""Shared heartbeat features and local N/PVC inference. No training at startup."""

import hashlib
import json
from pathlib import Path

import joblib
import numpy as np
import sklearn

from app.dataset import ECGError, ECGService
from app.processing import detect_peaks, normalize, preprocess

SEED = 42
SPLITS = {"train": ["100", "106", "200"], "validation": ["119"], "test": ["208"]}
CLASSES = ["N", "V"]
FS = 360
BEFORE = 72   # 200 ms before the QRS center
AFTER = 144   # 400 ms after the QRS center
FEATURE_VERSION = "mlii-360-bandpass-zscore-80-v1"
FEATURE_NAMES = [f"wave_{i}" for i in range(72)] + [
    "minimum", "maximum", "range", "mean_absolute", "gradient_rms",
    "early_energy", "qrs_energy", "late_energy",
]
MODEL_DIRECTORY = Path(__file__).resolve().parents[2] / "data" / "models"


def get_model_directory() -> Path:
    return MODEL_DIRECTORY


def patient_group(record_id: str) -> str:
    # PhysioNet identifies 201 and 202 as the same subject. Neither is selected.
    return "201-202" if record_id in {"201", "202"} else record_id


def validate_splits(splits: dict[str, list[str]]) -> None:
    seen = set()
    for split in ("train", "validation", "test"):
        records = splits.get(split, [])
        groups = [patient_group(record) for record in records]
        if not groups or len(set(groups)) != len(groups) or seen.intersection(groups):
            raise ValueError("Each split needs distinct patient groups; groups cannot overlap.")
        seen.update(groups)


def processed_window(service: ECGService, record_id: str, channel: int, start: float, duration: float):
    original = service.signal(record_id, channel, start, duration)
    if original.channel.name != "MLII" or original.sampling_frequency_hz != FS:
        raise ECGError(422, "This model supports the MLII lead at 360 Hz only.")
    try:
        return original, preprocess(original.amplitudes, FS)
    except (ValueError, TypeError, OverflowError) as exc:
        raise ECGError(422, str(exc)) from exc


def beat_features(filtered: np.ndarray, center: int):
    """Return features and a normalized beat; never pad or invent edge samples."""
    if center - BEFORE < 0 or center + AFTER > len(filtered):
        return None
    beat = filtered[center - BEFORE:center + AFTER]
    if not np.isfinite(beat).all() or np.ptp(beat) < 1e-10:
        return None
    beat, _, _ = normalize(beat, FS)
    waveform = np.interp(np.linspace(0, len(beat) - 1, 72), np.arange(len(beat)), beat)
    shape = [beat.min(), beat.max(), np.ptp(beat), np.mean(np.abs(beat)),
             np.sqrt(np.mean(np.gradient(beat) ** 2)), np.mean(beat[:54] ** 2),
             np.mean(beat[54:108] ** 2), np.mean(beat[108:] ** 2)]
    features = np.concatenate([waveform, shape])
    if not np.isfinite(features).all():
        return None
    return features, beat


def load_model(directory: Path = MODEL_DIRECTORY):
    """Only load this application's trusted local, checksum-verified artifacts."""
    try:
        if directory.absolute() != directory.resolve():
            raise ValueError("Unsafe model directory")
        pointer = directory / "current.json"
        if pointer.is_symlink():
            raise ValueError("Unsafe model pointer")
        version = json.loads(pointer.read_text())["version"]
        if not isinstance(version, str) or len(version) != 16 or any(c not in "0123456789abcdef" for c in version):
            raise ValueError("Invalid model version")
        folder = directory / version
        artifact, metadata_path = folder / "model.joblib", folder / "metadata.json"
        if folder.is_symlink() or artifact.is_symlink() or metadata_path.is_symlink():
            raise ValueError("Unsafe model path")
        metadata = json.loads(metadata_path.read_text())
        if (metadata["feature_version"] != FEATURE_VERSION or metadata["version"] != version
                or metadata["sklearn_version"] != sklearn.__version__
                or metadata["supported_classes"] != CLASSES
                or metadata["feature_names"] != FEATURE_NAMES):
            raise ValueError("Model feature/class/library version mismatch")
        validate_splits(metadata["splits"])
        for split in ("validation", "test"):
            report = metadata["evaluation"][split]
            scores = [report[name] for name in ("accuracy", "precision", "recall", "f1")]
            scores += [report["per_class"][label][name] for label in CLASSES
                       for name in ("precision", "recall", "f1-score")]
            if not all(isinstance(score, (int, float)) and np.isfinite(score) and 0 <= score <= 1 for score in scores):
                raise ValueError("Invalid evaluation metadata")
        if hashlib.sha256(artifact.read_bytes()).hexdigest() != metadata["artifact_sha256"]:
            raise ValueError("Model checksum mismatch")
        model = joblib.load(artifact)
        if (list(model.classes_) != CLASSES or model.n_features_in_ != len(FEATURE_NAMES)
                or type(model).__name__ != metadata["algorithm"] or not callable(getattr(model, "predict_proba", None))):
            raise ValueError("Incompatible fitted model")
        return model, metadata
    except Exception as exc:
        raise ECGError(503, "Model unavailable or incompatible. From backend/, run python -m scripts.train_model.") from exc


def model_status(directory: Path = MODEL_DIRECTORY) -> dict:
    try:
        _, metadata = load_model(directory)
        return {"available": True, "version": metadata["version"], "supported_classes": CLASSES,
                "lead": "MLII", "sampling_frequency_hz": FS, "splits": metadata["splits"], "evaluation": metadata["evaluation"]}
    except ECGError as exc:
        return {"available": False, "version": None, "supported_classes": CLASSES, "message": exc.message}


def classify(request, service: ECGService, directory: Path = MODEL_DIRECTORY) -> dict:
    model, metadata = load_model(directory)
    original, filtered = processed_window(service, request.record_id, request.channel,
                                           request.start_seconds, request.duration_seconds)
    peaks = detect_peaks(filtered, FS)
    features, centers = [], []
    for peak in peaks:
        extracted = beat_features(filtered, int(peak))
        if extracted is not None:
            features.append(extracted[0])
            centers.append(int(peak))
    predictions = []
    if features:
        try:
            labels = model.predict(features)
            probabilities = model.predict_proba(features)
        except (ValueError, TypeError, AttributeError) as exc:
            raise ECGError(503, "The local model could not process these beats. Rebuild the model artifact.") from exc
        for center, label, probability in zip(centers, labels, probabilities, strict=True):
            sample = original.start_sample + center
            predictions.append({"label": str(label), "record_sample_index": sample,
                                "timestamp_seconds": sample / FS, "filtered_amplitude": float(filtered[center]),
                                "probabilities": {str(name): float(value) for name, value in zip(model.classes_, probability, strict=True)}})
    counts = {label: sum(beat["label"] == label for beat in predictions) for label in CLASSES}
    total = len(predictions)
    warnings = ["Research model estimates for N/PVC only, not a diagnosis. Other rhythms can be misclassified.",
                "Classification is conditional on detected QRS candidates. Edge/flat beats are skipped; detector misses are not classified.",
                "Training/evaluation covers five records only. Reported held-out metrics use annotated beat centers, not end-to-end detector accuracy."]
    if not total:
        warnings.append("No complete usable beats found. Choose a longer interval.")
    return {"model_version": metadata["version"], "supported_classes": CLASSES,
            "original_signal": original.model_dump(), "filtered_amplitudes": filtered.tolist(),
            "beats": predictions, "counts": counts,
            "proportions": {label: counts[label] / total if total else None for label in CLASSES},
            "detected_count": len(peaks), "skipped_count": len(peaks) - total, "warnings": warnings}

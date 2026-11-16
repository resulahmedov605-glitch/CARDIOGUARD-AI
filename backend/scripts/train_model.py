"""Prepare real grouped N/V beats, train once, evaluate and save locally."""

from collections import Counter
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import tempfile

import joblib
import numpy as np
import sklearn
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix

from app.dataset import ECGService
from app.ml import (AFTER, BEFORE, CLASSES, FEATURE_NAMES, FEATURE_VERSION, FS,
                    MODEL_DIRECTORY, SEED, SPLITS, beat_features, patient_group,
                    processed_window, validate_splits)
from app.processing import refine_peak

CONFIG = {"n_estimators": 200, "max_depth": 12, "min_samples_leaf": 3,
          "class_weight": "balanced_subsample", "random_state": SEED, "n_jobs": 1}


def prepare_dataset(service: ECGService, splits=SPLITS):
    validate_splits(splits)
    datasets, records = {}, {}
    for split, record_ids in splits.items():
        features, labels, groups, positions, beats = [], [], [], [], []
        for record_id in record_ids:
            metadata = service.metadata(record_id)
            if metadata.sampling_frequency_hz != FS or metadata.channels[0].name != "MLII":
                raise ValueError(f"{record_id}: expected channel 0 MLII at 360 Hz")
            annotations = service.annotations(record_id, 0, metadata.sample_count)
            if annotations is None:
                raise ValueError(f"{record_id}: real .atr annotations are required")
            samples = np.asarray(annotations.sample)
            if (np.any(samples < 0) or np.any(samples >= metadata.sample_count)
                    or np.any(np.diff(samples) <= 0)):
                raise ValueError(f"{record_id}: invalid annotation positions")
            symbols = np.asarray(annotations.symbol)
            included, skipped = Counter(), Counter()
            for start in range(0, int(np.ceil(metadata.duration_seconds)), 30):
                duration = min(30, metadata.duration_seconds - start)
                if duration < .5:
                    raise ValueError("Final window is too short; choose an explicitly reviewed record")
                original, filtered = processed_window(service, record_id, 0, start, duration)
                selected = (samples >= original.start_sample) & (samples < original.end_sample_exclusive)
                for sample, symbol in zip(samples[selected], symbols[selected], strict=True):
                    if symbol not in CLASSES:
                        skipped[f"unsupported:{symbol}"] += 1
                        continue
                    center = refine_peak(filtered, int(sample - original.start_sample), round(.1 * FS))
                    extracted = beat_features(filtered, center)
                    if extracted is None:
                        skipped["boundary_or_flat"] += 1
                        continue
                    feature, beat = extracted
                    features.append(feature)
                    beats.append(beat)
                    labels.append(str(symbol))
                    groups.append(patient_group(record_id))
                    positions.append(original.start_sample + center)
                    included[str(symbol)] += 1
            hashes = {extension: hashlib.sha256((service.data_directory / f"{record_id}.{extension}").read_bytes()).hexdigest()
                      for extension in ("hea", "dat", "atr")}
            records[record_id] = {"split": split, "patient_group": patient_group(record_id),
                                  "sampling_frequency_hz": FS, "included": dict(included),
                                  "excluded": dict(skipped), "sha256": hashes}
        if set(labels) != set(CLASSES):
            raise ValueError(f"{split}: both real N and V classes are required")
        datasets[split] = {"features": np.asarray(features), "beats": np.asarray(beats),
                           "labels": np.asarray(labels), "groups": np.asarray(groups),
                           "samples": np.asarray(positions)}
    return datasets, records


def evaluate(model, data):
    predicted = model.predict(data["features"])
    report = classification_report(data["labels"], predicted, labels=CLASSES, output_dict=True, zero_division=0)
    return {"accuracy": float(accuracy_score(data["labels"], predicted)),
            "precision": report["macro avg"]["precision"], "recall": report["macro avg"]["recall"],
            "f1": report["macro avg"]["f1-score"], "per_class": {label: report[label] for label in CLASSES},
            "confusion_matrix": confusion_matrix(data["labels"], predicted, labels=CLASSES).tolist(),
            "confusion_labels": CLASSES, "sample_count": len(predicted)}


def train(service=None, directory: Path = MODEL_DIRECTORY, splits=SPLITS):
    service = service or ECGService()
    datasets, records = prepare_dataset(service, splits)
    model = RandomForestClassifier(**CONFIG)
    model.fit(datasets["train"]["features"], datasets["train"]["labels"])
    evaluation = {name: evaluate(model, datasets[name]) for name in ("validation", "test")}
    identity = {"feature_version": FEATURE_VERSION, "feature_names": FEATURE_NAMES,
                "supported_classes": CLASSES, "sklearn_version": sklearn.__version__,
                "configuration": CONFIG, "splits": splits, "records": records}
    # Each explicit run gets a new artifact, preserving older/user-owned files.
    # Features, split, seed and predictions remain reproducible across runs.
    created_at = datetime.now(timezone.utc).isoformat()
    version = hashlib.sha256((json.dumps(identity, sort_keys=True) + created_at).encode()).hexdigest()[:16]
    metadata = {**identity, "version": version, "algorithm": "RandomForestClassifier",
                "created_at": created_at,
                "beat_window": {"before_samples": BEFORE, "after_samples": AFTER, "sampling_frequency_hz": FS},
                "preprocessing": "Independent <=30s windows; existing 0.5–40 Hz order-3 filter; per-beat population z-score; 72 waveform samples + 8 shape features",
                "selection": "Only annotation symbols N and V; unsupported labels excluded; complete nonflat beats only; fixed patient-disjoint split",
                "evaluation_scope": "Annotated, refined beat centers; not detector-plus-classifier accuracy or clinical validation",
                "evaluation": evaluation}
    if directory.absolute() != directory.resolve():
        raise ValueError("Model output directory must not contain symlinks")
    directory.mkdir(parents=True, exist_ok=True)
    folder = directory / version
    if folder.exists():
        raise ValueError("Model version already exists; retry training")
    with tempfile.TemporaryDirectory(dir=directory, prefix=".training-") as temp:
        staging = Path(temp) / version
        staging.mkdir()
        joblib.dump(model, staging / "model.joblib")
        metadata["artifact_sha256"] = hashlib.sha256((staging / "model.joblib").read_bytes()).hexdigest()
        (staging / "metadata.json").write_text(json.dumps(metadata, indent=2))
        np.savez_compressed(staging / "dataset.npz", **{
            f"{split}_{name}": values for split, data in datasets.items() for name, values in data.items()
        })
        staging.rename(folder)
    with tempfile.NamedTemporaryFile(mode="w", dir=directory, delete=False) as pointer:
        json.dump({"version": version}, pointer)
    Path(pointer.name).replace(directory / "current.json")
    return metadata


if __name__ == "__main__":
    try:
        result = train()
        print(json.dumps({"version": result["version"], "splits": result["splits"], "evaluation": result["evaluation"]}, indent=2))
    except Exception as exc:
        raise SystemExit(f"Training failed: {exc}. Install real data with python -m scripts.download_mitbih --ml")

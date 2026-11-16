# Sprint 3 — AI / Machine Learning

Status: **COMPLETE** for the local N/PVC MVP, verified on 2026-11-16.
This is a research prototype, not a clinically validated diagnostic model.

## Start using it

Run the existing backend/frontend as described in the [README](../README.md).
Open **AI Lab**, choose a record and interval, and press **Classify beats**.
The current saved model is `603d5a015e2f5cc4`.

To prepare/train again, from `backend/`:

```bash
.venv/bin/python -m pip install -r requirements-dev.txt
.venv/bin/python -m scripts.download_mitbih --ml
.venv/bin/python -m scripts.train_model
```

`--ml` preserves already-installed records. Incomplete records cause an explicit
error instead of silently replacing existing data. Training never runs at server
startup. Every explicit training run saves a new version and preserves older
artifacts; a failed run leaves the previous current model in place.

## A. Implemented features and architecture

The existing `ECGService` loads real WFDB data and local `.atr` labels. Training
and prediction share `processed_window` and `beat_features` in `app/ml.py`.
They reuse Sprint 2 `preprocess`, `normalize`, `refine_peak` and `detect_peaks`.
No second backend, cloud service or deep learning framework was added.

The existing AI Lab placeholder is now functional. It displays the actual model
version, N/PVC counts/proportions, sample positions, probabilities, chart markers,
loading/retry states and unavailable-model instructions. The existing chart and
design classes are reused. ECG Analyzer remains available with its old controls.

## B–C. Model and dataset

- Random Forest: 200 trees, depth 12, minimum leaf size 3, seed **42**, one worker.
- Class imbalance: `class_weight="balanced_subsample"`, learned only from train.
- Supported labels are exactly annotation **N** and **V**. A/L/R/F/S/Q and all
  other annotations are explicitly excluded, never converted to N.
- MLII at **360 Hz**; each heartbeat spans **72 samples before / 144 after** its
  QRS center (200/400 ms). Annotated centers are refined with the same dominant
  extremum rule used by the detector.
- Existing 0.5–40 Hz order-3 filtering runs on independent windows of at most
  30 seconds. Each extracted beat uses population z-score normalization.
- Features: 72 interpolated waveform coordinates plus 8 shape/energy features.
  Feature interpolation does not fill missing ECG data. The original 216-sample
  normalized beat is also saved in the prepared dataset.
- Missing/gapped signals fail explicitly. Flat/incomplete edge beats are skipped
  and counted; no zero-padded training beats or substitute labels are created.
- No feature scaler is fitted: normalization is per beat, and the Random Forest
  fits train only. Hyperparameters were fixed before viewing held-out metrics.

| Split | Records | N | V/PVC | Total |
| --- | --- | --- | --- | --- |
| Train | 100, 106, 200 | 5392 | 1314 | 6706 |
| Validation | 119 | 1512 | 437 | 1949 |
| Test | 208 | 1554 | 974 | 2528 |

The record groups are fixed rather than randomly mixing beats. The five selected
records represent separate subjects. The split validator also groups 201/202 as
one patient if used in a future selection, as documented by
[PhysioNet](https://physionet.org/content/mitdb/1.0.0/). These two records are not
part of this MVP. Split overlap and missing classes are rejected.

Artifacts are local and Git-ignored:

```text
data/models/current.json
data/models/<version>/model.joblib
data/models/<version>/metadata.json
data/models/<version>/dataset.npz
```

The NPZ contains train/validation/test features, normalized beats, labels, groups
and sample positions. Metadata records sampling rate, feature version, classes,
sklearn version, configuration, all source-file SHA-256 hashes, per-record
included/excluded counts and held-out results. A repeated real training run
produced identical dataset metadata and metrics; run versions differ by design.
Only locally generated trusted joblib artifacts should be used. Loading validates
the checksum, library/feature version, fitted feature count, class order and model
type. Missing/corrupt/incompatible artifacts return an actionable unavailable state.

## D. Actual evaluation

Training and evaluation were executed on the real five-record dataset. Full
metadata and exclusions are in [sprint-3-results.json](sprint-3-results.json).
Validation accuracy/precision/recall/F1 were all 100% on 1949 selected beats.

Held-out **test record 208**, 2528 selected beats:

| Metric | Result |
| --- | --- |
| Accuracy | 99.2089% |
| Macro precision | 99.0098% |
| Macro recall | 99.3373% |
| Macro F1 | 99.1677% |
| N precision / recall / F1 | 99.9349% / 98.7773% / 99.3528% |
| PVC precision / recall / F1 | 98.0847% / 99.8973% / 98.9827% |

Confusion matrix (rows = actual, columns = predicted):

| | Predicted N | Predicted V |
| --- | --- | --- |
| Actual N | 1535 | 19 |
| Actual V | 1 | 973 |

There were **19 N→PVC false positives** and **1 missed PVC** in this selected test
set. This evaluates classification at annotated/refined beat centers. It is not
end-to-end detection accuracy: prediction uses algorithm-detected peaks and may
miss beats. Unsupported classes, including 373 F annotations in record 208, are
excluded from these classification metrics. A binary model may still assign an
unsupported rhythm/noisy candidate to N or V during inference. Probabilities are
model vote estimates, not calibrated medical confidence. One held-out patient and
five total records do not establish broad or clinical generalization.

## E. Main source files

- New: `backend/app/ml.py`, `backend/scripts/train_model.py`, `backend/tests/test_ml.py`.
- New: `frontend/src/features/ai/AILab.tsx`, `AILab.test.tsx`, `frontend/src/lib/ai.ts`, `frontend/e2e/ai.spec.ts`.
- Extended: `backend/app/{dataset,processing,schemas,routes}.py`, downloader,
  requirements and the ECG record-list fixture assertion.
- Extended: `frontend/src/App.tsx`, Overview, shared ECG chart and its tests.
- Updated: README, code guide, this report, real results JSON and `.gitignore`.

## F. Verification

| Command / check | Result |
| --- | --- |
| `python -m scripts.download_mitbih --ml` | Four additional official records/annotations verified; record 100 preserved |
| `python -m scripts.train_model` | Real training/evaluation/save succeeded twice; identical metrics |
| `python -m pytest -q` | 139 backend tests passed, including ML and existing ECG regressions |
| `python -m pip check` | No broken requirements |
| `npm test` | 41 frontend tests passed |
| `npm run build` | TypeScript and production build passed; existing Plotly size warning |
| `npm run test:e2e` | 10 real Chromium tests passed across desktop/mobile, including AI predictions |

Tests cover grouping, annotation parsing/exclusion, boundary/flat/gapped beats,
feature extraction, training, serialization, deterministic probabilities, missing/
incompatible models, input validation, timestamp/count contracts, inference without
reference labels, failure/retry and chart class markers. Synthetic fixtures exist
only in software tests; reported evaluation metrics come from real data.

API additions:

- `GET /api/v1/ai/model`: availability, version, classes, split and held-out results.
- `POST /api/v1/ai/predict`: `record_id`, `channel` (MLII), `start_seconds`,
  `duration_seconds` (0.5–30). Returns original/filtered signals, timestamped beat
  estimates/probabilities, class counts/proportions, skipped candidates and version.
- Invalid input/unsupported lead: 422; unknown record: 404; missing data/model or
  incompatible model: 503. Model status remains 200 with `available=false`.

## G–H. Status and next steps

All nine Sprint 3 MVP completion criteria were verified locally: real preparation,
training, held-out evaluation, saved-model inference, backend predictions, dashboard
results, passing tests/build and preserved Sprint 1–2 behavior. **COMPLETE**.

Before expanding claims or clinical use, evaluate more independent patients,
measure the detector-plus-classifier together, handle unsupported rhythms/signal
quality and investigate probability calibration. These are limitations of this
small baseline, not evidence of clinical readiness. Physical-device validation
and a broader database evaluation have not been performed.

# Sprint 2 — signal processing and heartbeat analysis

The original verification tables below record the 2026-11-12 implementation.
The [2026-11-15 Phase 1 closeout](phase-1-closeout.md) supersedes their test totals
and acceptance status, and adds normalization, sample-boundary fixes, browser
automation, coverage and full-record evaluation.

Implemented and verified on **2026-11-12**, inside the existing workspace.
CARDIOGUARD AI is an educational/research prototype, **not a clinically validated
diagnostic system**. No Sprint 3, ML, 3D, Algorithms Lab or persistence work began.

## Sprint 1 verification before implementation

The existing architecture, routes and frontend were inspected. All **31 backend
tests**, **7 frontend tests** and the production build passed before code changes.
Real record 100 loaded with 360 Hz / MLII and V5 / 650,000 samples per channel;
live record listing and waveform requests through Vite returned real samples.
The initial Chrome control connection showed a blank page and Safari reported no
window. A later Firefox connection successfully verified raw and analyzed charts.
The early visual check was therefore delayed, not claimed as passed at that time.

## Preprocessing

The pure functions in `backend/app/processing/ecg.py` copy inputs and accept
one-dimensional, nonempty, finite arrays. Sampling must be 50–10,000 Hz. Gaps are
rejected for analysis rather than interpolated; the original viewer preserves gaps.

Defaults are a Butterworth bandpass from **0.5 to 40 Hz**, prototype order **3**,
using SciPy `butter(..., fs=fs, output='sos')` and `sosfiltfilt`. Either cutoff can
be `null` to disable that stage; both null returns a copy of the original.
SOS coefficients improve numerical stability. Forward/backward application
has zero phase in the interior, doubles the single-pass order and squares its
magnitude response. Bandpass design itself has twice the prototype order.
The specified cutoff has approximately -6 dB composite gain, not -3 dB.

High-pass reduction targets slow baseline drift; low-pass reduction targets
high-frequency noise. These defaults suit exploratory QRS viewing, not diagnostic
ST/morphology measurements. There is no notch or resampling.
SciPy's default odd padding is retained; inputs too short for padding are rejected.
No hidden padding reduction or invented samples are returned. Only the selected
window is read, so boundaries and windows short relative to the high-pass time
scale can be distorted. Warnings identify these limitations.

Optional `preprocessing.normalization="zscore"` now produces a separate
`normalized_signal`: `(filtered - mean(filtered)) / std(filtered, ddof=0)`.
The computation is scaled internally to avoid overflow for finite large values.
Offset/scale preserve the input units; the output is dimensionless and uses a
separate chart axis. Zero standard deviation yields zeros with a warning.
Original/filtered samples and peak/RR/BPM results remain unchanged. Default is
`"none"`, which returns null for `normalized_signal`.

## Peak detection

The detector is **Pan–Tompkins-inspired**, not a reproduction or clinically
validated implementation:

1. Independently emphasize QRS content using a 5–20 Hz, order-2 SOS Butterworth
   forward/backward filter on the processed signal.
2. Square its numerical gradient and average energy over 120 ms.
3. Set a window-level threshold to `median + scale × (95th percentile - median)`.
   Default scale is 0.35. SciPy `find_peaks` requires that height, half-threshold
   prominence, and at least 250 ms between envelope candidates.
4. Refine within ±100 ms to the largest absolute excursion in the median-centered
   processed waveform. This handles inverted polarity, but a dominant S/QRS
   extremum may be selected rather than a literal positive R wave.
5. Reapply minimum spacing after refinement, retaining stronger candidates.
   Exclude candidates within the refinement radius of the window edges.

Flat signals return no peaks. Analysis requires at least 0.5 seconds. No adaptive
threshold tracking, search-back, T-wave rejection, ectopic classification, quality
certification or artifact rejection is implemented. Noise can produce peaks and
wide/different morphologies can be missed. The output is labeled algorithm-generated.

## RR and heart-rate statistics

Peak indices must be finite, nonnegative, integral and strictly increasing.
For consecutive indices `p[i]`, `RR = (p[i+1] - p[i]) / fs` seconds;
milliseconds are `1000 × RR`; instantaneous BPM is `60 / RR`.
Average estimated BPM is **60 / mean(RR)**, equal to the number of inter-peak
intervals divided by elapsed time between first/last peaks, times 60. It is not
the arithmetic mean of instantaneous BPM or peak-count/window-duration.

The response includes peak/interval counts, mean/min/max RR and population RR
standard deviation (`ddof=0`). Positive finite intervals are valid numerically,
not evidence of a normal rhythm. Values outside 0.3–2 seconds are retained with
a warning rather than automatically removed. With fewer than two peaks, RR/BPM
statistics are null and the UI shows **Insufficient data**. A unit test verifies
that 0.8 seconds gives exactly 800 ms and 75 BPM. These estimates are not diagnoses.

## API and parameters

`POST /api/v1/ecg/analyze` uses the existing local WFDB service; no second dataset
reader or remote request is introduced. Response fields: `record`, `parameters`,
`original_signal`, `filtered_amplitudes`, `detected_peaks`, `statistics`,
`reference_comparison`, and `warnings`. Original/filtered arrays share timestamps
and sample count. Peaks expose interval index, absolute record index, absolute
timestamp and processed amplitude. Reference positions are separate fields.

| Request parameter | Default | Bounds |
| --- | --- | --- |
| `record_id` | Required | Registered record 100 only |
| `channel` | 0 | Integer, within record channels |
| `start_seconds` | 0 | Finite, nonnegative |
| `duration_seconds` | 10 | 0.5–30, end within record |
| `preprocessing.highpass_hz` | 0.5 | null or 0.05–10 Hz |
| `preprocessing.lowpass_hz` | 40 | null or 10–150 Hz |
| `preprocessing.order` | 3 | Integer 1–6 |
| `preprocessing.normalization` | `none` | `none` or `zscore` |
| `detection.refractory_seconds` | 0.25 | 0.2–1 |
| `detection.integration_seconds` | 0.12 | 0.04–0.2 |
| `detection.threshold_scale` | 0.35 | 0.05–2 |
| `detection.refinement_seconds` | 0.1 | 0.02–0.15 |
| `reference_tolerance_seconds` | 0.1 | 0.01–0.2 |

Cutoffs must also be below Nyquist and high-pass below low-pass. Unknown fields
and non-finite values are rejected. Invalid parameters/signals return 422;
unknown record IDs return 404; missing/corrupt signal data returns 503. Missing,
corrupt or symlinked optional annotations produce comparison warnings without
blocking analysis. Existing GET and health endpoints retain their behavior.
See the [README](../README.md) for curl and local startup commands.

## Reference comparison and actual results

`scripts.download_mitbih --annotations` downloads only the additional official
record-100 `.atr` file, checks sample bounds and records its SHA-256 in the local
source manifest. The API reads it locally and never downloads during analysis.
Only standard WFDB beat symbols are retained; rhythm/other markers are excluded.
Reference annotations never seed or correct detected peaks.

Matching is chronological one-to-one within configurable ±100 ms by default.
TP = matched pairs, FP = unmatched detections, FN = unmatched reference beats.
Sensitivity = TP/(TP+FN), positive predictivity = TP/(TP+FP); undefined ratios
are null. Every beat in the requested interval is included, including edges.
MIT-BIH timing primarily follows channel 0; V5 differences can affect matching.

Executed `python -m scripts.evaluate_ecg` with unchanged defaults on nine
non-overlapping 30-second windows starting at **0, 30, 60, 300, 600, 900, 1200,
1500, 1770 seconds**, separately for both channels:

| Channel | Evaluated duration | TP | FP | FN | Sensitivity | Positive predictivity |
| --- | --- | --- | --- | --- | --- | --- |
| MLII (0) | 270 s | 337 | 0 | 0 | 100% | 100% |
| V5 (1) | 270 s | 334 | 0 | 3 | 99.11% | 100% |

The full per-window output is [record-100-evaluation.json](validation/record-100-evaluation.json).
This is a limited software comparison on selected windows of **one record**, not
whole-database, independent cohort or clinical validation. Parameters were not
tuned using reference labels. No general accuracy claim follows from these counts.

## Executed verification and acceptance

| Check | Actual result |
| --- | --- |
| Backend tests | **86 passed**, no skips or warnings, including real-data comparison |
| Frontend tests | **14 passed**, three files |
| Production build / strict TypeScript | Passed; existing lazy Plotly size warning remains |
| Dependency installation/check | Requirements satisfied, including SciPy 1.18.1; no broken requirements |
| Official annotation download | Passed after approved network access; no substitute data |
| Live POST through Vite | MLII 0–10 s, 3,600 original/filtered samples, 13 detected/reference matches |
| Live POST directly to FastAPI | V5 30–40 s, aligned timestamps, 3,600 samples and reference comparison |
| Firefox desktop | Real raw/filtered chart, Run analysis, markers, 74.4 estimated BPM, 13 peaks, 0.806 s mean RR, 12 intervals |
| Firefox visibility controls | Original and peak markers hidden/re-enabled independently; filtered trace remains |
| Firefox responsive 393 × 852 | Controls fit in two columns, no horizontal panel overflow; desktop restored |

Backend coverage includes noise/baseline attenuation and passband/phase accuracy
at 250/360 Hz; inverted controlled pulses with T-like waves/noise; refractory
spacing; invalid/short/gapped/flat signals; zero/insufficient/invalid RR intervals;
75 BPM numerical check; API parameters; missing datasets; corrupt/unsafe optional
annotations; one-to-one reference matching and configurable tolerance.
Synthetic signals exist only in explicitly identified automated tests.

Frontend tests check requests occur on Run/Retry, exact selected parameters,
loading/error/retry, absent statistics, invalid cutoffs, raw rendering, trace
sample/timestamp bindings and independent original/filtered/marker visibility.
Plotly is mocked only in unit tests; actual rendering was checked in Firefox.
Initial frontend test selectors matched duplicate table/statistic values; their
queries were scoped to the statistic panel and inconsistent test fixtures fixed.
A final raw-JSON NaN/Infinity check exposed a validation-error serialization 500;
the application handler now converts non-finite error inputs to strings and returns
422. Three regression cases and a live proxy request verified this fix.
The final run is green. No required command remains blocked.

The original Sprint 2 acceptance result was later supplemented by the audit and
fixes linked above; use that closeout for current status. Browser emulation is not a
physical-device test. The default Plotly lazy chunk remains approximately 1.17 MB
(388 kB gzip) and triggers Vite's size warning. No clinical validation is claimed.

## Completion recheck

On resuming the task, both development servers were stopped; implementation files
were already present. Backend tests (**86 passed**), dependency consistency,
frontend tests and build were executed again. A small display issue was fixed:
undefined reference sensitivity now shows `Insufficient data`, not
`Insufficient data%`. Its regression test brings the frontend total to **14**.
The final production build passed with the same Plotly size warning.

Live MLII analysis through the Vite proxy and direct V5 analysis returned matching
original/filtered lengths, absolute timestamps, peaks, RR/BPM and reference
comparison. Re-running the full evaluation script reproduced the recorded
MLII/V5 counts. Frontend/backend are left running on localhost for user review.

The previous successful Firefox desktop/mobile checks above remain historical
evidence. During this recheck the browser-control host was unavailable and native
controls intermittently reported `noWindowsAvailable`; a fresh complete
interactive browser run is therefore not claimed. The API and automated checks
completed successfully.

## Files and dependencies

Created: `backend/app/processing/{__init__,ecg}.py`,
`backend/app/schemas/analysis.py`, `backend/app/services/analysis.py`,
`backend/app/api/v1/analysis.py`, `backend/scripts/evaluate_ecg.py`,
`backend/tests/test_processing.py`, `backend/tests/test_analysis.py`,
`frontend/src/lib/analysis.ts`, `frontend/src/features/ecg/SignalAnalysis.tsx`,
`SignalAnalysis.test.tsx`, `ECGChart.test.tsx`, `analysis.test-fixtures.ts`, this
report and the validation JSON.

Modified: application validation-error handler, existing API router and ECG service,
downloader, backend requirements,
frontend API hook, ECG Analyzer/chart/styles, README, data README and architecture
documentation. Source waveform/annotation files and manifest stay ignored by Git.
Algorithm work added `scipy>=1.13,<2`, already present via WFDB. The subsequent
downloader TLS fix declares `certifi>=2024.2.2`, also already present transitively.
No new frontend dependency was needed. No GitHub push or deployment occurred.

### Downloader TLS follow-up

The local Python installation had no default CA file. The downloader now retains
secure SSL defaults and supplements its trust store with certifi's Mozilla roots
unless a custom `SSL_CERT_FILE` or `SSL_CERT_DIR` is explicitly configured.
Added `backend/tests/test_download_mitbih.py` covers missing default CAs, retained
hostname/certificate checks, custom-CA configuration, verified file download and
preservation of existing files on failure. **91 backend tests passed**, with no
broken requirements. A real record-100 download with annotations succeeded
without setting `SSL_CERT_FILE`; no TLS verification was disabled.

## Scientific/technical references

- [Pan and Tompkins (1985), original QRS detection paper](https://doi.org/10.1109/TBME.1985.325532)
- [SciPy Butterworth design and SOS guidance](https://docs.scipy.org/doc/scipy/reference/generated/scipy.signal.butter.html)
- [SciPy forward/backward SOS filtering and padding](https://docs.scipy.org/doc/scipy/reference/generated/scipy.signal.sosfiltfilt.html)
- [SciPy peak distance/prominence](https://docs.scipy.org/doc/scipy/reference/generated/scipy.signal.find_peaks.html)
- [PhysioNet beat versus non-beat symbols](https://physionet.org/static/lightwave/doc/annotations.html)
- [MIT-BIH reference timing and dataset limitations](https://physionet.org/physiobank/database/html/mitdbdir/intro.htm)
- [WFDB annotation timing in channel 0](https://physionet.org/physiotools/wpg/wpg_30.htm)

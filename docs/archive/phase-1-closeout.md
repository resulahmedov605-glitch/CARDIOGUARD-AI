> Historical snapshot. For the current simple setup, read the [README](../../README.md) and [code guide](../development.md).

# Phase 1 closeout — 2026-11-15

Sprint 1 and Sprint 2 technical acceptance is complete for the registered local
MIT-BIH record 100. This report supersedes the earlier audit's open implementation
items. It does not claim clinical validation or completion of future modules.

## Audit items resolved

| Item | Implementation and verification |
| --- | --- |
| Decimal sample boundaries | `ECGService.signal` uses `sample_ceiling`; eight ULPs absorb representational round-off without moving genuine off-grid requests. Start 0.55 s / duration 0.5 s at 360 Hz yields `[198, 378)`, 180 samples and analysis HTTP 200. Tests cover 100/250/360 Hz, a real off-grid delta, minimum analysis intervals and record-end bounds. |
| Signal normalization | Optional `preprocessing.normalization` is `none` (default) or `zscore`. `normalize` works on the filtered interval, preserves inputs, avoids overflow for large finite signals, rejects gaps, and maps constant signals to zero with scale zero. The API returns offset/scale, aligned samples and dimensionless units separately. |
| Correct visualization units | Raw and filtered traces/peak markers stay on the calibrated left axis. The normalized trace uses a labeled dimensionless right axis and independent visibility control. Detection and RR/BPM use the filtered physical waveform. |
| Regressions and browser acceptance | 120 backend tests, 36 frontend unit tests, 8 real Chromium tests across desktop 1440×1000 and mobile 393×852. Browser tests cover the real minimum interval, V5 selection, normalized analysis, actual trace bindings, RR rows, zoom, pan, reset, hover, retry, themes and desktop sidebar drag/collapse/persistence. |
| Coverage | Backend `app` has 95% combined statement/branch coverage. A 90% gate is configured in `backend/pyproject.toml`. Downloader tests are included in the suite, but scripts are not included in that coverage percentage. |
| Reproducible dependencies | `backend/requirements-dev.lock` pins the tested Python 3.13 environment. It was installed into a fresh `.cache/verify-venv`; dependency consistency and the full backend suite passed there. npm uses the updated committed lockfile. |
| Dataset publication | Verified files and the manifest are prepared before publication. Recoverable replacement failures restore the previous files or remove newly introduced files. Tests cover existing/new installations and symlink rejection. |
| Version history | Local baseline commit `e4ff588` records the pre-fix project. The previous Desktop-level repository did not provide project history. No remote push or deployment was performed. |
| Documentation | README, dataset README, architecture and sprint documentation now distinguish current behavior from historical reports. The Overview badge identifies Phase 01 / ECG analysis. |
| Repeatable CI | `.github/workflows/ci.yml` installs locked dependencies, downloads/verifies record 100 with annotations, and runs coverage, frontend tests/build and browser tests. It has not been executed on GitHub because no remote is configured. |

## Verification commands

From `backend/`:

```bash
.venv/bin/python -m coverage run -m pytest
.venv/bin/python -m coverage report
.venv/bin/python -m pip check
.venv/bin/python -m scripts.evaluate_ecg
.venv/bin/python -m scripts.evaluate_ecg --full-record
```

From `frontend/`:

```bash
npm test
npm run typecheck
npm run build
npm run test:e2e:install
npm run test:e2e
```

Browser tests start their own servers on 18000 and 15173 and clean them up.
They do not reuse or stop the user's servers on 8000/5173. Chromium binaries live
in `.cache/playwright`. The HTML report and screenshots are ignored local outputs
in `frontend/playwright-report` and `frontend/test-results`.

## Reference validation

The original nine-window-per-channel check still produces MLII TP/FP/FN
337/0/0 and V5 334/0/3. See
[selected windows](validation/record-100-evaluation.json).

`--full-record` covers every sample in consecutive windows of at most 30 seconds,
including the final partial window and all reference beats at window edges.
It does not overlap windows, remove boundary reference beats or tune detection
from annotations. There are 61 windows/channel (122 total).

| Channel | Duration | Reference beats | TP | FP | FN | Sensitivity | Positive predictivity |
| --- | --- | --- | --- | --- | --- | --- | --- |
| MLII | 1805.5556 s | 2273 | 2261 | 0 | 12 | 99.47% | 100% |
| V5 | 1805.5556 s | 2273 | 2253 | 0 | 20 | 99.12% | 100% |

See [full-record results](validation/record-100-full-evaluation.json). Matching
uses the documented one-to-one ±100 ms rule. Missed beats remain visible in the
report; finite-window edge effects and channel morphology are known limitations,
not grounds for excluding reference beats. These measurements concern one record
and do not establish performance across patients, databases or clinical settings.

## Remaining scope limits

- Record 100 / format 212 / one channel per request / maximum 30 seconds.
- No notch, resampling, streaming, adaptive search-back or certified signal-quality
  assessment. Filter transients and missed/extra peaks remain possible.
- No ML training/classification, 3D renderer, Algorithms Lab or SQLite persistence;
  those remain later-sprint work rather than unfinished Sprint 1–2 features.
- The lazy official Plotly basic bundle remains about 1.17 MB minified / 388 kB
  gzip and raises Vite's size warning. It is loaded only in the ECG viewer; this
  is documented performance debt, not a failed build.
- Dataset replacement is not a batch-atomic snapshot for concurrent readers.
  Stop the backend during refresh. Power loss/persistent disk failures can prevent
  rollback, so its protection is explicitly limited to recoverable failures.
- Mobile checks use emulation. Hosted CI, physical-device testing and clinical
  validation are not claimed.

The next sprint can start from the verified local ECG pipeline. Broader record
support and independent validation should precede claims about general detector
accuracy; future ML work should keep a separate training/evaluation protocol.

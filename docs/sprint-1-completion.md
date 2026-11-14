# Sprint 1 completion — ECG integration and viewer

Validated on **2026-11-11**, with Node.js 24.11.1 and Python 3.13.5, inside the
existing `CARDIOGUARD AI` workspace. Sprint 2 has not been started.

## Acceptance criteria

| Criterion | Result and evidence |
| --- | --- |
| Frontend/backend run locally | Vite 5173 and Uvicorn 8000 started successfully |
| Load real MIT-BIH record 100 | Official PhysioNet files downloaded and WFDB checksum verified |
| Metadata API | 360 Hz, 650,000 samples/channel, MLII and V5, about 1,805.56 seconds |
| Real waveform API | Both channels compared with WFDB; 5–7 second requests return 720 samples each |
| Real waveform in browser | Chrome rendered record 100 with calibrated mV amplitudes and time axis |
| Record/channel/interval controls | Record 100 selected; MLII to V5 and 5–7 second interval verified |
| Zoom, pan, inspect, reset | Plotly graph rendered with hover; drag zoom, pan and reset manually checked |
| Minimal Light shell | Sidebar/header and other sections preserved; desktop and 393px Chrome emulation checked |
| Loading/errors/missing data | Automated frontend and backend coverage; no generated fallback data |
| Automated tests/build | 31 backend tests, 7 frontend tests, production build passed |
| Documentation | README, architecture, attribution and completion report updated |

Every requested Sprint 1 acceptance criterion is met. No clinical claims, signal
processing, ML training/prediction, or 3D functionality have been implemented.

## Executed checks

| Command/check | Final result |
| --- | --- |
| Backend dependency installation | Passed; WFDB and compatible numerical dependencies installed |
| `python -m scripts.download_mitbih` | Record 100 downloaded/verified; 1,950,000-byte waveform |
| `python -m pytest` | **31 passed**, including real-data test; no skips or warnings |
| `python -m pip --cache-dir ../.cache/pip check` | No broken requirements |
| Frontend dependency installation | Passed; npm reported 0 vulnerabilities |
| `npm test` | **7 passed** |
| `npm run build` | Passed, including strict TypeScript checking |
| Direct HTTP, port 8000 | Health, list, metadata, both channels, 404/422 responses verified |
| Vite proxy HTTP, port 5173 | Same health/list/metadata/waveform/error checks passed |
| Native Chrome desktop | Real chart, channel/interval changes, zoom, pan and reset verified |
| Chrome 393 × 852 emulation | Controls/chart fit without horizontal page overflow |

Exact setup/certificate commands are in the [README](../README.md). The real-data
test skips on clean installs without record 100; other API tests work offline.
Frontend tests mock Plotly; the actual chart was checked separately in Chrome.
Responsive verification used emulation, not a physical mobile device.

## Part 2 file changes

Created:

- `backend/app/schemas/ecg.py` — metadata/list/signal contracts.
- `backend/app/services/__init__.py`, `backend/app/services/ecg.py` — validated
  WFDB access and bounded interval reads.
- `backend/app/api/v1/ecg.py` — three ECG endpoints.
- `backend/scripts/__init__.py`, `backend/scripts/download_mitbih.py` — official
  download and integrity verification.
- `backend/tests/test_ecg.py`, `backend/tests/test_mitbih_local.py` — API/security
  cases and optional real-data comparison.
- `frontend/src/lib/ecg.ts` — response types.
- `frontend/src/hooks/useApiResource.ts` — cancellable requests and retry.
- `frontend/src/features/ecg/ECGAnalyzer.tsx`, `ECGChart.tsx`, `ecg.css`,
  `ECGAnalyzer.test.tsx` — viewer, controls, styles, tests.
- `frontend/vitest.config.ts` — frontend test environment.
- `data/README.md`, `data/mitbih/.gitkeep` — location and attribution.
- `docs/sprint-1-completion.md` — this report.

Modified:

- `backend/app/api/v1/router.py`, `backend/app/main.py` — ECG router/error
  composition; health preserved.
- `backend/requirements.txt`, `backend/pyproject.toml` — dependencies and
  workspace-local test temporary files.
- `frontend/package.json`, `frontend/package-lock.json` — dependencies/tests.
- `frontend/src/App.tsx`, `frontend/src/features/overview/Overview.tsx` — existing
  navigation opens the viewer and shows ECG availability.
- `.gitignore` — ignore downloaded ECG files/manifests.
- `README.md`, `datasets/README.md`, `docs/architecture.md`, `docs/sprint-1.md` — current setup,
  architecture, and historical-report context.

Generated locally and ignored by Git: `data/mitbih/100.hea`, `100.dat`, and
`100.source.json`, plus caches, virtual environment and build output. Existing
dataset/model/storage scaffolding and user files were retained.

## Dependencies added

Backend: `wfdb==4.3.1`, `numpy>=1.26.4,<3`, `pandas>=2.2.3,<3.1`. WFDB brings
required transitive packages including SciPy; no scikit-learn or 3D package.

Frontend runtime: `react-plotly.js@4.1.0` and the `plotly.js` alias targeting
`plotly.js-basic-dist-min@4.3.0`. Development: `@types/plotly.js@3.0.15`,
`vitest@5.1.0`, `jsdom@29.1.1`, `@testing-library/react@16.3.3`.

## Issues, resolutions and limitations

- The initial versioned `wfdb.dl_files` attempt duplicated the version in its URL
  and returned 404. Explicit official versioned URLs fixed the download; WFDB
  verifies the result. The final download succeeded.
- Header validation initially rejected WFDB's valid `None` byte offset; it now
  accepts `None` or zero. Corrupt-file tests remain strict.
- WFDB emitted pandas deprecation warnings with pandas 3.1. Constraining pandas
  below 3.1 removed them; the final test run was clean.
- Restricted shell networking blocked initial localhost checks. They passed with
  approved local access and a direct connection bypassing the system proxy.
  No required command remains blocked.
- Safari computer control was unavailable; native Chrome supplied real-chart
  and responsive verification.
- Vite warns that the lazy Plotly basic chunk exceeds 500 kB: approximately
  **1.17 MB minified / 387 kB gzip**. Build passes; lazy loading limits its effect
  to the ECG viewer.
- Initial scope is record 100, one channel and at most 30 seconds per request.
  Pan/zoom do not fetch extra intervals. Full checksum verification happens on
  download, not each API request; re-download modified/corrupt local files.

This educational/research prototype is **not clinically validated**. There is
no diagnosis, processing pipeline, model, 3D renderer, database schema,
deployment, GitHub push, or remote-repository initialization.

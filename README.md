# CARDIOGUARD AI

A local-first, educational heart intelligence workspace. The foundation includes a
Minimal Light dashboard, a FastAPI service, and an interactive viewer for real
MIT-BIH ECG record **100**. Fonts, chart code, API calls, and data reads are local
at runtime.

**CARDIOGUARD AI is an educational and research prototype, not a clinically
validated diagnostic tool.** It provides waveform inspection, not diagnoses,
predictions, heartbeat classifications, or medical advice. Sprint 2 adds signal
filtering, algorithm-generated peaks, RR intervals and estimated heart rate.
Estimated BPM is not a diagnosis.

## Implemented in Sprint 1

- Existing sidebar, header, Overview, ECG Analyzer, AI Lab, 3D Heart Explorer,
  and Algorithms Lab navigation; advanced modules remain placeholders.
- Health endpoint and live backend connection indicator.
- Explicit download of record 100 from PhysioNet with WFDB integrity checks.
- Local record listing, metadata, and bounded waveform API endpoints.
- Record/channel selection, start/duration controls, metadata panel, real
  amplitudes and timestamps, hover inspection, zoom, pan, and reset.
- Loading, missing-data, validation, request-error, and retry states.
- Automated backend/frontend tests and a TypeScript-checked production build.

## Sprint 2 — run ECG analysis

Start both services using the setup below. In ECG Analyzer, load an interval of
**0.5–30 seconds**, keep the default **0.5–40 Hz** / order **3**, and click
**Run analysis**. Original samples are preserved. Toggle **Original ECG**,
**Filtered ECG**, and **Detected peaks (algorithm)** independently. Expand the RR
table for peak timestamps, RR milliseconds and instantaneous BPM. Fewer than two
peaks produces **Insufficient data**. Parameter edits alone do not submit requests;
changing record/channel/interval clears old analysis.

Optional official reference annotations, from `backend/`:

```bash
.venv/bin/python -m scripts.download_mitbih --annotations
```

This verifies/downloads the same record-100 files and adds only `100.atr`.
Analysis works without annotations and reports comparison as unavailable.

```bash
curl --fail -H 'Content-Type: application/json' \
  --data '{"record_id":"100","channel":0,"start_seconds":0,"duration_seconds":10,"preprocessing":{"highpass_hz":0.5,"lowpass_hz":40,"order":3}}' \
  http://127.0.0.1:8000/api/v1/ecg/analyze
```

`POST /api/v1/ecg/analyze` returns metadata, applied parameters, `original_signal`
(including timestamps/frequency), `filtered_amplitudes` on the same grid,
`detected_peaks`, `statistics`, warnings and optional `reference_comparison`.
Peaks identify both interval and full-record sample indices. Missing/non-finite
samples are rejected for analysis rather than filled; the raw viewer shows gaps.

Current verification (2026-11-15): **120 backend tests**, **36 frontend unit tests**,
**8 real Chromium desktop/mobile tests**, **95% backend application coverage**
including branches, and successful TypeScript/production build checks.
The sample-boundary regression is fixed and optional z-score normalization is
available. See the [Phase 1 closeout](docs/phase-1-closeout.md) for evidence and
remaining scope limits. Repeat the limited reference
comparison from `backend/` (requires annotations):

```bash
.venv/bin/python -m scripts.evaluate_ecg
.venv/bin/python -m scripts.evaluate_ecg --full-record
```

Choose **Normalization → Z-score** before Run analysis to add a normalized trace.
It uses the filtered interval's mean and population standard deviation and has
a separate, dimensionless right-hand axis. Original/filtered amplitudes stay in
their calibrated units, and peak detection/RR/BPM still use the filtered ECG.
The API accepts `preprocessing.normalization: "none" | "zscore"` (default `none`)
and returns `normalized_signal` with amplitudes, offset, scale and units, or null.
Constant signals produce zero normalized samples with an explicit warning.

See [Sprint 2 algorithms, parameters, results and limitations](docs/sprint-2.md).

## Appearance and feedback

Use the header's sun/moon button to switch light/dark mode. The initial theme
uses a saved choice or the system preference, and selections are retained in
browser storage when available. The ECG chart, inputs, cards and notifications
follow the same theme. Backgrounds and borders transition over 280ms with
ease-in-out timing; text and SVG colors update immediately to avoid delayed
inherited colors. The system's reduced-motion preference disables the transition.
Main-area text and controls are larger: form controls
are 48px high and checkboxes 20px; sidebar typography is preserved.

On desktop (1024px and wider), drag the sidebar's right edge to resize it between
200px and 400px. The chosen width is saved in browser storage. Double-click the
edge to restore the responsive default (256px, or 224px at narrower desktop sizes).
Drag farther left, past 144px, to collapse it to a 72px icon rail. The sidebar's
toggle button reopens it at the previous expanded width; the collapsed preference
is also remembered. Navigation icons retain their labels and hover titles.
The focused divider also accepts Left/Right arrows, Shift for larger steps, and
Home/End for the minimum/maximum expanded width. Enter toggles collapse; Left at
the minimum collapses and Right from the rail reopens it. Escape cancels a drag.
The main area and
ECG chart reflow with the available space; mobile keeps its horizontal navigation.

Red is the primary accent in both themes, with matching buttons, active navigation,
focus outlines and favicon. The overview heart uses a single Lucide HeartPulse
icon without a separate overlay obscuring its center.

Lucide React supplies shared icons. Toasts are limited to analysis outcomes,
important chart failures and explicitly requested connection-check results.
Theme changes, normal record/signal loading, chart resets and background health
polling stay silent. Routine errors and form validation remain visible inline.
Retried operations reuse their notification and obsolete messages are dismissed
on navigation; notification surfaces still follow the active light/dark theme.

See [appearance and notification behavior](docs/appearance-and-feedback.md).

## Architecture and stack

The modular monolith has one React application and one FastAPI application,
run as separate local development processes. HTTP routes delegate ECG access
to a reusable WFDB service; Pydantic defines response contracts. The browser
uses relative `/api/...` URLs through Vite's local proxy, so broad CORS rules
are unnecessary.

| Area | Technology |
| --- | --- |
| Frontend | React, TypeScript, Vite, Tailwind CSS v4, local Inter, Lucide React |
| Notifications | `react-hot-toast`, using the active light/dark palette |
| ECG chart | `react-plotly.js` with the official Plotly basic bundle, loaded on demand |
| Backend | Python, FastAPI, Pydantic, Uvicorn |
| Dataset/processing | WFDB, NumPy, SciPy; pandas constrained for WFDB compatibility |
| Tests | pytest, FastAPI TestClient, Vitest, Testing Library, jsdom |
| Storage | Local WFDB files; SQLite reserved for later functionality |

See [architecture decisions](docs/architecture.md) and the
[Sprint 1 completion report](docs/sprint-1-completion.md).

## Requirements

- Node.js **22.12+** (or 20.19+) and npm.
- Python **3.13** with `venv` and `pip` for the tested locked environment.
- Internet for initial dependency installation and the explicit dataset download.
  After setup, no cloud service or external API call is needed.

Run commands inside the existing `CARDIOGUARD AI` workspace. Do not create a
second project folder inside it.

## Local setup

### 1. Backend and dataset — terminal one

```bash
cd backend
python3 -m venv .venv
.venv/bin/python -m pip install --cache-dir ../.cache/pip -r requirements-dev.lock
.venv/bin/python -m scripts.download_mitbih
.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

The downloader fetches only `100.hea` and `100.dat` into `data/mitbih/`, verifies
its full waveform checksum, and writes a source/hash manifest. Download or
verification failure does not replace existing files or generate substitute
ECG data. Rerun the command to repair a damaged download. API requests never
download files.
Publication errors restore files already replaced. Stop the backend while
refreshing a dataset: the file set is not a single atomic transaction for
concurrent readers, and rollback cannot guarantee recovery after power/disk loss.

Backend health: <http://127.0.0.1:8000/api/v1/health> → `{"status":"ok"}`.

No backend `.env` is required. Host and port are explicit startup arguments.
Swagger/ReDoc pages are disabled to avoid their default CDN assets; the schema
is at <http://127.0.0.1:8000/openapi.json>.

On Windows, use `.venv\Scripts\python.exe` instead of `.venv/bin/python` and
`python` instead of `python3` where appropriate.

### 2. Frontend — terminal two

```bash
cd frontend
npm ci --cache ../.cache/npm
npm run dev
```

Open <http://127.0.0.1:5173/#/ecg-analyzer>. Select record **100**, choose **MLII**
or **V5**, enter a start and duration, and click **Update interval**. Amplitudes
use the WFDB header calibration in mV. Drag with **Zoom** or **Pan**, hover to
inspect samples, and use **Reset view** to restore the loaded interval.

Both servers bind to `127.0.0.1`. Keep both terminals running; stop with `Ctrl+C`.
If dependencies and record 100 are already installed, only the Uvicorn and
`npm run dev` commands are needed.

The default proxy works without `.env`. To change the backend port, copy
`frontend/.env.example` to `frontend/.env`, update the target, and restart Vite:

```dotenv
API_PROXY_TARGET=http://127.0.0.1:8000
```

This server-side Vite setting is not exposed as a client `VITE_*` variable. The
health indicator polls every 30 seconds with a five-second timeout. ECG requests
have a 15-second timeout and explicit retry controls.

## Dataset source and attribution

Source: [MIT-BIH Arrhythmia Database v1.0.0 on PhysioNet](https://physionet.org/content/mitdb/1.0.0/),
under the [Open Data Commons Attribution License v1.0](https://physionet.org/content/mitdb/view-license/1.0.0/).
Record 100 has 650,000 samples/channel at 360 Hz, MLII and V5 channels, and a
duration of about 1,805.56 seconds. Metadata comes from its WFDB header.

Citation: Moody, G., & Mark, R. (2005). *MIT-BIH Arrhythmia Database (version
1.0.0).* PhysioNet. <https://doi.org/10.13026/C2F305>.
See [data documentation](data/README.md) for the original publication and file
details. Downloaded files and generated manifests are ignored by Git.

## ECG API

| Method and path | Response |
| --- | --- |
| `GET /api/v1/health` | Existing service status |
| `GET /api/v1/ecg/records` | `records` metadata array and `unavailable_records` with reasons |
| `GET /api/v1/ecg/records/100` | ID, frequency, channel indices/names/units, sample count, duration |
| `GET /api/v1/ecg/records/100/signal` | Selected channel, interval/sample bounds, timestamps, amplitudes |
| `POST /api/v1/ecg/analyze` | Original/filtered signals, optional normalization, peaks, RR/BPM and optional references |

| Signal query parameter | Default | Validation |
| --- | --- | --- |
| `channel` | `0` | Integer; record 100 supports 0 and 1 |
| `start_seconds` | `0` | Finite, nonnegative number |
| `duration_seconds` | `10` | Finite number greater than 0 and at most 30 |

The interval must fit inside the record. Samples belong to `[start, start +
duration)`; timestamps are absolute seconds from record start, aligned to its
sampling grid. Responses include requested and actual bounds. WFDB missing
amplitudes become JSON `null` and chart gaps, never zeroes.
Values within eight floating-point ULPs of a sample boundary snap to that
boundary before ceiling; genuine off-grid times keep the half-open semantics.
For example, start 0.55 s and duration 0.5 s at 360 Hz returns samples 198–377
(180 samples) and can be analyzed successfully.

```bash
curl --fail 'http://127.0.0.1:8000/api/v1/ecg/records/100/signal?channel=1&start_seconds=5&duration_seconds=2'
```

Unknown/unregistered IDs return **404**; invalid channels/ranges **422**;
missing/corrupt/unsupported local records **503** with repair guidance. The list
remains **200** with availability information. Errors use FastAPI's `detail`
field: a string for domain errors, validation details for query errors. Clients
cannot supply filesystem paths or remote URLs.

## Tests and build

From `backend/`:

```bash
.venv/bin/python -m pytest
.venv/bin/python -m coverage run -m pytest
.venv/bin/python -m coverage report
.venv/bin/python -m pip --cache-dir ../.cache/pip check
```

Main API tests create numerical WFDB fixtures in the workspace cache; these are
test inputs, never application data. They run offline and cover health, listing,
metadata, both channels, sample/time alignment, invalid IDs/ranges, missing and
corrupt files, and unsafe paths. A separate real-data test compares the API with
WFDB for local record 100; it skips if no dataset is installed. With record 100
present, the Sprint 1 baseline was **31 passed**. The current Sprint 2 suite has
**120 passing tests**, including sample-boundary regressions, normalization,
processing, analysis API and downloader publication rollback. Application coverage
is 95% including branches; the configured minimum is 90%. This percentage covers
`backend/app`, not the downloader scripts or frontend. `requirements-dev.lock`
pins the tested Python 3.13 environment, including transitive dependencies;
`requirements*.txt` retain the direct dependency declarations.

From `frontend/`:

```bash
npm test
npm run typecheck
npm run build
npm run preview
```

The **36 unit tests** cover requests, selectors, invalid intervals/cutoffs,
loading/errors/retry, cancellation, chart trace bindings/visibility, normalization
units, themes, sidebar controls and notifications. Plotly is mocked in unit tests.
The separate **8 browser tests** render real Plotly and call the real backend:

```bash
npm run test:e2e:install
npm run test:e2e
```

Install/download record 100 before the browser suite. It starts dedicated backend
18000 and Vite 15173 processes and stops them afterward; existing development
servers are left alone. Four scenarios run at desktop 1440×1000 and mobile
393×852: real analysis/normalization and the minimum interval; zoom/pan/reset/
hover; API-error retry; theme persistence and desktop sidebar drag/collapse.
Mobile uses Chromium emulation, not a physical device. Browser binaries and
reports stay local and are ignored by Git. On Windows or with a custom interpreter,
set `CARDIOGUARD_PYTHON` to its executable path.

`.github/workflows/ci.yml` runs the same checks after a verified dataset download.
It is prepared for a future remote repository; no hosted CI result is claimed.

`build` includes strict TypeScript checks and writes `frontend/dist/`. It passes
with a size warning for the lazy Plotly basic chunk (about 1.17 MB / 387 kB gzip).
`preview` serves at <http://127.0.0.1:4173> with the same API proxy; keep the
backend running. A generic static file server does not supply this proxy.
Production-local packaging is outside this sprint.

To check the development proxy with both services running:

```bash
curl --fail http://127.0.0.1:8000/api/v1/health
curl --fail http://127.0.0.1:5173/api/v1/ecg/records
```

## Project structure

```text
CARDIOGUARD AI/
├── frontend/
│   ├── src/
│   │   ├── components/         # Existing sidebar, header, icons
│   │   ├── config/             # Navigation
│   │   ├── features/ecg/       # Analyzer, lazy chart, styles, tests
│   │   ├── features/overview/  # Existing dashboard
│   │   ├── features/modules/   # Future module placeholders
│   │   ├── hooks/              # Health polling and API requests
│   │   ├── lib/                # API types and health boundary
│   │   └── App.tsx
│   ├── .env.example
│   ├── vite.config.ts
│   └── vitest.config.ts
├── backend/
│   ├── app/
│   │   ├── api/v1/             # Health and ECG routers
│   │   ├── schemas/            # Pydantic contracts
│   │   ├── services/ecg.py     # Validated local WFDB access
│   │   └── main.py             # Factory and error handling
│   ├── scripts/download_mitbih.py
│   ├── tests/                  # API and real-data checks
│   └── requirements*.txt
├── data/mitbih/                # Local record 100, ignored by Git
├── datasets/{raw,processed}/   # Existing future derived-data scaffold
├── models/                     # Reserved for future models
├── storage/                    # Reserved for SQLite
├── docs/                       # Architecture and sprint reports
└── .gitignore
```

## Known limitations and next sprint

- Only registered record 100 and format-212 files are initially supported.
  More reviewed records can be added to the registry and downloader.
- One request loads one channel for up to 30 seconds. Zoom/pan explore that
  interval; use controls to fetch another. No streaming, downsampling, or
  whole-record chart is implemented.
- Header/size checks catch malformed or truncated files. Full checksum
  verification occurs on download, not every request. Re-download data whose
  contents have been changed locally.
- Filtering uses the selected interval. Short windows and boundary transients can
  distort baseline/morphology; this is not diagnostic filtering.
- The energy-envelope detector can miss beats or mark noise/T waves. No adaptive
  search-back or signal-quality certification is implemented. Refinement selects
  a dominant QRS extremum in either polarity, not always a positive R wave.
- RR validity means positive finite spacing, not normal rhythm. Unusual intervals
  remain visible with warnings. Reference evaluation covers selected windows of
  one record and does not establish clinical performance.
- ML training/classification, diagnostic outputs, 3D rendering, Algorithms Lab and
  persistence remain future work. Sprint 3 has not been started.

## Troubleshooting

- **Missing/corrupt data:** run `.venv/bin/python -m scripts.download_mitbih`
  from `backend/`, then refresh available records.
- **Backend unavailable:** start FastAPI on port 8000 and retry. If the port
  differs, update `API_PROXY_TARGET` and restart Vite.
- **Invalid interval:** choose a nonnegative start, duration in `(0, 30]`, and
  an end within the record duration.
- **Port in use:** stop the previous instance or configure another port. Vite
  uses `strictPort` to keep URLs predictable.
- **macOS Python certificate error:** the downloader now supplements Python's
  default CA store with `certifi` automatically, retaining certificate and hostname
  verification. The ordinary download command works even if Python's default CA
  file is missing. Explicit `SSL_CERT_FILE` / `SSL_CERT_DIR` settings are respected.
  If a private CA is required, supply its verified bundle using `SSL_CERT_FILE`.
  For dependency installation with a missing Python CA bundle, `/etc/ssl/cert.pem`
  may be used if it exists:

  ```bash
  .venv/bin/python -m pip install --cert /etc/ssl/cert.pem --cache-dir ../.cache/pip -r requirements-dev.txt
  .venv/bin/python -m scripts.download_mitbih
  ```

- **Restricted environment:** downloads and local-port binding may require
  environment permission. Shell HTTP clients may need to bypass a system proxy
  for `127.0.0.1`, for example with `curl --noproxy '*'`.

The local repository has baseline commit `e4ff588` for the pre-fix Sprint 1–2
state. No remote repository or deployment has been configured or pushed.

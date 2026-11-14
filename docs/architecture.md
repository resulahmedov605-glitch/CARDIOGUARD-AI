# Architecture decisions — Sprints 1–2

## Modular monolith, preserved foundation

One React application and one FastAPI application run as local development
processes. Existing shell, navigation, health, and module placeholders remain.
Features grow within these applications rather than becoming separate services.

The factory composes versioned routers under `/api/v1`. The ECG router validates
HTTP inputs; Pydantic defines contracts; `ECGService` owns WFDB access, file
checks, interval bounds, and domain errors. Dependency injection lets tests use
isolated data without changing production paths. Health is dataset-independent.

## Explicit local-data boundary

`data/mitbih/` is canonical for the viewer. Existing `datasets/raw` and
`datasets/processed` remain reserved for future derived datasets. `models` and
`storage` reserve future model/SQLite locations; no ORM or schema is needed yet.

The downloader stages only the official versioned record-100 header and waveform
inside the workspace. WFDB verifies the header and full decoded waveform
checksum. A manifest records source, license, and SHA-256 hashes. Download and
verification failures preserve existing files. API requests never download or
generate ECG data. Git ignores downloaded files and manifests.

An explicit registry permits only `100` and `100.dat`. IDs never become arbitrary
paths. The service rejects symlinked dataset directories/files, unregistered
header file references, unsupported layouts, and inconsistent sizes before
waveform reads. This supports a deliberately reviewed subset of WFDB formats;
additional records require registry/layout review.

## Bounded signal API

Metadata uses `wfdb.rdheader`; signals use `wfdb.rdrecord` with `sampfrom`,
`sampto`, and one selected channel. Physical calibration supplies amplitudes and
units. The original read endpoint does not normalize or filter samples.

Inputs must be finite, start nonnegative, duration in `(0, 30]`, and end inside
the record. Channel indices are checked against metadata. Samples lie in
`[start, end)`, using ceiling sample indices. Responses include requested and
actual bounds, frequency, and matching timestamp/amplitude arrays. WFDB missing
values become JSON nulls and chart gaps.

Unknown IDs return 404; invalid inputs 422; unavailable/corrupt data 503. The list
reports availability and reasons so an empty installation shows download
instructions. Full checksums run during download; requests check header, size,
and selected-interval decoding instead of reading the whole record repeatedly.

## Same-origin frontend requests

Relative `/api/...` URLs are proxied to `http://127.0.0.1:8000` in development and
build preview. Broad CORS rules are unnecessary. Both servers bind to loopback.
Later local distribution needs an explicit serving arrangement; this sprint
supplies development and preview flows, not cloud hosting.

ECG requests have a 15-second timeout, cancellation, retry, and stale-response
protection. URL changes clear old data immediately. Draft intervals apply on
submission, avoiding requests on each keystroke. Selectors use real API metadata;
there is no fallback waveform. Health keeps its separate five-second timeout
and 30-second polling.

## Frontend and chart dependencies

Existing hash navigation avoids a router dependency. Tailwind v4 uses its
Vite plugin, CSS theme, and CSS import without legacy PostCSS setup. The Minimal
Light palette and local Inter font remain consistent across shell and viewer.

`react-plotly.js/factory` binds the official basic Plotly distribution through a
`plotly.js` npm alias, avoiding the full chart bundle. The chart module loads
lazily when signal data exists. Its approximately 1.17 MB minified chunk still
triggers Vite's default size warning, which is retained and documented.

The chart uses real timestamps, calibrated units, unsimplified lines, and missing
sample gaps. Zoom/pan/reset/hover inspect only the loaded interval. The
browser does not process the signal. Sprint 2 processing runs in the backend; neither
side performs medical inference.

All runtime assets are local. Swagger/ReDoc remain disabled to avoid default CDN
assets; `/openapi.json` remains available. WFDB's required numerical/data packages
are installed, without ML or 3D libraries. pandas is constrained below 3.1 because
WFDB 4.3 uses APIs deprecated in that release.

## Verification boundary

Offline API tests generate numerical WFDB fixtures, compare actual WFDB slices,
and check invalid requests, corrupt/missing files, and unsafe paths. A separate
test compares real record 100 and skips when absent. Frontend tests mock only
the rendering boundary and verify requests/states. Chrome separately verifies
the real Plotly graph and interactions. These are software/data-integration
checks, not clinical validation.

## Sprint 2 analysis boundary

`app/processing/ecg.py` contains NumPy/SciPy functions and immutable parameter
dataclasses, independent of FastAPI, Pydantic and WFDB. The analysis service
reuses `ECGService.signal` and adds filtering, detection, statistics and optional
reference matching. The POST router and schemas remain separate. SciPy, already
installed transitively by WFDB, is now declared as a direct dependency.

Original samples are retained. Analysis rejects gaps and invalid inputs instead
of interpolating. SOS forward-backward filtering avoids systematic phase delay;
finite-window edge artifacts remain explicit warnings. The detector uses a
polarity-independent energy envelope and refractory spacing. The reference
reader allows only the registered record's optional local `.atr` file, rejects
symlinks, and excludes non-beat markers. Reference absence/corruption degrades
comparison only and never supplies algorithmic peaks.

Optional z-score normalization is a separate derivative of the filtered interval.
`normalized_signal` includes the method, dimensionless units, physical offset/
scale and aligned amplitudes. It never replaces original/filtered amplitudes or
feeds the peak detector. The UI gives it a separately labeled right-hand axis.

`sample_ceiling` snaps only representational round-off near integer sample indices
(eight ULPs) before applying ceiling. It preserves actual off-grid requests and
the `[start, end)` contract, including intervals at the end of the record.

`SignalAnalysis` submits POST only on Run/Retry. Its component is reset on a new
channel/interval. The shared request hook keys responses by URL and serialized
body, cancels old requests, hides stale estimates, and explains validation errors.
Chart visibility changes operate locally without new API requests. Plotly's
modebar is explicitly restricted to local zoom/pan/axis controls.

See [Sprint 2 methods and validation](sprint-2.md) for exact formulas, bounds,
reference metrics, scientific sources and limitations.

## Official references

- [MIT-BIH dataset](https://physionet.org/content/mitdb/1.0.0/)
- [WFDB record I/O](https://wfdb.readthedocs.io/en/latest/io.html)
- [React Plotly custom bundle](https://github.com/plotly/react-plotly.js#customizing-the-plotlyjs-bundle)
- [Tailwind Vite integration](https://tailwindcss.com/docs/installation/using-vite)
- [Vite proxy](https://vite.dev/config/server-options.html#server-proxy)
- [FastAPI testing](https://fastapi.tiangolo.com/tutorial/testing/)

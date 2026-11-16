> Historical snapshot. For the current simple setup, read the [README](../../README.md) and [code guide](../development.md).

# Sprint 1 — Project foundation

This is the historical **Part 1** report. Dataset integration and the interactive
ECG viewer were added in Part 2; see the current
[Sprint 1 completion report](sprint-1-completion.md) for final scope and checks.

Implemented inside the existing `CARDIOGUARD AI` workspace:

- React + TypeScript + Vite frontend and Tailwind v4 Vite integration.
- Minimal Light dashboard with a sidebar, header, and locally served Inter font.
- Overview, ECG Analyzer, AI Lab, 3D Heart Explorer, and Algorithms Lab navigation.
- Clearly marked future module placeholders.
- FastAPI application with Pydantic schemas and versioned routing.
- `GET /api/v1/health` returning `{"status":"ok"}`.
- Vite development/preview proxy and a real connection status with retry.
- Automated health endpoint test.
- Dataset, model, storage, and documentation locations.
- Local setup documentation, frontend `.env.example`, and project `.gitignore`.

No ECG processing, ML training, 3D rendering, database schema, dataset download,
remote repository, or cloud deployment is part of this sprint.

## Verification

Validated on **2026-11-11**, using Node.js 24.11.1 and Python 3.13.5.

| Check | Result |
| --- | --- |
| Frontend dependency installation | Passed; npm reported no vulnerabilities |
| Backend development dependency installation | Passed |
| `npm run build` | Passed, including strict TypeScript checks |
| `.venv/bin/python -m pytest` | **1 passed**, no warnings in the final run |
| `.venv/bin/python -m pip --cache-dir ../.cache/pip check` | No broken requirements |
| Backend `GET :8000/api/v1/health` | HTTP 200, `{"status":"ok"}` |
| Development proxy `GET :5173/api/v1/health` | HTTP 200, `{"status":"ok"}` |
| Built preview `GET :4173/` | HTTP 200, built HTML served |
| Preview proxy `GET :4173/api/v1/health` | HTTP 200, `{"status":"ok"}` |
| Safari desktop overview | Rendered successfully; API displayed Connected |
| All four module links and return to Overview | Verified in Safari |
| Backend stopped | Dashboard polling displayed Unavailable and a start-backend prompt |

The test client uses `httpx2`, as required by the installed Starlette release.
The initially installed `httpx` compatibility path raised a deprecation warning;
it was replaced, and the unused packages were removed before final validation.

## Environment issues resolved

- Initial sandboxed npm/PyPI requests failed DNS resolution. Required package
  installation and version checks succeeded with approved network access.
- The installed macOS Python was missing its default CA bundle. Installation
  succeeded using `--cert /etc/ssl/cert.pem`, without disabling certificate checks
  or changing system files.
- Initial sandboxed Uvicorn and Vite preview starts failed with `Operation not
  permitted` / `EPERM`. Both succeeded with approved local-port access.
- The in-app browser integration was unavailable. Native Safari supplied the
  desktop visual and navigation checks. Its computer-control connection later
  became unavailable; the manual retry button and mobile viewport were not
  independently verified in a browser.

No required install, build, or backend test command remains blocked. Development
and preview servers started for verification are stopped after the checks.

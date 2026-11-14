# Appearance and feedback

Current browser automation (2026-11-15) covers desktop sidebar dragging,
collapse/expand and persistence, light/dark chart updates, and a 393px layout.
The older browser-control limitations below are historical. See
[Phase 1 closeout](phase-1-closeout.md) for the current verification.

Implemented and checked on **2026-11-13**, following Sprint 2. No new analysis
algorithms or later-sprint functionality were introduced.

## Themes and readability

`ThemeProvider` selects the saved `cardioguard.theme` value, falling back to the
system preference. An early script in `index.html` applies it before the app
loads to avoid a light flash. Browser storage failures do not disable switching.
The header sun/moon button changes the application and chart together.
Surfaces, borders, outlines and shadows use the existing 280ms ease-in-out
transition. Text and SVG fill/stroke colors update immediately: transitioning
`color` on every ancestor and descendant delayed inherited text colors during
theme changes. Card/link hover movement is preserved without a text-color
transition. Reduced-motion settings disable the animation; sidebar width and
chart gestures remain immediate.

Semantic CSS variables define light/dark surfaces, text, borders, focus, accents
and error states. The Plotly palette follows React theme state, preserving
current zoom and trace visibility. No CSS inversion or remote theme asset is used.

The primary accent is now red: light-mode links/buttons use `#DC2626`, dark-mode
accent text uses `#FB8C94`, with rose tints and neutral charcoal dark surfaces.
The favicon, focus outlines, navigation and overview illustration follow this
palette. Distinct waveform trace colors and semantic success/warning colors are
retained for readability.

The overview illustration uses one Lucide `HeartPulse` SVG. The old heart plus
ECG overlay had a separate background rectangle across its center; that layer
and the crossing axis were removed so the drawing stays continuous in both themes.

Main content labels/text are mostly 14–16px, headings and metadata are enlarged,
form/action controls are 48px high, chart tools are 40px high, and checkboxes
are 20px. Sidebar font sizes retain their prior values. On mobile,
controls use two columns and the theme button becomes an accessible icon button.

## Resizable desktop sidebar

At viewport widths of 1024px and above, the sidebar's right edge can be dragged
between 200px and 400px. Pointer capture keeps the drag active outside the narrow
handle. The final choice is stored as `cardioguard.sidebarWidth`; intermediate
movement is not written to storage. Storage failures leave resizing functional.
Double-click restores the responsive default: 256px above 1200px, otherwise 224px.

Dragging past 144px to the left snaps the sidebar into a 72px icon rail. The
expanded width stays intact, and a Lucide panel-toggle button restores it.
The rail's navigation retains accessible names and hover titles. A separate
`cardioguard.sidebarCollapsed` value remembers the collapsed state across reloads.
Dragging back to the right can also resize the rail into an expanded sidebar.

The focusable vertical separator exposes its controlled pane and current width.
Left/Right arrows adjust by 8px, Shift increases the step to 32px, and Home/End
select the expanded bounds. Enter toggles collapse; Left at 200px collapses and
Right from the rail restores the prior width. Escape, pointer cancellation or
lost capture discard the drag, including a provisional collapse.
Navigation labels truncate with full titles available on hover at small widths.
The handle and toggle are hidden on mobile, where horizontal navigation and full
labels are retained independently of the saved desktop collapsed preference.

One CSS width variable drives the sidebar and content offset. Container queries
reflow cards and forms according to the remaining content space. A cleaned-up
`ResizeObserver` resizes Plotly when the chart container changes without resetting
signal visibility. Resizing does not generate notifications or change ECG data.

## Icons and notifications

`Icon.tsx` uses static Lucide imports behind the existing typed component API.
Navigation, module/status badges, headers, action buttons, empty/error states,
analysis statistics and chart tools use icons. Decorative orbit nodes remain
decorative; no ECG sample or detected/reference marker is replaced by a UI icon.

The existing `react-hot-toast` package is used through `notify` and a single
`NotificationCenter`. The toast surfaces/text reference the same theme variables,
so even a currently visible toast follows a theme change. All toast icons are
Lucide, with success, error, warning, information and loading treatments. Cards
support dismissal, readable text, accessible live messages and optional retry.

| Event | Notification |
| --- | --- |
| Theme switch | No toast; the appearance updates immediately |
| Sidebar resize/collapse/expand/reset | No toast |
| Find/refresh records, metadata and waveform loading | In-page loading/error/empty states only |
| Invalid filter/time settings | Inline explanation only |
| Run/retry analysis | One result: success, insufficient-peaks warning or error/retry; progress stays in-page |
| Reset chart | No toast |
| Chart rendering failure | Error notification |
| Manual health check | One connection result with retry on failure; progress stays in the button |
| Background health polling | Always silent; the environment status still updates |

Operation IDs replace their loading/error/result toast rather than creating a
new stack. Aborted/stale responses cannot publish success or error notifications.
Changing a resource or leaving its view dismisses obsolete request notifications.
No toast claims a diagnosis or invents BPM/measurements. Form keystrokes, ordinary
navigation and local trace-visibility toggles do not generate repetitive toasts.

## Verification

- **34 frontend tests passed** across eight test files, including theme persistence,
  system defaults, storage-denied behavior, retained chart visibility, request
  retry/cancellation, toast update/dismissal, accessible error actions, and
  silent routine resource requests and completely silent background polling.
  Sidebar tests cover drag limits/deltas, persistence, keyboard/reset, interrupted
  drags and unavailable storage, plus collapse thresholds, reopening at the prior
  width, rail persistence, keyboard toggling and desktop/mobile transitions.
  Chart tests cover container resize and cleanup.
- Production build and TypeScript checks passed. The pre-existing approximately
  1.17 MB lazy Plotly chunk still produces Vite's size warning.
- Earlier Firefox checks: real record-100 analysis, dark chart, success toast,
  light theme/card and responsive layout were observed successfully. Theme-change
  notifications have since been removed according to the quieter policy.
- Responsive Firefox emulation at 393px confirmed fitting controls/theme header
  and toast width. The viewport was restored afterward. This was not a physical
  device test.
- The earlier additional Overview check was blocked by a computer-use URL
  restriction. For the later red-accent/heart revision, a direct localhost preview
  was attempted but the browser access host was unavailable. This latest visual
  revision is covered by build/source review, not claimed as a manual browser pass.
  The sidebar resize preview was also attempted against the existing localhost
  server; the browser access host remained unavailable. Automated tests/build
  passed, but the new drag/collapse behavior has not been manually checked in a
  browser; the collapse preview attempt encountered the same unavailable host.

Existing user-started development servers were reused; no extra port-5173 or
port-8000 process was started or stopped. The already-installed Lucide React and
react-hot-toast packages were reused. No backend changes were needed.

## Main files

- `src/hooks/useTheme.tsx`, `src/main.tsx`, `index.html`: theme initialization.
- `src/components/Icon.tsx`, `Header.tsx`, `Sidebar.tsx`: shared icons and controls.
- `src/hooks/useSidebarWidth.ts`, `src/components/SidebarResizeHandle.tsx`: sidebar sizing and persistence.
- `src/components/NotificationCenter.tsx`, `src/lib/notifications.tsx`: toast UI/API.
- `src/hooks/useApiResource.ts`, `useHealth.ts`: request/status feedback lifecycle.
- Existing ECG/overview/placeholder components and CSS: consistent integration.
- Theme, chart, notification-center and hook tests: behavioral verification.

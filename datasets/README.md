# Local datasets

- `raw/`: original, unmodified dataset files.
- `processed/`: derived files produced by future preprocessing steps.

Both directories remain empty and their contents are ignored by Git. The
Sprint 1 ECG viewer reads the official MIT-BIH record 100 from `data/mitbih/`;
see [data documentation](../data/README.md) for download and attribution.
This existing scaffold is retained for future derived-dataset workflows.
Sprint 2 preprocessing and optional z-score normalization run in memory in
`backend/app/processing/ecg.py`. They do not write derived dataset files here.

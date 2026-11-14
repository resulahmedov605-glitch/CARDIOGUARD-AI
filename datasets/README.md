# Local datasets

- `raw/`: original, unmodified dataset files.
- `processed/`: derived files produced by future preprocessing steps.

Both directories remain empty and their contents are ignored by Git. The
Sprint 1 ECG viewer reads the official MIT-BIH record 100 from `data/mitbih/`;
see [data documentation](../data/README.md) for download and attribution.
This existing scaffold is retained for future derived-dataset workflows.
No signal preprocessing is implemented yet.

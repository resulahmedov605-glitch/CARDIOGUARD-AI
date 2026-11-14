# MIT-BIH local data

`mitbih/` is the canonical location for the ECG viewer's local WFDB records.
The older `datasets/` scaffold remains reserved for future derived datasets; no
existing directories have been moved or removed.

From `backend/`, run:

```bash
.venv/bin/python -m scripts.download_mitbih
```

Only `100.hea` (header) and `100.dat` (waveform) are downloaded. No other records or
annotations are fetched by default. With `--annotations`, it also fetches the
official `100.atr` references and validates their sample bounds. References are
never used as detected peaks or inputs to the detector.
The command stages the files, validates the header and
full waveform checksum with WFDB, and writes `100.source.json` with source,
license, metadata, and SHA-256 hashes. Downloads have a 30-second timeout per file;
failures leave existing files untouched and never produce substitute ECG data.
If publication fails after a file is replaced, the downloader restores the
previous file set (or removes files introduced by that failed installation).
Stop the backend while refreshing files; the batch is not atomic to concurrent
readers and cannot guarantee rollback through power loss or persistent disk errors.

HTTPS downloads verify certificates and hostnames. The downloader supplements
Python's default CA store with `certifi`, avoiding the missing-CA-file issue in
some macOS Python installations. Explicit `SSL_CERT_FILE` or `SSL_CERT_DIR`
configuration takes precedence; no global SSL setting is changed.

The source is the [MIT-BIH Arrhythmia Database, version 1.0.0](https://physionet.org/content/mitdb/1.0.0/)
on PhysioNet. Its [Open Data Commons Attribution License v1.0](https://physionet.org/content/mitdb/view-license/1.0.0/)
applies to downloaded data. Keep source attribution when using or redistributing it.

Dataset citation:

> Moody, G., & Mark, R. (2005). MIT-BIH Arrhythmia Database (version 1.0.0).
> PhysioNet. https://doi.org/10.13026/C2F305

Original publication:

> Moody GB, Mark RG. The impact of the MIT-BIH Arrhythmia Database.
> IEEE Engineering in Medicine and Biology. 2001;20(3):45–50.
> https://doi.org/10.1109/51.932724

The downloaded record has two channels (MLII and V5), 650,000 samples per channel,
and a sampling frequency of 360 Hz. Physical units are read from the WFDB header
and calibration; no amplitudes, diagnostic labels, or measurements are invented.

All files inside `mitbih/` except `.gitkeep` are ignored by Git. The application
reads files locally after setup and does not fetch data during API requests.

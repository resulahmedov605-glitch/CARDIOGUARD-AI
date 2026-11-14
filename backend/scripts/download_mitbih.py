"""Download only registered MIT-BIH files from PhysioNet, then verify with WFDB."""

import argparse
import hashlib
import json
import os
from pathlib import Path
import ssl
import tempfile
from urllib.request import urlopen
from shutil import copyfileobj
from shutil import copyfile

import wfdb
import certifi

from app.services.ecg import DATA_DIRECTORY, ECGError, ECGService, KNOWN_RECORDS


def download_ssl_context() -> ssl.SSLContext:
    """Retain TLS verification even when Python's default CA bundle is missing."""
    context = ssl.create_default_context()
    # Respect explicitly configured CA stores; otherwise supplement Python's
    # platform defaults with certifi's portable Mozilla roots.
    if "SSL_CERT_FILE" not in os.environ and "SSL_CERT_DIR" not in os.environ:
        context.load_verify_locations(cafile=certifi.where())
    return context


def install_verified_files(directory: Path, destination: Path, names: list[str]) -> None:
    """Roll back already-published files if any filesystem replacement fails.

    Each replacement is atomic on this filesystem. The batch can be observed
    between replacements, so stop readers for a dataset refresh. This protects
    recoverable installation errors, not power loss or an unrecoverable disk.
    """
    backup = directory / "previous"
    backup.mkdir()
    for name in names:
        target = destination / name
        if target.is_symlink() or (target.exists() and not target.is_file()):
            raise ValueError("Existing dataset targets must be regular files.")
        if target.is_file():
            copyfile(target, backup / name)
    installed = []
    try:
        for name in names:
            (directory / name).replace(destination / name)
            installed.append(name)
    except OSError:
        for name in reversed(installed):
            previous = backup / name
            if previous.is_file():
                previous.replace(destination / name)
            else:
                (destination / name).unlink()
        raise


def download(record_id: str, annotations: bool = False) -> None:
    if DATA_DIRECTORY.absolute() != DATA_DIRECTORY.resolve():
        raise ValueError("The dataset directory must not contain symlinks")
    DATA_DIRECTORY.mkdir(parents=True, exist_ok=True)
    context = download_ssl_context()
    # Stage files so a failed download never replaces a working local record.
    with tempfile.TemporaryDirectory(dir=DATA_DIRECTORY, prefix=".download-") as staging:
        directory = Path(staging)
        files = [f"{record_id}.hea", *KNOWN_RECORDS[record_id]]
        if annotations:
            files.append(f"{record_id}.atr")
        # Explicit versioned URLs avoid WFDB's automatic latest-version lookup.
        for name in files:
            url = f"https://physionet.org/files/mitdb/1.0.0/{name}"
            with urlopen(url, timeout=30, context=context) as response, (directory / name).open("wb") as output:
                copyfileobj(response, output)
        service = ECGService(directory)
        metadata = service.metadata(record_id)
        # Full decode is a one-time integrity check, not a waveform API request.
        record = wfdb.rdrecord(str(directory / record_id), physical=False)
        sums = record.d_signal.sum(axis=0) % 65536
        if any(int(actual) != int(expected) % 65536
               for actual, expected in zip(sums, record.checksum, strict=True)):
            raise ValueError("Downloaded waveform checksum does not match its WFDB header")
        if annotations:
            labels = wfdb.rdann(str(directory / record_id), "atr")
            if not len(labels.sample) or any(sample < 0 or sample >= metadata.sample_count for sample in labels.sample):
                raise ValueError("Invalid reference annotation sample positions")
        manifest = {
            "source": "https://physionet.org/content/mitdb/1.0.0/",
            "license": "Open Data Commons Attribution License v1.0",
            "record": metadata.model_dump(),
            "sha256": {name: hashlib.sha256((directory / name).read_bytes()).hexdigest()
                       for name in files},
        }
        manifest_name = f"{record_id}.source.json"
        (directory / manifest_name).write_text(
            json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
        )
        install_verified_files(directory, DATA_DIRECTORY, [*files, manifest_name])
        print(f"Verified record {record_id}: {metadata.sample_count} samples, "
              f"{metadata.sampling_frequency_hz:g} Hz, "
              f"{', '.join(channel.name for channel in metadata.channels)}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--record", choices=KNOWN_RECORDS, default="100")
    parser.add_argument("--annotations", action="store_true", help="Also download official reference beat annotations")
    args = parser.parse_args()
    try:
        download(args.record, args.annotations)
    except (ECGError, OSError, ValueError, RuntimeError) as exc:
        parser.exit(1, f"Dataset download failed: {exc}\nNo substitute data was generated.\n")

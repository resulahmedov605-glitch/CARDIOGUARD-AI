"""Offline downloader checks; real HTTPS is checked separately when available."""

from io import BytesIO
import json
from pathlib import Path
import ssl
from urllib.error import URLError
from unittest.mock import Mock

import pytest

from scripts import download_mitbih as downloader
from test_ecg import dataset


def test_missing_python_ca_defaults_use_verified_certifi_roots(monkeypatch):
    monkeypatch.delenv("SSL_CERT_FILE", raising=False)
    monkeypatch.delenv("SSL_CERT_DIR", raising=False)
    # Reproduce the macOS installation with no default CA certificates.
    empty_context = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    assert empty_context.cert_store_stats()["x509_ca"] == 0
    monkeypatch.setattr(downloader.ssl, "create_default_context", lambda: empty_context)
    context = downloader.download_ssl_context()
    assert context.cert_store_stats()["x509_ca"] > 0
    assert context.verify_mode == ssl.CERT_REQUIRED
    assert context.check_hostname is True


@pytest.mark.parametrize("setting", ["SSL_CERT_FILE", "SSL_CERT_DIR"])
def test_explicit_custom_ca_configuration_is_preserved(monkeypatch, setting):
    monkeypatch.setenv(setting, "/custom/ca-store")
    custom_context = Mock(spec=ssl.SSLContext)
    monkeypatch.setattr(downloader.ssl, "create_default_context", lambda: custom_context)
    assert downloader.download_ssl_context() is custom_context
    custom_context.load_verify_locations.assert_not_called()


def test_downloader_passes_secure_context_and_verifies_wfdb_files(monkeypatch, dataset: Path):
    destination = dataset / "downloaded"
    monkeypatch.setattr(downloader, "DATA_DIRECTORY", destination)
    calls = []

    def open_fixture(url, *, timeout, context):
        assert timeout == 30
        assert context.verify_mode == ssl.CERT_REQUIRED
        assert context.check_hostname
        calls.append(url)
        return BytesIO((dataset / url.rsplit("/", 1)[1]).read_bytes())

    monkeypatch.setattr(downloader, "urlopen", open_fixture)
    downloader.download("100")
    assert len(calls) == 2
    assert all(url.startswith("https://physionet.org/files/mitdb/1.0.0/") for url in calls)
    assert (destination / "100.dat").read_bytes() == (dataset / "100.dat").read_bytes()
    assert json.loads((destination / "100.source.json").read_text())["record"]["sample_count"] == 2000


def test_download_failure_preserves_existing_record(monkeypatch, tmp_path: Path):
    monkeypatch.setattr(downloader, "DATA_DIRECTORY", tmp_path)
    (tmp_path / "100.hea").write_bytes(b"existing header")
    (tmp_path / "100.dat").write_bytes(b"existing waveform")
    monkeypatch.setattr(downloader, "urlopen", Mock(side_effect=URLError("certificate verification failed")))
    with pytest.raises(URLError):
        downloader.download("100")
    assert (tmp_path / "100.hea").read_bytes() == b"existing header"
    assert (tmp_path / "100.dat").read_bytes() == b"existing waveform"
    assert not list(tmp_path.glob(".download-*"))

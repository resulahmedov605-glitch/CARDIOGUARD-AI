"""Offline tests use generated numerical fixtures, never clinical example data."""

from pathlib import Path

import numpy as np
import pytest
import wfdb
from fastapi.testclient import TestClient

from app.main import create_app
from app.services.ecg import ECGError, ECGService, get_ecg_service, sample_ceiling


@pytest.fixture
def dataset(tmp_path: Path) -> Path:
    samples = np.arange(2000)
    wfdb.wrsamp(
        "100", fs=100, units=["mV", "mV"], sig_name=["TEST_A", "TEST_B"],
        d_signal=np.column_stack((samples % 100, -(samples % 70))),
        fmt=["212", "212"], adc_gain=[200, 200], baseline=[0, 0],
        write_dir=str(tmp_path),
    )
    return tmp_path


@pytest.fixture
def client(dataset: Path):
    app = create_app()
    app.dependency_overrides[get_ecg_service] = lambda: ECGService(dataset)
    with TestClient(app) as test_client:
        yield test_client


def test_available_records(client: TestClient, dataset: Path) -> None:
    (dataset / "101.hea").write_text("not a registered record")
    response = client.get("/api/v1/ecg/records")
    assert response.status_code == 200
    assert [record["record_id"] for record in response.json()["records"]] == ["100"]
    assert response.json()["unavailable_records"] == []


def test_metadata(client: TestClient) -> None:
    response = client.get("/api/v1/ecg/records/100")
    assert response.status_code == 200
    data = response.json()
    assert data["sampling_frequency_hz"] == 100
    assert data["number_of_channels"] == 2
    assert data["duration_seconds"] == 20
    assert data["sample_count"] == 2000
    assert data["channels"] == [
        {"index": 0, "name": "TEST_A", "units": "mV"},
        {"index": 1, "name": "TEST_B", "units": "mV"},
    ]


@pytest.mark.parametrize("channel", [0, 1])
def test_signal_matches_wfdb_slice(client: TestClient, dataset: Path, channel: int) -> None:
    response = client.get(f"/api/v1/ecg/records/100/signal?channel={channel}&start_seconds=1.005&duration_seconds=0.1")
    assert response.status_code == 200
    data = response.json()
    assert data["start_sample"] == 101
    assert data["end_sample_exclusive"] == 111
    assert data["sample_count"] == 10
    assert data["timestamps_seconds"] == pytest.approx(np.arange(101, 111) / 100)
    expected = wfdb.rdrecord(str(dataset / "100"), sampfrom=101, sampto=111, channels=[channel])
    assert data["amplitudes"] == pytest.approx(expected.p_signal[:, 0])
    assert data["channel"]["index"] == channel


def test_final_sample_is_readable(client: TestClient) -> None:
    response = client.get("/api/v1/ecg/records/100/signal?start_seconds=19.99&duration_seconds=0.01")
    assert response.status_code == 200
    assert response.json()["sample_count"] == 1
    assert response.json()["timestamps_seconds"] == [19.99]


@pytest.mark.parametrize("record_id", ["101", "unknown", "%2E%2E%5Csecret", "%2Fetc%2Fpasswd"])
def test_unknown_and_traversal_ids(client: TestClient, record_id: str) -> None:
    assert client.get(f"/api/v1/ecg/records/{record_id}").status_code == 404
    assert client.get(f"/api/v1/ecg/records/{record_id}/signal").status_code == 404


@pytest.mark.parametrize("query", [
    "channel=-1", "channel=2", "channel=0.5", "channel=MLII",
    "start_seconds=-1", "start_seconds=20", "start_seconds=11&duration_seconds=10",
    "duration_seconds=0", "duration_seconds=-1", "duration_seconds=31",
    "duration_seconds=NaN", "start_seconds=inf", "start_seconds=not-a-number",
    "start_seconds=0.001&duration_seconds=0.001",
])
def test_invalid_selection(client: TestClient, query: str) -> None:
    response = client.get(f"/api/v1/ecg/records/100/signal?{query}")
    assert response.status_code == 422
    assert "detail" in response.json()


def test_missing_dataset(tmp_path: Path) -> None:
    app = create_app()
    app.dependency_overrides[get_ecg_service] = lambda: ECGService(tmp_path)
    with TestClient(app) as client:
        assert client.get("/api/v1/ecg/records").json()["records"] == []
        assert client.get("/api/v1/ecg/records").json()["unavailable_records"][0]["record_id"] == "100"
        for path in ("/100", "/100/signal"):
            response = client.get(f"/api/v1/ecg/records{path}")
            assert response.status_code == 503
            assert "missing" in response.json()["detail"]


@pytest.mark.parametrize("damage", ["header", "truncated", "reference", "symlink"])
def test_corrupted_or_unsafe_dataset(client: TestClient, dataset: Path, damage: str) -> None:
    header = dataset / "100.hea"
    if damage == "header":
        header.write_text("broken WFDB header\n")
    elif damage == "truncated":
        (dataset / "100.dat").write_bytes(b"broken")
    elif damage == "reference":
        header.write_text(header.read_text().replace("100.dat", "../secret.dat"))
    else:
        header.rename(dataset / "original.hea")
        header.symlink_to(dataset / "original.hea")
    assert client.get("/api/v1/ecg/records/100").status_code == 503
    assert client.get("/api/v1/ecg/records/100/signal").status_code == 503
    assert client.get("/api/v1/ecg/records").json()["records"] == []


def test_symlinked_data_directory_is_rejected(dataset: Path) -> None:
    link = dataset / "data-link"
    link.symlink_to(dataset, target_is_directory=True)
    with pytest.raises(ECGError, match="symlinks"):
        ECGService(link)


@pytest.mark.parametrize("fs", [100, 250, 360])
def test_sample_boundaries_absorb_roundoff_without_moving_off_grid_times(fs):
    for index in range(0, 650000, 137):
        boundary = index / fs
        assert sample_ceiling(boundary, fs) == index
        assert sample_ceiling(boundary + 1e-9, fs) == index + 1
        if index:
            assert sample_ceiling(boundary - 1e-9, fs) == index


@pytest.mark.parametrize("fs", [100, 250, 360])
@pytest.mark.parametrize("duration", [.5, 1])
def test_decimal_interval_reads_exact_samples(client, dataset, fs, duration):
    samples = np.arange(2000)
    wfdb.wrsamp("100", fs=fs, units=["mV", "mV"], sig_name=["A", "B"],
                d_signal=np.column_stack((samples % 100, samples % 70)),
                fmt=["212", "212"], adc_gain=[200, 200], baseline=[0, 0], write_dir=str(dataset))
    response = client.get("/api/v1/ecg/records/100/signal", params={
        "start_seconds": .55, "duration_seconds": duration,
    })
    assert response.status_code == 200
    signal = response.json()
    # 0.55 is on the sample grid at 100 and 360 Hz; 250 Hz starts at sample 138.
    start = {100: 55, 250: 138, 360: 198}[fs]
    count = round(fs * duration)
    assert signal["start_sample"] == start
    assert signal["end_sample_exclusive"] == start + count
    assert signal["sample_count"] == count
    expected = wfdb.rdrecord(str(dataset / "100"), sampfrom=start, sampto=start + count, channels=[0])
    assert signal["amplitudes"] == pytest.approx(expected.p_signal[:, 0])


def test_record_end_allows_roundoff_but_rejects_actual_overrun(client):
    response = client.get("/api/v1/ecg/records/100/signal", params={
        "start_seconds": 19.9, "duration_seconds": .100000000000001,
    })
    assert response.status_code == 200
    assert response.json()["end_sample_exclusive"] == 2000
    response = client.get("/api/v1/ecg/records/100/signal", params={
        "start_seconds": 19.9, "duration_seconds": .100000001,
    })
    assert response.status_code == 422

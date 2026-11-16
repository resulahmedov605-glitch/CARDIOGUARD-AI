"""Optional integration test against the actual downloaded PhysioNet record."""

import pytest
import wfdb
from fastapi.testclient import TestClient

from app.main import create_app
from app.dataset import DATA_DIRECTORY


@pytest.mark.skipif(not (DATA_DIRECTORY / "100.dat").is_file(), reason="Download MIT-BIH record 100 first")
def test_real_record_100_matches_wfdb() -> None:
    with TestClient(create_app()) as client:
        metadata = client.get("/api/v1/ecg/records/100")
        assert metadata.status_code == 200
        assert metadata.json()["sampling_frequency_hz"] == 360
        assert metadata.json()["sample_count"] == 650000
        assert [channel["name"] for channel in metadata.json()["channels"]] == ["MLII", "V5"]
        for channel in (0, 1):
            response = client.get(f"/api/v1/ecg/records/100/signal?channel={channel}&start_seconds=5&duration_seconds=2")
            assert response.status_code == 200
            signal = response.json()
            expected = wfdb.rdrecord(str(DATA_DIRECTORY / "100"), sampfrom=1800, sampto=2520, channels=[channel])
            assert signal["sample_count"] == 720
            assert signal["channel"]["units"] == "mV"
            assert signal["amplitudes"] == pytest.approx(expected.p_signal[:, 0])
            assert signal["timestamps_seconds"][0] == 5
            assert signal["timestamps_seconds"][-1] == pytest.approx(2519 / 360)

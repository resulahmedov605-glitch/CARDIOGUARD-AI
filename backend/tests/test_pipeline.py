"""Real local data exercise the full API pipeline; no generated medical results."""

import pytest
from fastapi.testclient import TestClient

from app.dataset import DATA_DIRECTORY, KNOWN_RECORDS, ECGService, get_ecg_service
from app.main import create_app
from app.ml import model_status


@pytest.mark.parametrize('record_id', KNOWN_RECORDS)
def test_real_dataset_to_combined_api(record_id):
    if not (DATA_DIRECTORY / f'{record_id}.dat').is_file() or not model_status()['available']:
        pytest.skip('Install real MIT-BIH data and train the local model')
    with TestClient(create_app()) as client:
        records = client.get('/api/v1/ecg/records').json()['records']
        assert record_id in [record['record_id'] for record in records]
        parameters = {'start_seconds': .55, 'duration_seconds': 10, 'channel': 0}
        raw = client.get(f'/api/v1/ecg/records/{record_id}/signal', params=parameters)
        assert raw.status_code == 200
        response = client.post('/api/v1/ecg/analyze', json={
            'record_id': record_id, **parameters, 'include_ai': True,
        })
        assert response.status_code == 200, response.text
        data = response.json()
        assert data['original_signal'] == raw.json()
        assert raw.json()['start_sample'] == 198
        assert len(data['filtered_amplitudes']) == raw.json()['sample_count'] == 3600
        stats = data['statistics']
        assert stats['peak_count'] >= 2
        assert len(stats['rr_seconds']) == stats['valid_interval_count'] == stats['peak_count'] - 1
        assert stats['average_bpm'] == pytest.approx(60 / stats['mean_rr_seconds'])
        ai = data['ai_classification']
        assert ai['beats']
        assert ai['detected_count'] == stats['peak_count']
        assert sum(ai['counts'].values()) + ai['skipped_count'] == stats['peak_count']
        peaks = {peak['record_sample_index']: peak for peak in data['detected_peaks']}
        for beat in ai['beats']:
            peak = peaks[beat['record_sample_index']]
            index = peak['interval_sample_index']
            assert index + raw.json()['start_sample'] == beat['record_sample_index']
            assert beat['timestamp_seconds'] == raw.json()['timestamps_seconds'][index]
            assert beat['filtered_amplitude'] == data['filtered_amplitudes'][index]
            assert sum(beat['probabilities'].values()) == pytest.approx(1)


def test_unexpected_failure_has_json_error_and_health_stays_available(monkeypatch):
    service = ECGService()

    def fail(*args):
        raise RuntimeError('Internal implementation detail')

    monkeypatch.setattr(service, 'available_records', fail)
    app = create_app()
    app.dependency_overrides[get_ecg_service] = lambda: service
    with TestClient(app, raise_server_exceptions=False) as client:
        response = client.get('/api/v1/ecg/records')
        assert response.status_code == 500
        assert 'backend log' in response.json()['detail']
        assert 'Internal implementation detail' not in response.text
        assert client.get('/api/v1/health').status_code == 200


def test_openapi_documents_combined_analysis_and_malformed_json_is_422():
    with TestClient(create_app()) as client:
        contract = client.get('/openapi.json')
        assert contract.status_code == 200
        assert 'include_ai' in contract.json()['components']['schemas']['AnalysisRequest']['properties']
        response = client.post('/api/v1/ecg/analyze', content='{broken', headers={'Content-Type': 'application/json'})
        assert response.status_code == 422
        assert response.json()['detail']

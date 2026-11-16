from pathlib import Path
import numpy as np
import pytest
import wfdb
from fastapi.testclient import TestClient
from test_ecg import dataset, client  # Reuse the offline WFDB fixtures.
from app.main import create_app
from app.dataset import ECGService,get_ecg_service,DATA_DIRECTORY
from app.analysis import analyze
from app.schemas import AnalysisRequest


def test_analysis_contract_preserves_raw_signal_and_sample_alignment(client):
    body={'record_id':'100','start_seconds':1,'duration_seconds':5,'channel':1}
    response=client.post('/api/v1/ecg/analyze',json=body)
    assert response.status_code==200,response.text
    data=response.json()
    raw=client.get('/api/v1/ecg/records/100/signal?channel=1&start_seconds=1&duration_seconds=5').json()
    assert data['original_signal']==raw
    assert len(data['filtered_amplitudes'])==len(raw['timestamps_seconds'])==500
    for peak in data['detected_peaks']:
        assert peak['record_sample_index']==100+peak['interval_sample_index']
        assert peak['timestamp_seconds']==pytest.approx(peak['record_sample_index']/100)
    assert data['reference_comparison'] is None
    assert any('not installed' in warning for warning in data['warnings'])


@pytest.mark.parametrize('change',[
 {'record_id':'999'}, {'channel':2}, {'start_seconds':-1}, {'duration_seconds':31},
 {'duration_seconds':.01}, {'start_seconds':19,'duration_seconds':5},
 {'preprocessing':{'lowpass_hz':50}}, {'preprocessing':{'order':2.5}},
 {'preprocessing':{'order':0}}, {'preprocessing':{'highpass_hz':10,'lowpass_hz':10}},
 {'preprocessing':{'highpass_hz':'NaN'}}, {'detection':{'refractory_seconds':0}},
 {'reference_tolerance_seconds':0}, {'record_id':'../100'}, {'unknown':1},
 {'preprocessing':{'normalization':'unsupported'}}])
def test_api_invalid_inputs(client,change):
    response=client.post('/api/v1/ecg/analyze',json={'record_id':'100',**change})
    assert response.status_code==(404 if change.get('record_id') in ('999','../100') else 422)


def test_missing_dataset_returns_503(tmp_path):
    app=create_app()
    app.dependency_overrides[get_ecg_service]=lambda:ECGService(tmp_path)
    with TestClient(app) as client:
        assert client.post('/api/v1/ecg/analyze',json={'record_id':'100'}).status_code==503
        assert client.get('/api/v1/health').status_code==200


def test_reference_beats_exclude_nonbeat_annotations_and_reject_symlinks(client,dataset):
    wfdb.wrann('100','atr',sample=np.array([5,100,180]),symbol=['+','N','V'],write_dir=str(dataset))
    data=client.post('/api/v1/ecg/analyze',json={'record_id':'100','duration_seconds':2}).json()
    assert data['reference_comparison']['reference_sample_indices']==[100,180]
    (dataset/'100.atr').rename(dataset/'original.atr')
    (dataset/'100.atr').symlink_to(dataset/'original.atr')
    data=client.post('/api/v1/ecg/analyze',json={'record_id':'100'}).json()
    assert data['reference_comparison'] is None
    assert any('Unsafe' in warning for warning in data['warnings'])


@pytest.mark.skipif(not (DATA_DIRECTORY/'100.atr').is_file(),reason='Optional official MIT-BIH annotations not installed')
def test_real_mitbih_reference_comparison():
    data=analyze(AnalysisRequest(record_id='100',duration_seconds=10),ECGService())
    reference=data.reference_comparison
    assert reference is not None and reference.reference_count==13
    assert reference.true_positives>=12 and reference.false_positives<=1
    assert data.statistics.average_bpm is not None


@pytest.mark.parametrize('gap',[False,True])
def test_flat_signal_has_no_invented_bpm_and_missing_samples_are_rejected(client,dataset,gap):
    values=np.zeros((2000,2),dtype=int)
    if gap: values[10,0]=-2048  # WFDB format-212 missing-sample sentinel.
    wfdb.wrsamp('100',fs=100,units=['mV','mV'],sig_name=['TEST_A','TEST_B'],
                d_signal=values,fmt=['212','212'],adc_gain=[200,200],baseline=[0,0],write_dir=str(dataset))
    response=client.post('/api/v1/ecg/analyze',json={'record_id':'100'})
    if gap:
        assert response.status_code==422
        assert 'gaps' in response.json()['detail']
    else:
        assert response.status_code==200
        stats=response.json()['statistics']
        assert stats['peak_count']==0 and stats['valid_interval_count']==0
        assert stats['average_bpm'] is None and stats['mean_rr_seconds'] is None


def test_corrupted_optional_reference_does_not_break_signal_analysis(client,dataset):
    (dataset/'100.atr').write_bytes(b'\x01')
    response=client.post('/api/v1/ecg/analyze',json={'record_id':'100'})
    assert response.status_code==200
    assert response.json()['reference_comparison'] is None
    assert any('unavailable' in message for message in response.json()['warnings'])


@pytest.mark.parametrize('invalid_body',[
    '{"record_id":"100","start_seconds":NaN}',
    '{"record_id":"100","duration_seconds":Infinity}',
    '{"record_id":"100","preprocessing":{"highpass_hz":-Infinity}}',
])
def test_nonfinite_json_numbers_return_serializable_validation_errors(client,invalid_body):
    response=client.post('/api/v1/ecg/analyze',content=invalid_body,headers={'Content-Type':'application/json'})
    assert response.status_code==422
    assert response.json()['detail']


@pytest.mark.parametrize('start', [.55, 1.1, 1.35, 19.5])
def test_minimum_analysis_interval_matches_raw_sample_grid(client, start):
    body = {'record_id': '100', 'start_seconds': start, 'duration_seconds': .5}
    raw = client.get('/api/v1/ecg/records/100/signal', params={
        'start_seconds': start, 'duration_seconds': .5,
    })
    response = client.post('/api/v1/ecg/analyze', json=body)
    assert response.status_code == 200, response.text
    assert response.json()['original_signal'] == raw.json()
    assert len(response.json()['filtered_amplitudes']) == 50


def test_optional_normalization_preserves_physical_signals_peaks_and_metrics(client):
    plain = client.post('/api/v1/ecg/analyze', json={'record_id': '100'}).json()
    response = client.post('/api/v1/ecg/analyze', json={
        'record_id': '100', 'preprocessing': {'normalization': 'zscore'},
    })
    assert response.status_code == 200
    data = response.json()
    assert plain['normalized_signal'] is None
    for field in ('original_signal', 'filtered_amplitudes', 'detected_peaks', 'statistics'):
        assert data[field] == plain[field]
    normalized = data['normalized_signal']
    assert normalized['units'] == 'dimensionless' and normalized['method'] == 'zscore'
    assert len(normalized['amplitudes']) == data['original_signal']['sample_count']
    assert np.mean(normalized['amplitudes']) == pytest.approx(0, abs=1e-14)
    assert np.std(normalized['amplitudes']) == pytest.approx(1)


def test_normalized_flat_signal_does_not_invent_peaks_or_bpm(client, dataset):
    wfdb.wrsamp('100', fs=100, units=['mV', 'mV'], sig_name=['A', 'B'],
                d_signal=np.zeros((2000, 2), dtype=int), fmt=['212', '212'],
                adc_gain=[200, 200], baseline=[0, 0], write_dir=str(dataset))
    response = client.post('/api/v1/ecg/analyze', json={
        'record_id': '100', 'preprocessing': {
            'highpass_hz': None, 'lowpass_hz': None, 'normalization': 'zscore',
        },
    })
    assert response.status_code == 200
    data = response.json()
    assert data['normalized_signal']['scale'] == 0
    assert data['normalized_signal']['amplitudes'] == [0] * 1000
    assert data['statistics']['average_bpm'] is None
    assert data['detected_peaks'] == []

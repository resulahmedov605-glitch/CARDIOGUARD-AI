"""Synthetic WFDB fixtures test software only; real metrics come from the CLI."""

import json
from pathlib import Path
import shutil

import numpy as np
import pytest
import wfdb
from fastapi.testclient import TestClient

from app.dataset import ECGError, ECGService, get_ecg_service
from app.main import create_app
from app.ml import (BEFORE, AFTER, FEATURE_NAMES, FS, beat_features, classify,
                    get_model_directory, load_model, model_status, validate_splits)
from app.schemas import PredictionRequest
from scripts.train_model import prepare_dataset, train

TEST_SPLITS = {"train": ["100"], "validation": ["106"], "test": ["119"]}


@pytest.fixture(scope="module")
def trained(tmp_path_factory):
    root = tmp_path_factory.mktemp('ml-software-fixture')
    data = root / 'data'
    data.mkdir()
    time = np.arange(FS * 8) / FS
    samples = np.arange(1, 8) * FS
    symbols = ['N', 'V', 'N', 'V', 'N', 'V', 'A']
    for record in ('100', '106', '119'):
        signal = np.zeros_like(time)
        for second, symbol in zip(range(1, 8), symbols):
            signal += (-1 if symbol == 'V' else 1) * np.exp(-.5 * ((time - second) / (.05 if symbol == 'V' else .012)) ** 2)
        wfdb.wrsamp(record, fs=FS, units=['mV', 'mV'], sig_name=['MLII', 'V1'],
                    p_signal=np.column_stack([signal, signal]), fmt=['212', '212'],
                    adc_gain=[200, 200], baseline=[0, 0], write_dir=str(data))
        wfdb.wrann(record, 'atr', sample=samples, symbol=symbols, write_dir=str(data))
    directory = root / 'models'
    service = ECGService(data)
    metadata = train(service, directory, TEST_SPLITS)
    return service, directory, metadata


@pytest.mark.parametrize('splits', [
    {'train': ['100'], 'validation': ['100'], 'test': ['106']},
    {'train': ['201'], 'validation': ['202'], 'test': ['100']},
    {'train': [], 'validation': ['100'], 'test': ['106']},
])
def test_patient_overlap_is_rejected(splits):
    with pytest.raises(ValueError, match='patient groups'):
        validate_splits(splits)


def test_feature_boundaries_flat_gaps_and_determinism():
    signal = np.sin(np.arange(1000) / 20)
    assert beat_features(signal, BEFORE - 1) is None
    assert beat_features(signal, len(signal) - AFTER + 1) is None
    assert beat_features(np.zeros(1000), 300) is None
    invalid = signal.copy()
    invalid[300] = np.nan
    assert beat_features(invalid, 300) is None
    features, beat = beat_features(signal, 300)
    assert features.shape == (len(FEATURE_NAMES),)
    assert len(beat) == BEFORE + AFTER
    assert np.mean(beat) == pytest.approx(0, abs=1e-14)
    assert np.std(beat) == pytest.approx(1)
    assert np.array_equal(features, beat_features(signal.copy(), 300)[0])


def test_preparation_excludes_unsupported_labels_and_isolates_groups(trained):
    service, _, _ = trained
    datasets, records = prepare_dataset(service, TEST_SPLITS)
    for split, data in datasets.items():
        assert set(data['labels']) == {'N', 'V'}
        assert set(data['groups']) == set(TEST_SPLITS[split])
        assert len(data['features']) == 6
    assert records['100']['excluded']['unsupported:A'] == 1
    assert records['100']['sampling_frequency_hz'] == FS


def test_training_serialization_and_probabilities(trained, tmp_path):
    service, directory, metadata = trained
    model, restored = load_model(directory)
    assert restored['version'] == metadata['version']
    assert model.class_weight == 'balanced_subsample'
    assert model.classes_.tolist() == ['N', 'V']
    result = classify(PredictionRequest(record_id='100', duration_seconds=8), service, directory)
    assert result['beats']
    for beat in result['beats']:
        assert sum(beat['probabilities'].values()) == pytest.approx(1)
        assert beat['timestamp_seconds'] == beat['record_sample_index'] / FS
        assert beat['label'] in ('N', 'V')
    assert sum(result['counts'].values()) == len(result['beats'])
    assert sum(result['proportions'].values()) == pytest.approx(1)
    repeated = train(service, tmp_path / 'repeated', TEST_SPLITS)
    assert repeated['version'] != metadata['version']
    assert repeated['records'] == metadata['records']
    assert repeated['evaluation'] == metadata['evaluation']
    model2, _ = load_model(tmp_path / 'repeated')
    x = np.load(directory / metadata['version'] / 'dataset.npz')['test_features']
    assert np.array_equal(model.predict_proba(x), model2.predict_proba(x))


def test_missing_annotations_fail_instead_of_inventing_labels(trained, tmp_path):
    service, _, _ = trained
    data = tmp_path / 'copied'
    shutil.copytree(service.data_directory, data)
    (data / '100.atr').unlink()
    with pytest.raises(ValueError, match='annotations are required'):
        prepare_dataset(ECGService(data), TEST_SPLITS)


@pytest.mark.parametrize('damage', ['checksum', 'feature_version', 'classes', 'symlink', 'algorithm', 'evaluation'])
def test_incompatible_artifacts_are_unavailable(trained, tmp_path, damage):
    _, directory, metadata = trained
    target = tmp_path / 'models'
    shutil.copytree(directory, target)
    folder = target / metadata['version']
    if damage == 'checksum':
        (folder / 'model.joblib').write_bytes(b'broken')
    elif damage == 'symlink':
        artifact = folder / 'model.joblib'
        artifact.rename(folder / 'other.joblib')
        artifact.symlink_to(folder / 'other.joblib')
    else:
        path = folder / 'metadata.json'
        data = json.loads(path.read_text())
        field = {'feature_version': 'feature_version', 'classes': 'supported_classes', 'algorithm': 'algorithm', 'evaluation': 'evaluation'}[damage]
        data[field] = 'invalid'
        path.write_text(json.dumps(data))
    assert model_status(target)['available'] is False
    with pytest.raises(ECGError) as error:
        load_model(target)
    assert error.value.status_code == 503


def test_api_prediction_contract_errors_and_missing_model(trained, tmp_path):
    service, directory, metadata = trained
    app = create_app()
    app.dependency_overrides[get_ecg_service] = lambda: service
    app.dependency_overrides[get_model_directory] = lambda: directory
    with TestClient(app) as client:
        assert client.get('/api/v1/ai/model').json()['version'] == metadata['version']
        response = client.post('/api/v1/ai/predict', json={'record_id': '100', 'duration_seconds': 8})
        assert response.status_code == 200, response.text
        data = response.json()
        assert len(data['filtered_amplitudes']) == data['original_signal']['sample_count']
        assert data['model_version'] == metadata['version']
        for changes, status in [({'duration_seconds': 31}, 422), ({'channel': 1}, 422),
                                ({'record_id': '../100'}, 404), ({'channel': -1}, 422),
                                ({'start_seconds': 'NaN'}, 422), ({'unknown': 1}, 422)]:
            assert client.post('/api/v1/ai/predict', json={'record_id': '100', **changes}).status_code == status
        app.dependency_overrides[get_model_directory] = lambda: tmp_path / 'missing'
        assert client.get('/api/v1/ai/model').json()['available'] is False
        assert client.post('/api/v1/ai/predict', json={'record_id': '100'}).status_code == 503


def test_real_model_and_data_if_installed():
    status = model_status()
    if not status['available']:
        pytest.skip('Run the real training command first')
    result = classify(PredictionRequest(record_id='208', duration_seconds=10), ECGService())
    assert result['model_version'] == status['version']
    assert result['beats'] and all(beat['label'] in ('N', 'V') for beat in result['beats'])


@pytest.mark.parametrize('gapped', [False, True])
def test_flat_and_missing_samples_do_not_become_predictions(trained, tmp_path, gapped):
    _, directory, _ = trained
    values = np.zeros((FS * 3, 2), dtype=int)
    if gapped:
        values[100, 0] = -2048
    wfdb.wrsamp('100', fs=FS, units=['mV', 'mV'], sig_name=['MLII', 'V1'],
                d_signal=values, fmt=['212', '212'], adc_gain=[200, 200], baseline=[0, 0], write_dir=str(tmp_path))
    request = PredictionRequest(record_id='100', duration_seconds=3)
    if gapped:
        with pytest.raises(ECGError) as error:
            classify(request, ECGService(tmp_path), directory)
        assert error.value.status_code == 422
    else:
        result = classify(request, ECGService(tmp_path), directory)
        assert result['beats'] == [] and result['proportions'] == {'N': None, 'V': None}


def test_inference_never_reads_reference_labels(trained, monkeypatch):
    service, directory, _ = trained
    def forbidden(*args):
        raise AssertionError('Inference must not read reference labels')
    monkeypatch.setattr(service, 'annotations', forbidden)
    assert classify(PredictionRequest(record_id='100', duration_seconds=8), service, directory)['beats']


def test_model_processing_failure_is_an_actionable_503(trained, monkeypatch):
    from app import ml
    service, directory, metadata = trained
    class BrokenModel:
        def predict(self, values):
            raise ValueError('Incompatible estimator')
    monkeypatch.setattr(ml, 'load_model', lambda directory: (BrokenModel(), metadata))
    with pytest.raises(ECGError) as error:
        classify(PredictionRequest(record_id='100', duration_seconds=8), service, directory)
    assert error.value.status_code == 503

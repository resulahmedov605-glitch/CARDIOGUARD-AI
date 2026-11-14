"""Controlled numerical test signals only; not application or patient data."""
import numpy as np
import pytest
from app.processing.ecg import FilterConfig, DetectionConfig, preprocess, detect_peaks, rr_statistics, compare_peaks, normalize


@pytest.mark.parametrize('fs', [250, 360])
def test_filter_reduces_baseline_and_high_frequency_noise_preserving_passband(fs):
    t = np.arange(fs * 30) / fs
    clean = np.sin(2 * np.pi * 10 * t)
    mixed = clean + .8 * np.sin(2 * np.pi * .15 * t) + .5 * np.sin(2 * np.pi * 80 * t)
    saved = mixed.copy()
    filtered = preprocess(mixed, fs)
    interior = slice(fs * 5, -fs * 5)
    assert np.sqrt(np.mean((filtered[interior] - clean[interior]) ** 2)) < .04
    assert np.array_equal(saved, mixed)
    assert filtered.shape == mixed.shape
    assert abs(np.argmax(np.correlate(filtered[interior], clean[interior], mode='full')) - (len(clean[interior]) - 1)) <= 1


@pytest.mark.parametrize('values,fs', [([],360),([1,np.nan],360),([1,np.inf],360),([[1,2]],360),([1,2],0),([1,2],float('nan')),([1,2],40)])
def test_reject_invalid_signal_and_sampling(values, fs):
    with pytest.raises(ValueError):
        preprocess(values, fs)


@pytest.mark.parametrize('config', [FilterConfig(order=0),FilterConfig(order=1.5),FilterConfig(highpass_hz=-1),FilterConfig(lowpass_hz=180),FilterConfig(highpass_hz=40,lowpass_hz=20),FilterConfig(highpass_hz=float('nan'))])
def test_filter_config_validation(config):
    with pytest.raises(ValueError):
        preprocess(np.arange(1000),360,config)


def test_short_signal_is_rejected_and_disabled_filter_copies():
    with pytest.raises(ValueError, match='short'):
        preprocess([1,2,3],360)
    x = np.arange(100.)
    y = preprocess(x,360,FilterConfig(None,None))
    assert np.array_equal(x,y) and not np.shares_memory(x,y)


@pytest.mark.parametrize('fs', [250,360])
@pytest.mark.parametrize('polarity', [1,-1])
def test_peak_locations_with_noise_t_waves_and_inverted_polarity(fs,polarity):
    t = np.arange(fs*10)/fs
    expected = np.arange(1,9,.8)
    x = .015*np.random.default_rng(42).normal(size=t.size)
    for beat in expected:
        x += polarity * (np.exp(-.5*((t-beat)/.012)**2) + .25*np.exp(-.5*((t-beat-.25)/.06)**2))
    peaks = detect_peaks(preprocess(x,fs),fs)
    assert peaks/fs == pytest.approx(expected,abs=2/fs)
    assert np.all(np.diff(peaks)/fs >= .25)


def test_flat_and_noisy_signals_and_detector_bounds():
    assert len(detect_peaks(np.zeros(3600),360)) == 0
    peaks=detect_peaks(np.random.default_rng(7).normal(size=3600),360)
    assert np.all(np.diff(peaks) >= 90)
    with pytest.raises(ValueError):
        detect_peaks(np.zeros(360),360,DetectionConfig(refractory_seconds=0))
    with pytest.raises(ValueError):
        detect_peaks([1,2],360)


def test_rr_and_bpm_numerical_accuracy():
    result = rr_statistics([0,288,576],360)
    assert result['rr_seconds'] == pytest.approx([.8,.8])
    assert result['rr_milliseconds'] == pytest.approx([800,800])
    assert result['instantaneous_bpm'] == pytest.approx([75,75])
    assert result['average_bpm'] == pytest.approx(75)
    assert result['std_rr_seconds'] == 0
    varying = rr_statistics([0,180,540],360)
    assert varying['average_bpm'] == pytest.approx(80)
    assert varying['min_rr_seconds'] == .5 and varying['max_rr_seconds'] == 1


@pytest.mark.parametrize('peaks',[[],[1]])
def test_insufficient_peaks_do_not_invent_statistics(peaks):
    result=rr_statistics(peaks,360)
    assert result['average_bpm'] is None and result['mean_rr_seconds'] is None
    assert result['rr_seconds'] == [] and result['valid_interval_count'] == 0


@pytest.mark.parametrize('peaks',[[1,1],[2,1],[-1,1],[1.5,2],[float('inf')]])
def test_invalid_rr_indices(peaks):
    with pytest.raises(ValueError): rr_statistics(peaks,360)


def test_reference_matching_is_one_to_one_and_has_configurable_tolerance():
    result=compare_peaks([100,105,400],[102,300],100,.05)
    assert (result['true_positives'],result['false_positives'],result['false_negatives'])==(1,2,1)
    assert result['sensitivity']==.5 and result['positive_predictivity']==pytest.approx(1/3)
    assert compare_peaks([100],[110],100,.1)['true_positives']==1
    assert compare_peaks([100],[110],100,.09)['true_positives']==0
    assert compare_peaks([],[],100)['sensitivity'] is None


def test_normalization_has_zero_mean_unit_population_variance_and_preserves_input():
    values = np.array([1., 2., 3., 6.])
    saved = values.copy()
    result, offset, scale = normalize(values, 360)
    assert np.mean(result) == pytest.approx(0, abs=1e-14)
    assert np.std(result, ddof=0) == pytest.approx(1)
    assert offset == pytest.approx(np.mean(values))
    assert scale == pytest.approx(np.std(values, ddof=0))
    assert result * scale + offset == pytest.approx(values)
    assert np.array_equal(values, saved) and not np.shares_memory(result, values)


@pytest.mark.parametrize("value", [0., 3., -5.])
def test_constant_normalization_is_finite_and_zero(value):
    result, offset, scale = normalize(np.full(180, value), 360)
    assert np.array_equal(result, np.zeros(180))
    assert offset == value and scale == 0


def test_normalization_handles_large_finite_values_without_overflow():
    result, offset, scale = normalize([-1e308, 0, 1e308], 360)
    assert np.isfinite(result).all() and np.isfinite(offset) and np.isfinite(scale)
    assert np.std(result) == pytest.approx(1)


@pytest.mark.parametrize("values", [[], [1, np.nan], [1, np.inf], [[1, 2]]])
def test_normalization_rejects_invalid_samples(values):
    with pytest.raises(ValueError):
        normalize(values, 360)

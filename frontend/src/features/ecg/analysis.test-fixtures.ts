// Small numerical fixtures for automated tests only, never application ECG data.
import type { ECGAnalysis } from '../../lib/analysis'
import type { ECGSignalResponse } from '../../lib/ecg'

export const signalFixture: ECGSignalResponse = {
  record_id: '100', channel: { index: 0, name: 'TEST', units: 'mV' }, sampling_frequency_hz: 100,
  requested_start_seconds: 0, requested_duration_seconds: 10,
  start_sample: 0, end_sample_exclusive: 1000, start_seconds: 0, duration_seconds: 10, sample_count: 1000,
  timestamps_seconds: Array.from({length:1000},(_,i)=>i/100),
  amplitudes: Array.from({length:1000},(_,i)=>[80,160,240].includes(i)?1:0),
}
export const analysisFixture: ECGAnalysis = {
  record: { record_id: '100', source: 'TEST FIXTURE', sampling_frequency_hz: 100, number_of_channels: 1,
    channels: [signalFixture.channel], sample_count: 2000, duration_seconds: 20 },
  parameters: { record_id: '100', channel: 0, start_seconds: 0, duration_seconds: 10,
    preprocessing: { highpass_hz: .5, lowpass_hz: 40, order: 3 }, detection: { refractory_seconds: .25, threshold_scale: .35 } },
  original_signal: signalFixture, filtered_amplitudes: signalFixture.amplitudes.map((value)=>(value??0)*.9),
  detected_peaks: [80,160,240].map((i)=>({interval_sample_index:i,record_sample_index:i,timestamp_seconds:i/100,filtered_amplitude:.9})),
  statistics: { peak_count: 3, valid_interval_count: 2, average_bpm: 75, mean_rr_seconds: .8,
    min_rr_seconds: .8, max_rr_seconds: .8, std_rr_seconds: 0,
    rr_seconds: [.8,.8], rr_milliseconds: [800,800], instantaneous_bpm: [75,75] },
  reference_comparison: null, warnings: ['Test-only analysis warning.'],
}

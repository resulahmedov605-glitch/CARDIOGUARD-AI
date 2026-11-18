import type { ECGRecordMetadata, ECGSignalResponse } from './ecg'
import type { ClassificationResult } from './ai'

export interface AnalysisRequest {
  record_id: string
  channel: number
  start_seconds: number
  duration_seconds: number
  preprocessing: {
    highpass_hz: number | null
    lowpass_hz: number | null
    order: number
    normalization: 'none' | 'zscore'
  }
  detection: { refractory_seconds: number; threshold_scale: number }
  include_ai?: boolean
}

export interface ECGAnalysis {
  record: ECGRecordMetadata
  parameters: AnalysisRequest
  original_signal: ECGSignalResponse
  filtered_amplitudes: number[]
  normalized_signal: {
    method: 'zscore'
    units: 'dimensionless'
    offset: number
    scale: number
    amplitudes: number[]
  } | null
  detected_peaks: {
    interval_sample_index: number
    record_sample_index: number
    timestamp_seconds: number
    filtered_amplitude: number
  }[]
  statistics: {
    peak_count: number
    valid_interval_count: number
    average_bpm: number | null
    mean_rr_seconds: number | null
    min_rr_seconds: number | null
    max_rr_seconds: number | null
    std_rr_seconds: number | null
    rr_seconds: number[]
    rr_milliseconds: number[]
    instantaneous_bpm: number[]
  }
  reference_comparison: {
    source: string
    reference_count: number
    true_positives: number
    false_positives: number
    false_negatives: number
    sensitivity: number | null
    positive_predictivity: number | null
    tolerance_seconds: number
  } | null
  warnings: string[]
  ai_classification?: ClassificationResult | null
}

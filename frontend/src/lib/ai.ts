import type { ECGSignalResponse } from './ecg'

export type BeatLabel = 'N' | 'V'

export interface ModelStatus {
  available: boolean
  version: string | null
  supported_classes: BeatLabel[]
  message?: string | null
  splits?: Record<string, string[]> | null
  evaluation?: {
    test: {
      accuracy: number
      per_class: Record<
        BeatLabel,
        { precision: number; recall: number; 'f1-score': number; support: number }
      >
    }
  } | null
}

export interface ClassificationResult {
  model_version: string
  supported_classes: BeatLabel[]
  beats: {
    label: BeatLabel
    record_sample_index: number
    timestamp_seconds: number
    filtered_amplitude: number
    probabilities: Record<BeatLabel, number>
  }[]
  counts: Record<BeatLabel, number>
  proportions: Record<BeatLabel, number | null>
  detected_count: number
  skipped_count: number
  warnings: string[]
}

export interface PredictionResult extends ClassificationResult {
  original_signal: ECGSignalResponse
  filtered_amplitudes: number[]
}

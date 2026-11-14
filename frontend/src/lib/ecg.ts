export interface ECGChannel {
  index: number
  name: string
  units: string | null
}

export interface ECGRecordMetadata {
  record_id: string
  source: string
  sampling_frequency_hz: number
  number_of_channels: number
  channels: ECGChannel[]
  sample_count: number
  duration_seconds: number
}

export interface ECGRecordsResponse {
  records: ECGRecordMetadata[]
  unavailable_records: { record_id: string; reason: string }[]
}

export interface ECGSignalResponse {
  record_id: string
  channel: ECGChannel
  sampling_frequency_hz: number
  requested_start_seconds: number
  requested_duration_seconds: number
  start_sample: number
  end_sample_exclusive: number
  start_seconds: number
  duration_seconds: number
  sample_count: number
  timestamps_seconds: number[]
  amplitudes: (number | null)[]
}

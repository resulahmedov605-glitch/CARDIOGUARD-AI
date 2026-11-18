import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { SignalAnalysis } from './SignalAnalysis'
import { signalFixture, analysisFixture } from './analysis.test-fixtures'

vi.mock('./ECGChart', () => ({
  default: ({ analysis, predictions }: { analysis?: unknown; predictions?: unknown }) => (
    <div role="img" aria-label={predictions ? 'Classified waveform' : analysis ? 'Analyzed waveform' : 'Original waveform'} />
  ),
}))
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

test('analysis is explicit, submits selected parameters, and displays actual returned statistics', async () => {
  const fetcher = vi.fn(async () => Response.json(analysisFixture))
  vi.stubGlobal('fetch', fetcher)
  render(<SignalAnalysis signal={signalFixture} />)
  expect(fetcher).not.toHaveBeenCalled()
  fireEvent.change(screen.getByLabelText('High-pass (Hz)'), { target: { value: '0.8' } })
  expect(fetcher).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Run analysis' }))
  const stats = within(await screen.findByLabelText('Estimated heartbeat statistics'))
  expect(stats.getByText('75.0')).toBeTruthy()
  expect(stats.getByText('0.800')).toBeTruthy()
  expect(fetcher).toHaveBeenCalledTimes(1)
  const [url, options] = fetcher.mock.calls[0] as unknown as [string, RequestInit]
  expect(url).toBe('/api/v1/ecg/analyze')
  expect(options.method).toBe('POST')
  expect(JSON.parse(options.body as string)).toMatchObject({
    record_id: '100',
    channel: 0,
    duration_seconds: 10,
    preprocessing: { highpass_hz: 0.8 },
  })
})

test('loading and request errors clear estimates and allow retry', async () => {
  let rejectRequest: (error: Error) => void = () => {}
  const fetcher = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectRequest = reject
        }),
    )
    .mockImplementation(async () => Response.json(analysisFixture))
  vi.stubGlobal('fetch', fetcher)
  render(<SignalAnalysis signal={signalFixture} />)
  fireEvent.click(screen.getByRole('button', { name: 'Run analysis' }))
  expect(screen.getByRole('button', { name: 'Analyzing…' }).hasAttribute('disabled')).toBe(true)
  expect(screen.queryByLabelText('Estimated heartbeat statistics')).toBeNull()
  rejectRequest(new Error('Backend unavailable'))
  expect((await screen.findByRole('alert')).textContent).toContain('Backend unavailable')
  fireEvent.click(screen.getByRole('button', { name: 'Retry analysis' }))
  expect(
    within(await screen.findByLabelText('Estimated heartbeat statistics')).getByText('75.0'),
  ).toBeTruthy()
})

test('insufficient data stays absent rather than displaying a numeric substitute', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      Response.json({
        ...analysisFixture,
        detected_peaks: analysisFixture.detected_peaks.slice(0, 1),
        statistics: {
          average_bpm: null,
          mean_rr_seconds: null,
          min_rr_seconds: null,
          max_rr_seconds: null,
          std_rr_seconds: null,
          rr_seconds: [],
          rr_milliseconds: [],
          instantaneous_bpm: [],
          peak_count: 1,
          valid_interval_count: 0,
        },
      }),
    ),
  )
  render(<SignalAnalysis signal={signalFixture} />)
  fireEvent.click(screen.getByRole('button', { name: 'Run analysis' }))
  await waitFor(() =>
    expect(
      within(screen.getByLabelText('Estimated heartbeat statistics')).getAllByText(
        'Insufficient data',
      ).length,
    ).toBe(2),
  )
  expect(screen.queryByText('75.0')).toBeNull()
})

test('invalid cutoffs do not send analysis requests', () => {
  const fetcher = vi.fn()
  vi.stubGlobal('fetch', fetcher)
  render(<SignalAnalysis signal={signalFixture} />)
  fireEvent.change(screen.getByLabelText('Low-pass (Hz)'), { target: { value: '50' } })
  fireEvent.submit(screen.getByRole('form', { name: 'ECG analysis controls' }))
  expect(screen.getByRole('alert').textContent).toContain('Nyquist')
  expect(fetcher).not.toHaveBeenCalled()
})

test('undefined reference metrics display insufficient data without a percentage', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      Response.json({
        ...analysisFixture,
        reference_comparison: {
          source: 'TEST REFERENCES',
          reference_count: 0,
          true_positives: 0,
          false_positives: 3,
          false_negatives: 0,
          sensitivity: null,
          positive_predictivity: 0,
          tolerance_seconds: 0.1,
        },
      }),
    ),
  )
  render(<SignalAnalysis signal={signalFixture} />)
  fireEvent.click(screen.getByRole('button', { name: 'Run analysis' }))
  expect(
    await screen.findByText(
      /Selected-interval sensitivity: Insufficient data · positive predictivity: 0.0%/,
    ),
  ).toBeTruthy()
  expect(screen.queryByText(/Insufficient data%/)).toBeNull()
})

test('normalization is submitted explicitly and explains its separate units', async () => {
  const fetcher = vi.fn(async () =>
    Response.json({
      ...analysisFixture,
      normalized_signal: {
        method: 'zscore',
        units: 'dimensionless',
        offset: 0,
        scale: 1,
        amplitudes: analysisFixture.filtered_amplitudes,
      },
    }),
  )
  vi.stubGlobal('fetch', fetcher)
  render(<SignalAnalysis signal={signalFixture} />)
  fireEvent.change(screen.getByLabelText('Normalization'), { target: { value: 'zscore' } })
  expect(fetcher).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Run analysis' }))
  expect(await screen.findByText(/right-hand axis is dimensionless/)).toBeTruthy()
  const [, options] = fetcher.mock.calls[0] as unknown as [string, RequestInit]
  expect(JSON.parse(options.body as string).preprocessing.normalization).toBe('zscore')
})

test('combined AI analysis uses model settings and displays returned BPM and classification together', async () => {
  const classification = {
    model_version: 'test-model', supported_classes: ['N', 'V'],
    beats: [{ label: 'V', record_sample_index: 80, timestamp_seconds: 80 / 360,
      filtered_amplitude: 0.9, probabilities: { N: 0.2, V: 0.8 } }],
    counts: { N: 0, V: 1 }, proportions: { N: 0, V: 1 }, detected_count: 3,
    skipped_count: 2, warnings: ['Test research estimates'],
  }
  const fetcher = vi.fn(async () => Response.json({ ...analysisFixture, ai_classification: classification }))
  vi.stubGlobal('fetch', fetcher)
  render(<SignalAnalysis signal={{ ...signalFixture, channel: { index: 0, name: 'MLII', units: 'mV' }, sampling_frequency_hz: 360 }} />)
  fireEvent.change(screen.getByLabelText('High-pass (Hz)'), { target: { value: '0.8' } })
  fireEvent.click(screen.getByRole('button', { name: 'Analyze with AI' }))
  expect(await screen.findByLabelText('Classification counts')).toBeTruthy()
  expect(screen.getByLabelText('Estimated heartbeat statistics').textContent).toContain('75.0')
  expect(screen.getByText('Model test-model')).toBeTruthy()
  expect(await screen.findByRole('img', { name: 'Classified waveform' })).toBeTruthy()
  const [, options] = fetcher.mock.calls[0] as unknown as [string, RequestInit]
  expect(JSON.parse(options.body as string)).toMatchObject({
    include_ai: true, preprocessing: { highpass_hz: 0.5, lowpass_hz: 40, order: 3 },
    detection: { refractory_seconds: 0.25, threshold_scale: 0.35 },
  })
  expect((screen.getByLabelText('High-pass (Hz)') as HTMLInputElement).value).toBe('0.5')
  expect(fetcher).toHaveBeenCalledTimes(1)
})

test('AI request failures retain the original waveform and allow a regular analysis', async () => {
  const fetcher = vi.fn()
    .mockResolvedValueOnce(Response.json({ detail: 'Model unavailable' }, { status: 503 }))
    .mockImplementation(async () => Response.json(analysisFixture))
  vi.stubGlobal('fetch', fetcher)
  render(<SignalAnalysis signal={{ ...signalFixture, channel: { index: 0, name: 'MLII', units: 'mV' }, sampling_frequency_hz: 360 }} />)
  fireEvent.click(screen.getByRole('button', { name: 'Analyze with AI' }))
  expect((await screen.findByRole('alert')).textContent).toContain('Model unavailable')
  expect(screen.queryByLabelText('Classification counts')).toBeNull()
  expect(await screen.findByRole('img', { name: 'Original waveform' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Run analysis' }))
  expect(await screen.findByLabelText('Estimated heartbeat statistics')).toBeTruthy()
  expect(screen.queryByLabelText('Classification counts')).toBeNull()
})

test('unsupported leads and sampling rates disable AI classification', () => {
  render(<SignalAnalysis signal={signalFixture} />)
  expect(screen.getByRole('button', { name: 'Analyze with AI' }).hasAttribute('disabled')).toBe(true)
  expect(screen.getByRole('button', { name: 'Run analysis' }).hasAttribute('disabled')).toBe(false)
})

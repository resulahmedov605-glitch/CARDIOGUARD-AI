import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { SignalAnalysis } from './SignalAnalysis'
import { signalFixture, analysisFixture } from './analysis.test-fixtures'

vi.mock('./ECGChart', () => ({
  default: ({ analysis }: { analysis?: unknown }) => (
    <div role="img" aria-label={analysis ? 'Analyzed waveform' : 'Original waveform'} />
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

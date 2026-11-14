import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { ECGAnalyzer } from './ECGAnalyzer'
import type { ECGRecordMetadata, ECGSignalResponse } from '../../lib/ecg'

// Numerical test fixture only. Real plotting is verified separately with record 100.
const metadata: ECGRecordMetadata = {
  record_id: '100', source: 'TEST FIXTURE', sampling_frequency_hz: 100,
  number_of_channels: 2, channels: [{ index: 0, name: 'TEST_A', units: 'mV' }, { index: 1, name: 'TEST_B', units: 'mV' }],
  sample_count: 2000, duration_seconds: 20,
}
vi.mock('./ECGChart', () => ({
  default: ({ signal }: { signal: ECGSignalResponse }) => (
    <div role="img" aria-label="Test waveform">{signal.channel.name}: {signal.amplitudes.join(',')} at {signal.timestamps_seconds.join(',')}</div>
  ),
}))

function mockAPI() {
  return vi.fn(async (url: string) => {
    if (url === '/api/v1/ecg/records') return Response.json({ records: [metadata], unavailable_records: [] })
    if (url.includes('/signal?')) {
      const params = new URL(url, 'http://localhost').searchParams
      const channel = Number(params.get('channel'))
      const start = Number(params.get('start_seconds'))
      const duration = Number(params.get('duration_seconds'))
      return Response.json({
        record_id: '100', channel: metadata.channels[channel], sample_count: 2, sampling_frequency_hz: 100,
        start_seconds: start, duration_seconds: duration,
        timestamps_seconds: [start, start + 0.01], amplitudes: channel === 0 ? [0.1, 0.2] : [-0.3, -0.4],
      })
    }
    return Response.json(metadata)
  })
}

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers() })

test('loads record selection, metadata, amplitudes and timestamps', async () => {
  vi.stubGlobal('fetch', mockAPI())
  render(<ECGAnalyzer />)
  const chart = await screen.findByRole('img', { name: 'Test waveform' })
  expect(chart.textContent).toContain('TEST_A: 0.1,0.2 at 0,0.01')
  expect((screen.getByLabelText('ECG record') as HTMLSelectElement).value).toBe('100')
  expect(screen.getByText('TEST_A, TEST_B')).toBeTruthy()
})

test('channel changes and interval updates request the selected data', async () => {
  const fetcher = mockAPI()
  vi.stubGlobal('fetch', fetcher)
  render(<ECGAnalyzer />)
  await screen.findByRole('img', { name: 'Test waveform' })
  fireEvent.change(screen.getByLabelText('Channel'), { target: { value: '1' } })
  await waitFor(() => expect(screen.getByRole('img').textContent).toContain('TEST_B: -0.3,-0.4'))
  fireEvent.change(screen.getByLabelText('Start time (s)'), { target: { value: '5' } })
  fireEvent.change(screen.getByLabelText('Duration (s)'), { target: { value: '2' } })
  fireEvent.click(screen.getByRole('button', { name: 'Update interval' }))
  await waitFor(() => expect(screen.getByRole('img').textContent).toContain('at 5,5.01'))
  expect(fetcher.mock.calls.some(([url]) => url.includes('channel=1&start_seconds=5&duration_seconds=2'))).toBe(true)
})

test('shows loading, then an actionable error and retries', async () => {
  const fetcher = mockAPI()
  let rejectRequest: (error: Error) => void = () => {}
  fetcher.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectRequest = reject }))
  vi.stubGlobal('fetch', fetcher)
  render(<ECGAnalyzer />)
  expect(screen.getByRole('status').textContent).toContain('Finding local ECG records')
  rejectRequest(new Error('Backend is offline'))
  expect((await screen.findByRole('alert')).textContent).toContain('Backend is offline')
  expect(screen.queryByRole('img')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  expect(await screen.findByRole('img', { name: 'Test waveform' })).toBeTruthy()
})

test('empty local dataset explains how to download; no waveform is substituted', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ records: [], unavailable_records: [{ record_id: '100', reason: 'Local dataset is missing.' }] })))
  render(<ECGAnalyzer />)
  expect(await screen.findByText('No readable local ECG records')).toBeTruthy()
  expect(screen.getByText('python -m scripts.download_mitbih')).toBeTruthy()
  expect(screen.queryByRole('img')).toBeNull()
})

test('invalid interval is rejected without a new signal request', async () => {
  const fetcher = mockAPI()
  vi.stubGlobal('fetch', fetcher)
  render(<ECGAnalyzer />)
  await screen.findByRole('img', { name: 'Test waveform' })
  const count = fetcher.mock.calls.length
  fireEvent.change(screen.getByLabelText('Start time (s)'), { target: { value: '19' } })
  fireEvent.submit(screen.getByRole('form', { name: 'Signal interval controls' }))
  expect(screen.getByRole('alert').textContent).toContain('within the record')
  expect(fetcher.mock.calls).toHaveLength(count)
})

test('a signal request failure clears the graph and can be retried', async () => {
  const success = mockAPI()
  vi.stubGlobal('fetch', vi.fn(async (url: string) => url.includes('/signal?')
    ? Response.json({ detail: 'Dataset is corrupted.' }, { status: 503 }) : success(url)))
  render(<ECGAnalyzer />)
  expect((await screen.findByRole('alert')).textContent).toContain('Dataset is corrupted.')
  expect(screen.queryByRole('img')).toBeNull()
  vi.stubGlobal('fetch', success)
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  expect(await screen.findByRole('img', { name: 'Test waveform' })).toBeTruthy()
})

test('a late response from the old channel cannot overwrite the selected channel', async () => {
  const success = mockAPI()
  let resolveOld: (response: Response) => void = () => {}
  vi.stubGlobal('fetch', vi.fn((url: string) => url.includes('/signal?channel=0')
    ? new Promise<Response>((resolve) => { resolveOld = resolve }) : success(url)))
  render(<ECGAnalyzer />)
  await screen.findByLabelText('Channel')
  fireEvent.change(screen.getByLabelText('Channel'), { target: { value: '1' } })
  await waitFor(() => expect(screen.getByRole('img').textContent).toContain('TEST_B'))
  await act(async () => resolveOld(await success('/api/v1/ecg/records/100/signal?channel=0&start_seconds=0&duration_seconds=10')))
  expect(screen.getByRole('img').textContent).toContain('TEST_B')
})

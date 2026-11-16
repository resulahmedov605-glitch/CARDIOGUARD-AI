import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { AILab } from './AILab'
import type { PredictionResult } from '../../lib/ai'
import { signalFixture } from '../ecg/analysis.test-fixtures'

vi.mock('../ecg/ECGChart', () => ({
  default: () => <div role="img" aria-label="Classified waveform" />,
}))
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const model = { available: true, version: 'test-model-version', supported_classes: ['N', 'V'] }
const record = {
  record_id: '100',
  source: 'TEST',
  sampling_frequency_hz: 360,
  number_of_channels: 1,
  channels: [{ index: 0, name: 'MLII', units: 'mV' }],
  sample_count: 7200,
  duration_seconds: 20,
}
const prediction: PredictionResult = {
  model_version: model.version,
  supported_classes: ['N', 'V'],
  original_signal: { ...signalFixture, channel: record.channels[0], sampling_frequency_hz: 360 },
  filtered_amplitudes: signalFixture.amplitudes.map((value) => value ?? 0),
  beats: [
    {
      label: 'N',
      record_sample_index: 360,
      timestamp_seconds: 1,
      filtered_amplitude: 1,
      probabilities: { N: 0.9, V: 0.1 },
    },
    {
      label: 'V',
      record_sample_index: 720,
      timestamp_seconds: 2,
      filtered_amplitude: -0.8,
      probabilities: { N: 0.2, V: 0.8 },
    },
  ],
  counts: { N: 1, V: 1 },
  proportions: { N: 0.5, V: 0.5 },
  detected_count: 2,
  skipped_count: 0,
  warnings: ['TEST: research estimates only'],
}

function mockAPI(
  status = model,
  predict: (options?: RequestInit) => Promise<Response> = async () => Response.json(prediction),
) {
  const post = vi.fn(predict)
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, options?: RequestInit) => {
      if (url === '/api/v1/ai/model') return Response.json(status)
      if (url === '/api/v1/ecg/records')
        return Response.json({ records: [record], unavailable_records: [] })
      if (url === '/api/v1/ai/predict') return post(options)
      throw new Error('Unexpected request')
    }),
  )
  return post
}

test('loads the real API contract, submits only on request and displays returned counts', async () => {
  const post = mockAPI()
  render(<AILab />)
  expect(await screen.findByText('Model version: test-model-version')).toBeTruthy()
  expect(post).not.toHaveBeenCalled()
  fireEvent.click(await screen.findByRole('button', { name: 'Classify beats' }))
  const counts = within(await screen.findByLabelText('Classification counts'))
  expect(counts.getAllByText('1 · 50.0%')).toHaveLength(2)
  expect(await screen.findByRole('img', { name: 'Classified waveform' })).toBeTruthy()
  const options = post.mock.calls[0][0] as RequestInit
  expect(JSON.parse(options.body as string)).toEqual({
    record_id: '100',
    channel: 0,
    start_seconds: 0,
    duration_seconds: 10,
  })
  fireEvent.click(screen.getByText('Predicted beats and probabilities'))
  expect(screen.getByRole('table').textContent).toContain('PVC (V)')
})

test('missing model gives setup guidance and disables prediction', async () => {
  mockAPI({ ...model, available: false, version: '' })
  render(<AILab />)
  expect(await screen.findByText(/prepare real data and train once/)).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Classify beats' }).hasAttribute('disabled')).toBe(true)
  expect(screen.queryByLabelText('Classification counts')).toBeNull()
})

test('prediction errors allow retry and never invent counts', async () => {
  let attempts = 0
  mockAPI(model, async () =>
    ++attempts === 1
      ? Response.json({ detail: 'Model unavailable' }, { status: 503 })
      : Response.json(prediction),
  )
  render(<AILab />)
  await screen.findByText('Model version: test-model-version')
  fireEvent.click(screen.getByRole('button', { name: 'Classify beats' }))
  expect((await screen.findByRole('alert')).textContent).toContain('Model unavailable')
  expect(screen.queryByLabelText('Classification counts')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Retry classification' }))
  expect(await screen.findByLabelText('Classification counts')).toBeTruthy()
})

test('zero classified beats show insufficient data, not fake proportions', async () => {
  mockAPI(model, async () =>
    Response.json({
      ...prediction,
      beats: [],
      counts: { N: 0, V: 0 },
      proportions: { N: null, V: null },
    }),
  )
  render(<AILab />)
  await screen.findByText('Model version: test-model-version')
  fireEvent.click(screen.getByRole('button', { name: 'Classify beats' }))
  expect(await screen.findByText('No complete usable beats. Try a longer interval.')).toBeTruthy()
  expect(
    within(screen.getByLabelText('Classification counts')).getAllByText(/Insufficient data/),
  ).toHaveLength(2)
})

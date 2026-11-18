import { expect, test } from '@playwright/test'
import type { ECGAnalysis } from '../src/lib/analysis'

test('ECG Analyzer integrates real waveform, BPM/RR and model estimates', async ({ page }, testInfo) => {
  await page.goto('/#/ecg-analyzer')
  await page.getByRole('combobox', { name: 'ECG record', exact: true }).selectOption('208')
  await expect(page.locator('.js-plotly-plot')).toBeVisible()
  await page.getByLabel('Start time (s)', { exact: true }).fill('0.55')
  await page.getByRole('button', { name: 'Update interval', exact: true }).click()
  await expect(page.getByText('0.550 – 10.550 s', { exact: true })).toBeVisible()
  const [response] = await Promise.all([
    page.waitForResponse((response) => response.url().endsWith('/api/v1/ecg/analyze')),
    page.getByRole('button', { name: 'Analyze with AI', exact: true }).click(),
  ])
  expect(response.status()).toBe(200)
  const result = await response.json() as ECGAnalysis
  const prediction = result.ai_classification!
  expect(prediction.beats.length).toBeGreaterThan(0)
  expect(result.original_signal.start_sample).toBe(198)
  expect(prediction.detected_count).toBe(result.statistics.peak_count)
  await expect(page.getByLabel('Estimated heartbeat statistics')).toContainText(result.statistics.average_bpm!.toFixed(1))
  await expect(page.getByLabel('Estimated heartbeat statistics')).toContainText(result.statistics.mean_rr_seconds!.toFixed(3))
  await expect(page.getByLabel('Classification counts')).toContainText(`${prediction.counts.V} · ${(prediction.proportions.V! * 100).toFixed(1)}%`)
  await expect(page.getByText(`Model ${prediction.model_version}`, { exact: true })).toBeVisible()
  const graph = page.locator('.js-plotly-plot')
  await expect.poll(() => graph.evaluate((node) =>
    (node as HTMLElement & { data: { name: string }[] }).data.map((trace) => trace.name),
  )).toEqual(['Original ECG', 'Filtered ECG', 'Detected peaks (algorithm)', 'N estimates', 'PVC estimates'])
  const markers = await graph.evaluate((node) =>
    (node as HTMLElement & { data: { name: string; x: number[]; y: number[] }[] }).data
      .filter((trace) => trace.name.endsWith('estimates'))
      .flatMap((trace) => trace.x.map((time, index) => [time, trace.y[index]])),
  )
  expect(markers.sort((a, b) => a[0] - b[0])).toEqual(prediction.beats.map((beat) => [beat.timestamp_seconds, beat.filtered_amplitude]))
  await page.getByText('Predicted beats and probabilities', { exact: true }).click()
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(prediction.beats.length)
  if (testInfo.project.name === 'tablet') await page.setViewportSize({ width: 820, height: 1180 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: testInfo.outputPath('integrated-ecg-ai.png'), fullPage: true })
  await page.getByLabel('Duration (s)', { exact: true }).fill('5')
  await page.getByRole('button', { name: 'Update interval', exact: true }).click()
  await expect(page.getByLabel('Classification counts')).toHaveCount(0)
  await expect(page.getByLabel('Estimated heartbeat statistics')).toHaveCount(0)
  await page.getByRole('link', { name: 'AI Lab', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'AI Lab', exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'ECG Analyzer', exact: true }).click()
  await expect(page.locator('.js-plotly-plot')).toBeVisible()
})

test('missing model errors recover and signal analysis remains usable', async ({ page }) => {
  await page.route('**/api/v1/ecg/analyze', async (route) => {
    await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ detail: 'Local model unavailable. Train the model first.' }) })
  }, { times: 1 })
  await page.goto('/#/ecg-analyzer')
  await expect(page.locator('.js-plotly-plot')).toBeVisible()
  await page.getByRole('button', { name: 'Analyze with AI', exact: true }).click()
  await expect(page.locator('.ecg-error')).toContainText('Local model unavailable')
  await expect(page.getByLabel('Classification counts')).toHaveCount(0)
  await page.getByRole('button', { name: 'Retry analysis', exact: true }).click()
  await expect(page.getByLabel('Classification counts')).toBeVisible()
  await page.getByRole('button', { name: 'Run analysis', exact: true }).click()
  await expect(page.getByLabel('Estimated heartbeat statistics')).toBeVisible()
  await expect(page.getByLabel('Classification counts')).toHaveCount(0)
  await page.getByRole('combobox', { name: 'Channel', exact: true }).selectOption('1')
  await expect(page.getByRole('button', { name: 'Analyze with AI', exact: true })).toBeDisabled()
})

test('AI Lab explains missing model and dataset availability', async ({ page }) => {
  await page.route('**/api/v1/ai/model', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ available: false, version: null, supported_classes: ['N', 'V'], message: 'Model unavailable' }) })
  })
  await page.goto('/#/ai-lab')
  await expect(page.getByText('Model unavailable', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Classify beats', exact: true })).toBeDisabled()
  await page.route('**/api/v1/ecg/records', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ records: [], unavailable_records: [{ record_id: '100', reason: 'Local dataset is missing.' }] }) })
  })
  await page.getByRole('link', { name: 'ECG Analyzer', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'No readable local ECG records' })).toBeVisible()
  await expect(page.locator('.js-plotly-plot')).toHaveCount(0)
})

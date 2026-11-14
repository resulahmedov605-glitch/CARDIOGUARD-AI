import { expect, test, type Locator, type Page } from '@playwright/test'
import type { ECGAnalysis } from '../src/lib/analysis'

type PlotElement = HTMLElement & {
  data: { name: string; yaxis?: string }[]
  _fullLayout: { xaxis: { range: number[] } }
}

async function openECG(page: Page) {
  await page.goto('/#/ecg-analyzer')
  await expect(page.getByRole('combobox', { name: 'ECG record', exact: true })).toHaveValue('100')
  await expect(page.locator('.js-plotly-plot')).toBeVisible()
}

async function analyze(page: Page): Promise<ECGAnalysis> {
  const [response] = await Promise.all([
    page.waitForResponse((response) => response.url().endsWith('/api/v1/ecg/analyze')),
    page.getByRole('button', { name: 'Run analysis', exact: true }).click(),
  ])
  expect(response.status()).toBe(200)
  const result = await response.json() as ECGAnalysis
  await expect(page.getByLabel('Estimated heartbeat statistics')).toBeVisible()
  return result
}

const traceNames = (graph: Locator) => graph.evaluate((node) => (node as PlotElement).data.map((trace) => trace.name))

test('real ECG, minimum interval, normalized analysis and visibility controls', async ({ page }, testInfo) => {
  await page.goto('/#/overview')
  await expect(page.getByRole('status').filter({ hasText: 'Connected' })).toBeVisible()
  await page.getByRole('link', { name: 'ECG Analyzer', exact: true }).click()
  await expect(page.locator('.js-plotly-plot')).toBeVisible()
  await page.getByRole('combobox', { name: 'Channel', exact: true }).selectOption('1')
  await page.getByLabel('Start time (s)', { exact: true }).fill('0.55')
  await page.getByLabel('Duration (s)', { exact: true }).fill('0.5')
  await page.getByRole('button', { name: 'Update interval', exact: true }).click()
  await expect(page.getByRole('img', { name: /V5, 180 samples/ })).toBeVisible()
  const short = await analyze(page)
  expect(short.original_signal.start_sample).toBe(198)
  expect(short.original_signal.sample_count).toBe(180)

  await page.getByLabel('Start time (s)', { exact: true }).fill('0')
  await page.getByLabel('Duration (s)', { exact: true }).fill('10')
  await page.getByRole('button', { name: 'Update interval', exact: true }).click()
  await expect(page.getByRole('img', { name: /V5, 3600 samples/ })).toBeVisible()
  await expect(page.getByLabel('Estimated heartbeat statistics')).toHaveCount(0)
  await page.getByRole('combobox', { name: 'Normalization', exact: true }).selectOption('zscore')
  const result = await analyze(page)
  expect(result.normalized_signal?.units).toBe('dimensionless')
  expect(result.normalized_signal?.amplitudes).toHaveLength(3600)
  expect(result.original_signal.amplitudes).toHaveLength(3600)
  await expect(page.getByLabel('Estimated heartbeat statistics')).toContainText(result.statistics.average_bpm!.toFixed(1))
  const graph = page.locator('.js-plotly-plot')
  await expect.poll(() => traceNames(graph)).toEqual(['Original ECG', 'Filtered ECG', 'Detected peaks (algorithm)', 'Normalized ECG (z-score)'])
  expect(await graph.evaluate((node) => (node as PlotElement).data[3].yaxis)).toBe('y2')
  await graph.screenshot({ path: testInfo.outputPath('normalized-ecg.png') })
  await page.getByLabel('Normalized ECG (z-score)', { exact: true }).uncheck()
  await page.getByLabel('Original ECG', { exact: true }).uncheck()
  await page.getByLabel('Detected peaks (algorithm)', { exact: true }).uncheck()
  await expect.poll(() => traceNames(graph)).toEqual(['Filtered ECG'])
  await page.getByLabel('Original ECG', { exact: true }).check()
  await page.getByLabel('Detected peaks (algorithm)', { exact: true }).check()
  await page.getByText('RR intervals and peak timestamps', { exact: true }).click()
  await expect(page.getByRole('table')).toBeVisible()
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(result.statistics.peak_count)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('real Plotly zoom, pan, reset and hover', async ({ page }) => {
  await openECG(page)
  const graph = page.locator('.js-plotly-plot')
  const range = () => graph.evaluate((node) => (node as PlotElement)._fullLayout.xaxis.range)
  const initial = await range()
  await graph.scrollIntoViewIfNeeded()
  const drag = graph.locator('.nsewdrag')
  const box = (await drag.boundingBox())!
  await page.mouse.move(box.x + box.width * .2, box.y + box.height * .2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * .6, box.y + box.height * .8, { steps: 12 })
  await page.mouse.up()
  await expect.poll(async () => { const r = await range(); return r[1] - r[0] }).toBeLessThan(6)
  const zoomed = await range()
  await page.locator('.ecg-chart-toolbar').getByRole('button', { name: 'Pan', exact: true }).click()
  const panBox = (await drag.boundingBox())!
  await page.mouse.move(panBox.x + panBox.width * .5, panBox.y + panBox.height * .5)
  await page.mouse.down()
  await page.mouse.move(panBox.x + panBox.width * .65, panBox.y + panBox.height * .5, { steps: 12 })
  await page.mouse.up()
  await expect.poll(async () => (await range())[0]).not.toBeCloseTo(zoomed[0], 2)
  await page.getByRole('button', { name: 'Reset view', exact: true }).click()
  await expect.poll(range).toEqual(initial)
  await graph.scrollIntoViewIfNeeded()
  const point = await graph.locator('.scatterlayer .js-line').first().evaluate((node) => {
    const path = node as SVGPathElement
    const point = path.getPointAtLength(path.getTotalLength() * .45)
    const screen = new DOMPoint(point.x, point.y).matrixTransform(path.getScreenCTM()!)
    return { x: screen.x, y: screen.y }
  })
  await page.mouse.move(point.x, point.y)
  await expect(graph.locator('.hoverlayer .hovertext').first()).toBeVisible()
})

test('API errors are actionable and retry recovers the real waveform', async ({ page }) => {
  await page.route('**/api/v1/ecg/records/100/signal?**', async (route) => {
    await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ detail: 'Temporary dataset read failure' }) })
  }, { times: 1 })
  await page.goto('/#/ecg-analyzer')
  await expect(page.getByRole('alert')).toContainText('Temporary dataset read failure')
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(page.locator('.js-plotly-plot')).toBeVisible()
})

test('theme and desktop sidebar persist while mobile controls fit', async ({ page }, testInfo) => {
  await openECG(page)
  await page.getByRole('button', { name: 'Switch to dark mode' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect.poll(() => page.locator('.js-plotly-plot').evaluate((node) =>
    (node as HTMLElement & { _fullLayout: { paper_bgcolor: string } })._fullLayout.paper_bgcolor,
  )).toBe('#1B1820')
  const sidebar = page.locator('#workspace-sidebar')
  const separator = page.getByRole('separator', { name: 'Resize sidebar' })
  if (testInfo.project.name === 'desktop') {
    const initial = (await sidebar.boundingBox())!.width
    const handle = (await separator.boundingBox())!
    await page.mouse.move(handle.x + handle.width / 2, handle.y + 100)
    await page.mouse.down()
    await page.mouse.move(handle.x + handle.width / 2 + 60, handle.y + 100, { steps: 12 })
    await page.mouse.up()
    await expect.poll(async () => (await sidebar.boundingBox())!.width).toBeCloseTo(initial + 60, 0)
    await page.getByRole('button', { name: 'Collapse sidebar', exact: true }).click()
    await expect.poll(async () => (await sidebar.boundingBox())!.width).toBe(72)
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await expect.poll(async () => (await sidebar.boundingBox())!.width).toBe(72)
    await page.getByRole('button', { name: 'Expand sidebar', exact: true }).click()
    await expect.poll(async () => (await sidebar.boundingBox())!.width).toBeCloseTo(initial + 60, 0)
  } else {
    await expect(separator).toBeHidden()
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  }
  await expect(page.getByRole('combobox', { name: 'Normalization', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('workspace-dark.png'), fullPage: true })
})

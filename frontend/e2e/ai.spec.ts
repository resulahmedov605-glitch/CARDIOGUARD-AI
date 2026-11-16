import { expect, test } from '@playwright/test'
import type { PredictionResult } from '../src/lib/ai'

test('AI Lab displays real model predictions and classified markers', async ({
  page,
}, testInfo) => {
  await page.goto('/#/ai-lab')
  await expect(page.getByText(/^Model version: [a-f0-9]{16}$/)).toBeVisible()
  await page.getByRole('combobox', { name: 'ECG record', exact: true }).selectOption('208')
  const [response] = await Promise.all([
    page.waitForResponse((response) => response.url().endsWith('/api/v1/ai/predict')),
    page.getByRole('button', { name: 'Classify beats', exact: true }).click(),
  ])
  expect(response.status()).toBe(200)
  const result = (await response.json()) as PredictionResult
  expect(result.beats.length).toBeGreaterThan(0)
  expect(result.counts.N + result.counts.V).toBe(result.beats.length)
  await expect(page.getByLabel('Classification counts')).toContainText(
    `${result.counts.V} · ${(result.proportions.V! * 100).toFixed(1)}%`,
  )
  await expect(page.getByText(`Model ${result.model_version}`, { exact: true })).toBeVisible()
  const graph = page.locator('.js-plotly-plot')
  await expect(graph).toBeVisible()
  await expect
    .poll(() =>
      graph.evaluate((node) =>
        (node as HTMLElement & { data: { name: string }[] }).data.map((trace) => trace.name),
      ),
    )
    .toEqual(['Original ECG', 'Filtered ECG', 'N estimates', 'PVC estimates'])
  await graph.screenshot({ path: testInfo.outputPath('ai-classification.png') })
  await page.getByLabel('PVC estimates', { exact: true }).uncheck()
  await page.getByText('Predicted beats and probabilities', { exact: true }).click()
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(result.beats.length)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
})

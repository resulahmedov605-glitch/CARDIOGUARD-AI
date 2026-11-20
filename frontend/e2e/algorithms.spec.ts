import { expect, test } from '@playwright/test'
import type { LabExecution } from '../src/lib/algorithms'

test('sorting comparison uses real Python traces and playback controls', async ({ page }, testInfo) => {
  await page.goto('/#/algorithms-lab')
  await expect(page.getByRole('heading', { name: 'Algorithms Lab', exact: true })).toBeVisible()
  await page.getByLabel('Values', { exact: true }).fill('3, 2, 1')
  await page.getByLabel('Compare Bubble Sort and Merge Sort').check()
  await page.getByLabel('Animation speed').selectOption('4')
  const [response] = await Promise.all([
    page.waitForResponse((response) => response.url().endsWith('/api/v1/algorithms/execute')),
    page.getByRole('button', { name: 'Run', exact: true }).click(),
  ])
  expect(response.status()).toBe(200)
  const data = await response.json() as LabExecution
  expect(data.runs).toHaveLength(2)
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await page.getByRole('button', { name: 'Reset', exact: true }).click()
  await expect(page.getByRole('status')).toContainText(`Step 1 of ${data.step_count} · Paused`)
  const first = page.getByLabel('Bubble Sort execution', { exact: true })
  for (const [index, value] of data.runs[0].steps[0].state.values.entries()) {
    await expect(first.getByRole('listitem', { name: `Index ${index}, value ${value}`, exact: true })).toBeVisible()
  }
  await page.getByRole('button', { name: 'Step Forward', exact: true }).click()
  await expect(page.getByRole('status')).toContainText(`Step 2 of ${data.step_count}`)
  await page.getByRole('button', { name: 'Run', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Complete', { timeout: 15000 })
  for (const name of ['Bubble Sort', 'Merge Sort']) {
    const panel = page.getByLabel(`${name} execution`, { exact: true })
    await expect(panel.locator('.lab-result')).toContainText('1,\n    2,\n    3')
    const run = data.runs.find((run) => run.algorithm === (name === 'Bubble Sort' ? 'bubble-sort' : 'merge-sort'))!
    await expect(page.getByLabel(`${name} recorded work`, { exact: true })).toContainText(`comparisons${run.metrics.comparisons}`)
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('sorting-comparison.png'), fullPage: true, animations: 'disabled' })
  await page.getByRole('button', { name: 'Switch to dark mode', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.screenshot({ path: testInfo.outputPath('sorting-dark.png'), fullPage: true, animations: 'disabled' })
})

test('all nine structures run and render the returned state', async ({ page }, testInfo) => {
  await page.goto('/#/algorithms-lab')
  await page.getByRole('combobox', { name: 'Category', exact: true }).selectOption('Data structures')
  const ids = ['array', 'linked-list', 'stack', 'queue', 'circular-queue', 'hash-table', 'binary-tree', 'graph', 'priority-queue']
  for (const id of ids) {
    await page.getByLabel('Algorithm or structure').selectOption(id)
    const [response] = await Promise.all([
      page.waitForResponse((response) => response.url().endsWith('/api/v1/algorithms/execute')),
      page.getByRole('button', { name: 'Run', exact: true }).click(),
    ])
    expect(response.status()).toBe(200)
    const data = await response.json() as LabExecution
    expect(data.runs[0].algorithm).toBe(id)
    await page.getByRole('button', { name: 'Pause', exact: true }).click()
    await page.getByRole('button', { name: 'Reset', exact: true }).click()
    await expect(page.getByRole('status')).toContainText('Step 1 of')
    if (['array', 'linked-list', 'stack', 'queue'].includes(id)) {
      expect((await page.getByLabel('Current structure', { exact: true }).locator('.lab-cell > strong').allTextContents()).map(Number))
        .toEqual(data.runs[0].steps[0].state.values)
    }
    await page.getByRole('button', { name: 'Step Forward', exact: true }).click()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  await page.screenshot({ path: testInfo.outputPath('priority-queue.png'), fullPage: true })
})

test('graph traversals, shortest paths and input errors are represented honestly', async ({ page }, testInfo) => {
  await page.goto('/#/algorithms-lab')
  await page.getByRole('combobox', { name: 'Category', exact: true }).selectOption('Graphs')
  for (const id of ['bfs', 'dfs']) {
    await page.getByLabel('Algorithm or structure').selectOption(id)
    await page.getByLabel('Nodes', { exact: true }).fill('A, B')
    await page.getByRole('textbox', { name: 'Edges', exact: true }).fill('A B 1')
    await page.getByLabel('Animation speed').selectOption('4')
    await page.getByRole('button', { name: 'Run', exact: true }).click()
    await expect(page.getByRole('status')).toContainText('Complete')
    await expect(page.locator('.lab-result')).toContainText('"A"')
    await expect(page.locator('.lab-result')).toContainText('"B"')
  }
  await page.getByLabel('Algorithm or structure').selectOption('dijkstra')
  await page.getByLabel('Nodes', { exact: true }).fill('A, B, C, Z')
  await page.getByRole('textbox', { name: 'Edges', exact: true }).fill('A B 5\nA C 1\nC B 1')
  await page.getByLabel('Animation speed').selectOption('4')
  await page.getByRole('button', { name: 'Run', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Complete')
  await expect(page.locator('.lab-result')).toContainText('"B": 2')
  await expect(page.locator('.lab-result')).toContainText('"Z": null')
  await page.screenshot({ path: testInfo.outputPath('shortest-paths.png'), fullPage: true })
  await page.getByRole('textbox', { name: 'Edges', exact: true }).fill('A B -1')
  await page.getByRole('button', { name: 'Run', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('nonnegative')
  await expect(page.locator('.lab-result')).toHaveCount(0)
  await page.getByRole('link', { name: '3D Heart Explorer', exact: true }).click()
  await expect(page.getByText('Model loaded', { exact: true })).toBeVisible()
})

test('binary search and sliding windows handle custom and empty inputs', async ({ page }) => {
  await page.goto('/#/algorithms-lab')
  await page.getByRole('combobox', { name: 'Category', exact: true }).selectOption('Searching')
  await page.getByLabel('Values', { exact: true }).fill('1, 4, 9')
  await page.getByLabel('Target', { exact: true }).fill('4')
  await page.getByLabel('Animation speed').selectOption('4')
  await page.getByRole('button', { name: 'Run', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Complete')
  await expect(page.locator('.lab-result')).toContainText('"index": 1')
  await page.getByLabel('Values', { exact: true }).fill('9, 1')
  await page.getByRole('button', { name: 'Run', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('sorted')
  await page.getByRole('combobox', { name: 'Category', exact: true }).selectOption('Window algorithms')
  await page.getByLabel('Values', { exact: true }).fill('-4, -2, -2')
  await page.getByLabel('Window size', { exact: true }).fill('1')
  await page.getByLabel('Animation speed').selectOption('4')
  await page.getByRole('button', { name: 'Run', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Complete')
  await expect(page.locator('.lab-result')).toContainText('"max_sum": -2')
  await page.getByLabel('Values', { exact: true }).fill('')
  await page.getByRole('button', { name: 'Run', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Complete')
  await expect(page.locator('.lab-result')).toContainText('"max_sum": null')
})
